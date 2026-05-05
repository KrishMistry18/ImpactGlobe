import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getWindGridForZone, getTempAnomaliesForZone } from '@/lib/env/openmeteo'
import { getWindGridForZoneWeatherAPI, getTempAnomaliesForZoneWeatherAPI } from '@/lib/env/weatherapi'
import { getZoneForType, getCurrentZoneForType, GLOBE_ZONES } from '@/lib/env/zones'
import type { EnvLayerData, WindPoint, TempAnomalyPoint } from '@/store/types'

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
    const supabase = createAdminClient()
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 21_600_000)

    // ── Wind ──────────────────────────────────────────────────────────────
    const { data: allWindZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'wind_zone_%')

    const windCacheEmpty = !allWindZones || allWindZones.length === 0

    if (windCacheEmpty) {
      console.log('[Weather] Wind cache empty — fetching all 4 zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `wind_zone_${zone.id}`
        let points: WindPoint[] = []
        try {
          points = await getWindGridForZone(zone)
        } catch {
          try { points = await getWindGridForZoneWeatherAPI(zone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await supabase.from('env_data_cache').upsert({
            layer_type: key,
            data: { points, zone: zone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          })
          console.log(`[Weather] Cached ${points.length} wind pts for ${zone.name}`)
        }
      }
    } else {
      // Staggered refresh — one zone per scheduled minute
      const windZone = getZoneForType('wind') ?? getCurrentZoneForType('wind')
      const windKey = `wind_zone_${windZone.id}`
      const cached = allWindZones?.find((c: any) => c.layer_type === windKey)
      if (!cached || new Date(cached.fetched_at) < sixHoursAgo) {
        let points: WindPoint[] = []
        try { points = await getWindGridForZone(windZone) } catch {
          try { points = await getWindGridForZoneWeatherAPI(windZone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await supabase.from('env_data_cache').upsert({
            layer_type: windKey,
            data: { points, zone: windZone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          })
          console.log(`[Weather] Refreshed ${points.length} wind pts for ${windZone.name}`)
        }
      }
    }

    // ── Temperature ───────────────────────────────────────────────────────
    const { data: allTempZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'temp_zone_%')

    const tempCacheEmpty = !allTempZones || allTempZones.length === 0

    if (tempCacheEmpty) {
      console.log('[Weather] Temp cache empty — fetching all 4 zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `temp_zone_${zone.id}`
        let points: TempAnomalyPoint[] = []
        try {
          points = await getTempAnomaliesForZone(zone)
        } catch {
          try { points = await getTempAnomaliesForZoneWeatherAPI(zone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await supabase.from('env_data_cache').upsert({
            layer_type: key,
            data: { points, zone: zone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          })
          console.log(`[Weather] Cached ${points.length} temp pts for ${zone.name}`)
        }
      }
    } else {
      const tempZone = getZoneForType('temp') ?? getCurrentZoneForType('temp')
      const tempKey = `temp_zone_${tempZone.id}`
      const cached = allTempZones?.find((c: any) => c.layer_type === tempKey)
      if (!cached || new Date(cached.fetched_at) < sixHoursAgo) {
        let points: TempAnomalyPoint[] = []
        try { points = await getTempAnomaliesForZone(tempZone) } catch {
          try { points = await getTempAnomaliesForZoneWeatherAPI(tempZone) } catch { /* skip */ }
        }
        if (points.length > 0) {
          await supabase.from('env_data_cache').upsert({
            layer_type: tempKey,
            data: { points, zone: tempZone.id },
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
          })
          console.log(`[Weather] Refreshed ${points.length} temp pts for ${tempZone.name}`)
        }
      }
    }

    // ── Merge all cached zones ─────────────────────────────────────────────
    const { data: freshWindZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'wind_zone_%')
    const { data: freshTempZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'temp_zone_%')

    const allWindPoints: WindPoint[] = []
    freshWindZones?.forEach((z: any) => {
      const d = z.data as { points: WindPoint[] }
      if (d?.points) allWindPoints.push(...d.points)
    })

    const allTempPoints: TempAnomalyPoint[] = []
    freshTempZones?.forEach((z: any) => {
      const d = z.data as { points: TempAnomalyPoint[] }
      if (d?.points) allTempPoints.push(...d.points)
    })

    const windCoverage = Math.round((freshWindZones?.length ?? 0) / GLOBE_ZONES.length * 100)
    const tempCoverage = Math.round((freshTempZones?.length ?? 0) / GLOBE_ZONES.length * 100)

    console.log(`[Weather] Returning ${allWindPoints.length} wind (${windCoverage}%), ${allTempPoints.length} temp (${tempCoverage}%)`)

    return NextResponse.json(
      {
        wind: { type: 'wind', updatedAt: now.toISOString(), wind: allWindPoints } as EnvLayerData,
        temperature_anomaly: { type: 'temperature_anomaly', updatedAt: now.toISOString(), tempAnomalies: allTempPoints } as EnvLayerData,
        meta: { windCoverage: `${windCoverage}%`, tempCoverage: `${tempCoverage}%`, zonesLoaded: { wind: freshWindZones?.length ?? 0, temp: freshTempZones?.length ?? 0, total: GLOBE_ZONES.length } },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[Weather] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 })
  }
}
