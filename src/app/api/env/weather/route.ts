import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getWindGridForZone, getTempAnomaliesForZone } from '@/lib/env/openmeteo'
import { getWindGridForZoneWeatherAPI, getTempAnomaliesForZoneWeatherAPI } from '@/lib/env/weatherapi'
import { getZoneForType, getCurrentZoneForType, GLOBE_ZONES } from '@/lib/env/zones'
import type { EnvLayerData, WindPoint, TempAnomalyPoint } from '@/store/types'
import { FieldPath } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic';

/**
 * GET /api/env/weather
 * Returns wind + temperature anomaly data from Open-Meteo (free, no key).
 *
 * Strategy:
 * - First load (empty cache): fetch ALL 4 zones immediately for full coverage
 * - Subsequent loads: staggered rotation — wind offset 0, temp offset 1
 * - Each zone cached 6 hours → ~4 API calls/day ✅
 */
export async function GET() {
  try {
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 21_600_000)

    const windZoneIds = GLOBE_ZONES.map(z => `wind_zone_${z.id}`)
    const tempZoneIds = GLOBE_ZONES.map(z => `temp_zone_${z.id}`)

    // ── Wind ──────────────────────────────────────────────────────────────
    const windSnapshot = await adminDb.collection('env_data_cache')
      .where(FieldPath.documentId(), 'in', windZoneIds)
      .get()

    const allWindZones = windSnapshot.docs.map(doc => ({ layer_type: doc.id, ...doc.data() } as any))
    const windCacheEmpty = allWindZones.length === 0

    if (windCacheEmpty) {
      console.log('[Weather] Wind cache empty — fetching all zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `wind_zone_${zone.id}`
        let points: WindPoint[] = []
        try {
          points = await getWindGridForZone(zone)
        } catch {
          try { points = await getWindGridForZoneWeatherAPI(zone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await adminDb.collection('env_data_cache').doc(key).set({
            data: { points, zone: zone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          }, { merge: true })
          console.log(`[Weather] Cached ${points.length} wind pts for ${zone.name}`)
        }
      }
    } else {
      // Staggered refresh — one zone per scheduled minute
      const windZone = getZoneForType('wind') ?? getCurrentZoneForType('wind')
      const windKey = `wind_zone_${windZone.id}`
      const cached = allWindZones.find((c: any) => c.layer_type === windKey)
      if (!cached || new Date(cached.fetched_at) < sixHoursAgo) {
        let points: WindPoint[] = []
        try { points = await getWindGridForZone(windZone) } catch {
          try { points = await getWindGridForZoneWeatherAPI(windZone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await adminDb.collection('env_data_cache').doc(windKey).set({
            data: { points, zone: windZone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          }, { merge: true })
          console.log(`[Weather] Refreshed ${points.length} wind pts for ${windZone.name}`)
        }
      }
    }

    // ── Temperature ───────────────────────────────────────────────────────
    const tempSnapshot = await adminDb.collection('env_data_cache')
      .where(FieldPath.documentId(), 'in', tempZoneIds)
      .get()

    const allTempZones = tempSnapshot.docs.map(doc => ({ layer_type: doc.id, ...doc.data() } as any))
    const tempCacheEmpty = allTempZones.length === 0

    if (tempCacheEmpty) {
      console.log('[Weather] Temp cache empty — fetching all zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `temp_zone_${zone.id}`
        let points: TempAnomalyPoint[] = []
        try {
          points = await getTempAnomaliesForZone(zone)
        } catch {
          try { points = await getTempAnomaliesForZoneWeatherAPI(zone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await adminDb.collection('env_data_cache').doc(key).set({
            data: { points, zone: zone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          }, { merge: true })
          console.log(`[Weather] Cached ${points.length} temp pts for ${zone.name}`)
        }
      }
    } else {
      const tempZone = getZoneForType('temp') ?? getCurrentZoneForType('temp')
      const tempKey = `temp_zone_${tempZone.id}`
      const cached = allTempZones.find((c: any) => c.layer_type === tempKey)
      if (!cached || new Date(cached.fetched_at) < sixHoursAgo) {
        let points: TempAnomalyPoint[] = []
        try { points = await getTempAnomaliesForZone(tempZone) } catch {
          try { points = await getTempAnomaliesForZoneWeatherAPI(tempZone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await adminDb.collection('env_data_cache').doc(tempKey).set({
            data: { points, zone: tempZone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          }, { merge: true })
          console.log(`[Weather] Refreshed ${points.length} temp pts for ${tempZone.name}`)
        }
      }
    }

    // ── Merge all cached zones ─────────────────────────────────────────────
    const freshWindSnapshot = await adminDb.collection('env_data_cache')
      .where(FieldPath.documentId(), 'in', windZoneIds)
      .get()
    const freshWindZones = freshWindSnapshot.docs.map(doc => doc.data())
    
    const freshTempSnapshot = await adminDb.collection('env_data_cache')
      .where(FieldPath.documentId(), 'in', tempZoneIds)
      .get()
    const freshTempZones = freshTempSnapshot.docs.map(doc => doc.data())

    const allWindPoints: WindPoint[] = []
    freshWindZones.forEach((z: any) => {
      const d = z.data as { points: WindPoint[] }
      if (d?.points) allWindPoints.push(...d.points)
    })

    const allTempPoints: TempAnomalyPoint[] = []
    freshTempZones.forEach((z: any) => {
      const d = z.data as { points: TempAnomalyPoint[] }
      if (d?.points) allTempPoints.push(...d.points)
    })

    const windCoverage = Math.round((freshWindZones.length) / GLOBE_ZONES.length * 100)
    const tempCoverage = Math.round((freshTempZones.length) / GLOBE_ZONES.length * 100)

    console.log(`[Weather] Returning ${allWindPoints.length} wind (${windCoverage}%), ${allTempPoints.length} temp (${tempCoverage}%)`)

    return NextResponse.json(
      {
        wind: { type: 'wind', updatedAt: now.toISOString(), wind: allWindPoints } as EnvLayerData,
        temperature_anomaly: { type: 'temperature_anomaly', updatedAt: now.toISOString(), tempAnomalies: allTempPoints } as EnvLayerData,
        meta: { windCoverage: `${windCoverage}%`, tempCoverage: `${tempCoverage}%`, zonesLoaded: { wind: freshWindZones.length, temp: freshTempZones.length, total: GLOBE_ZONES.length } },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error: any) {
    console.error('[Weather] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather data', message: error.message, stack: error.stack }, { status: 500 })
  }
}
