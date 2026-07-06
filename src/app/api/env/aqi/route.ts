import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { fetchGlobalAQI } from '@/lib/env/openaq'
import { interpolateToGrid, gridToJSON } from '@/lib/env/gridInterpolator'
import type { EnvLayerData, AQIPoint } from '@/store/types'

const KEY = 'aqi'
const CACHE_MS = 21_600_000 // 6h

/** Guard against launching two background refreshes at once. */
let refreshing = false

export const maxDuration = 60; // Max allowed on Vercel Hobby

export async function GET() {
  try {
    const now = new Date()

    const docRef = adminDb.collection('env_data_cache').doc(KEY)
    const cachedDoc = await docRef.get()
    const row = cachedDoc.exists ? cachedDoc.data() as { data: { points?: AQIPoint[] } | null; expires_at: string } : undefined
    
    const points: AQIPoint[] = row?.data?.points ?? []
    const stale = !row?.expires_at || new Date(row.expires_at).getTime() <= now.getTime()

    if (stale && !refreshing) {
      refreshing = true
      console.log('[AQI] Cache stale/missing → starting background refresh')
      after(async () => {
        try {
          const { points: fresh, complete } = await fetchGlobalAQI()
          if (!complete || fresh.length === 0) {
            console.warn('[AQI] Background pass incomplete; not overwriting cache')
            return
          }
          await adminDb.collection('env_data_cache').doc(KEY).set({
            layer_type: KEY,
            data: { points: fresh },
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_MS).toISOString(),
          }, { merge: true })
          console.log(`[AQI] Background refresh cached: ${fresh.length} pts`)
        } catch (err) {
          console.error('[AQI] Background refresh error:', err)
        } finally {
          refreshing = false
        }
      })
    }

    const aqiGrid = points.length > 0
      ? gridToJSON(interpolateToGrid(points.map((p) => ({ lat: p.lat, lon: p.lon, value: p.aqi })), 10))
      : undefined

    const aqiData: EnvLayerData = {
      type: 'aqi',
      updatedAt: now.toISOString(),
      aqi: points,
      aqiGrid,
    }

    return NextResponse.json(
      { ...aqiData, meta: { points: points.length, stale, refreshing } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[AQI] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch AQI data' }, { status: 500 })
  }
}
