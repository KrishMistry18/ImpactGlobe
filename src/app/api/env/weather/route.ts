import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { fetchGlobalWeather } from '@/lib/env/openmeteo'
import { interpolateToGrid, gridToJSON } from '@/lib/env/gridInterpolator'
import type { EnvLayerData, WindPoint, TempAnomalyPoint } from '@/store/types'

const WIND_KEY = 'wind'
const TEMP_KEY = 'temp_anomaly'
const CACHE_MS = 21_600_000 // 6h

let refreshing = false

export const maxDuration = 300; // Allow up to 5 minutes on Vercel

export async function GET() {
  try {
    const now = new Date()

    const windDocRef = adminDb.collection('env_data_cache').doc(WIND_KEY)
    const tempDocRef = adminDb.collection('env_data_cache').doc(TEMP_KEY)
    
    const [windDoc, tempDoc] = await Promise.all([windDocRef.get(), tempDocRef.get()])

    const windRow = windDoc.exists ? windDoc.data() as { data: { points?: WindPoint[] } | null; expires_at: string } : undefined
    const tempRow = tempDoc.exists ? tempDoc.data() as { data: { points?: TempAnomalyPoint[] } | null; expires_at: string } : undefined

    const windPoints: WindPoint[] = windRow?.data?.points ?? []
    const tempPoints: TempAnomalyPoint[] = tempRow?.data?.points ?? []

    const isFresh = (r: typeof windRow) =>
      !!r?.expires_at && new Date(r.expires_at).getTime() > now.getTime()
    const stale = !isFresh(windRow) || !isFresh(tempRow)

    if (stale && !refreshing) {
      refreshing = true
      console.log('[Weather] Cache stale/missing → starting background refresh')
      after(async () => {
        try {
          const { wind, temp, complete } = await fetchGlobalWeather()
          if (!complete) {
            console.warn('[Weather] Background pass incomplete; not overwriting cache')
            return
          }
          const expires = new Date(Date.now() + CACHE_MS).toISOString()
          const ts = new Date().toISOString()
          
          const batch = adminDb.batch()
          if (wind.length > 0) {
            batch.set(windDocRef, { layer_type: WIND_KEY, data: { points: wind }, fetched_at: ts, expires_at: expires }, { merge: true })
          }
          if (temp.length > 0) {
            batch.set(tempDocRef, { layer_type: TEMP_KEY, data: { points: temp }, fetched_at: ts, expires_at: expires }, { merge: true })
          }
          await batch.commit()

          console.log(`[Weather] Background refresh cached: ${wind.length} wind, ${temp.length} temp pts`)
        } catch (err) {
          console.error('[Weather] Background refresh error:', err)
        } finally {
          refreshing = false
        }
      })
    }

    const windGrid = windPoints.length > 0
      ? gridToJSON(interpolateToGrid(windPoints.map((p) => ({ lat: p.lat, lon: p.lon, value: p.speed }))))
      : undefined
    const tempGrid = tempPoints.length > 0
      ? gridToJSON(interpolateToGrid(tempPoints.map((p) => ({ lat: p.lat, lon: p.lon, value: p.anomalyC }))))
      : undefined

    return NextResponse.json(
      {
        wind: { type: 'wind', updatedAt: now.toISOString(), wind: windPoints, windGrid } as EnvLayerData,
        temperature_anomaly: {
          type: 'temperature_anomaly',
          updatedAt: now.toISOString(),
          tempAnomalies: tempPoints,
          tempGrid,
        } as EnvLayerData,
        meta: {
          windPoints: windPoints.length,
          tempPoints: tempPoints.length,
          stale,
          refreshing,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[Weather] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 })
  }
}
