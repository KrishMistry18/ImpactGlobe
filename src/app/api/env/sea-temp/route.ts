import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { fetchGlobalSeaTemp } from '@/lib/env/seatemp'
import { interpolateToGrid, gridToJSON } from '@/lib/env/gridInterpolator'
import type { EnvLayerData, SeaTempPoint } from '@/store/types'

const KEY = 'sea_temp'
const CACHE_MS = 172_800_000 // 48h

let refreshing = false

export const maxDuration = 60; // Max allowed on Vercel Hobby

export async function GET() {
  try {
    const now = new Date()

    const docRef = adminDb.collection('env_data_cache').doc(KEY)
    const cachedDoc = await docRef.get()
    const row = cachedDoc.exists ? cachedDoc.data() as { data: { points?: SeaTempPoint[] } | null; expires_at: string } : undefined

    const points: SeaTempPoint[] = row?.data?.points ?? []
    const stale = !row?.expires_at || new Date(row.expires_at).getTime() <= now.getTime()

    if (stale && !refreshing) {
      refreshing = true
      console.log('[SeaTemp] Cache stale/missing → starting background refresh')
      after(async () => {
        try {
          const { points: fresh, complete } = await fetchGlobalSeaTemp()
          if (!complete || fresh.length === 0) {
            console.warn('[SeaTemp] Background pass incomplete; not overwriting cache')
            return
          }
          await adminDb.collection('env_data_cache').doc(KEY).set({
            layer_type: KEY,
            data: { points: fresh },
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_MS).toISOString(),
          }, { merge: true })
          console.log(`[SeaTemp] Background refresh cached: ${fresh.length} pts`)
        } catch (err) {
          console.error('[SeaTemp] Background refresh error:', err)
        } finally {
          refreshing = false
        }
      })
    }

    const seaTempGrid = points.length > 0
      ? gridToJSON(interpolateToGrid(points.map((p) => ({ lat: p.lat, lon: p.lon, value: p.tempC })), 10))
      : undefined

    const seaData: EnvLayerData = {
      type: 'sea_temp',
      updatedAt: now.toISOString(),
      seaTemp: points,
      seaTempGrid,
    }

    return NextResponse.json(
      { ...seaData, meta: { points: points.length, stale, refreshing } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[SeaTemp] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch sea temp data' }, { status: 500 })
  }
}
