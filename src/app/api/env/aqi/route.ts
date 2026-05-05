import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAQIForZone } from '@/lib/env/openaq'
import { getZoneForType, getCurrentZoneForType, GLOBE_ZONES } from '@/lib/env/zones'
import type { EnvLayerData, AQIPoint } from '@/store/types'

/**
 * GET /api/env/aqi
 * Returns global AQI data from Open-Meteo Air Quality API (free, no key).
 *
 * Strategy:
 * - On first load (empty cache): fetch ALL 4 zones immediately
 * - On subsequent loads: use staggered rotation (offset 2) to refresh one zone at a time
 * - Each zone cached 6 hours → ~4 API calls/day per zone ✅
 */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 21_600_000)

    // Load all cached zones
    const { data: allCachedZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'aqi_zone_%')

    const cachedZoneIds = new Set(allCachedZones?.map((c: any) => c.layer_type) ?? [])
    const cacheIsEmpty = cachedZoneIds.size === 0

    if (cacheIsEmpty) {
      // First load — fetch ALL zones sequentially so the globe is fully covered immediately
      console.log('[AQI] Cache empty — fetching all 4 zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `aqi_zone_${zone.id}`
        try {
          const points = await getAQIForZone(zone)
          if (points.length > 0) {
            await supabase.from('env_data_cache').upsert({
              layer_type: key,
              data: { points, zone: zone.id },
              fetched_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
            })
            console.log(`[AQI] Cached ${points.length} pts for ${zone.name}`)
          }
        } catch (err) {
          console.error(`[AQI] Failed zone ${zone.name}:`, err)
        }
      }
    } else {
      // Subsequent loads — refresh one stale zone per request (staggered rotation)
      const aqiZone = getZoneForType('aqi') ?? getCurrentZoneForType('aqi')
      const aqiZoneKey = `aqi_zone_${aqiZone.id}`
      const zoneCache = allCachedZones?.find((c: any) => c.layer_type === aqiZoneKey)
      const needsRefresh = !zoneCache || new Date(zoneCache.fetched_at) < sixHoursAgo

      if (needsRefresh) {
        try {
          const points = await getAQIForZone(aqiZone)
          if (points.length > 0) {
            await supabase.from('env_data_cache').upsert({
              layer_type: aqiZoneKey,
              data: { points, zone: aqiZone.id },
              fetched_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
            })
            console.log(`[AQI] Refreshed ${points.length} pts for ${aqiZone.name}`)
          }
        } catch (err) {
          console.error(`[AQI] Failed to refresh ${aqiZone.name}:`, err)
        }
      }
    }

    // Merge all cached zones
    const { data: freshZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'aqi_zone_%')

    const allAqiPoints: AQIPoint[] = []
    freshZones?.forEach((z: any) => {
      const d = z.data as { points: AQIPoint[] }
      if (d?.points) allAqiPoints.push(...d.points)
    })

    const coverage = Math.round((freshZones?.length ?? 0) / GLOBE_ZONES.length * 100)
    console.log(`[AQI] Returning ${allAqiPoints.length} pts (${coverage}% coverage)`)

    const aqiData: EnvLayerData = {
      type: 'aqi',
      updatedAt: now.toISOString(),
      aqi: allAqiPoints,
    }

    return NextResponse.json(
      { ...aqiData, meta: { coverage: `${coverage}%`, zonesLoaded: freshZones?.length ?? 0, totalZones: GLOBE_ZONES.length } },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[AQI] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch AQI data' }, { status: 500 })
  }
}
