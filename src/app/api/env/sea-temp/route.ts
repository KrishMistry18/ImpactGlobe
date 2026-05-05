import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getSeaTempForZone } from '@/lib/env/seatemp'
import { getZoneForType, getCurrentZoneForType, GLOBE_ZONES } from '@/lib/env/zones'
import type { EnvLayerData, SeaTempPoint } from '@/store/types'

/**
 * GET /api/env/sea-temp
 * Sea surface temperature from Open-Meteo Marine API (free, no key).
 *
 * Land points are automatically excluded (marine API returns null for them),
 * so the heatmap naturally only covers ocean areas. ✅
 *
 * Strategy:
 * - First load (empty cache): fetch ALL 4 zones immediately
 * - Subsequent loads: staggered rotation (offset 3)
 * - Each zone cached 6 hours ✅
 */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 21_600_000)

    const { data: allCachedZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'sea_zone_%')

    const cacheIsEmpty = !allCachedZones || allCachedZones.length === 0

    if (cacheIsEmpty) {
      console.log('[SeaTemp] Cache empty — fetching all 4 zones...')
      for (const zone of GLOBE_ZONES) {
        const key = `sea_zone_${zone.id}`
        try {
          const points = await getSeaTempForZone(zone)
          if (points.length > 0) {
            await supabase.from('env_data_cache').upsert({
              layer_type: key,
              data: { points, zone: zone.id },
              fetched_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
            })
            console.log(`[SeaTemp] Cached ${points.length} pts for ${zone.name}`)
          }
        } catch (err) {
          console.error(`[SeaTemp] Failed zone ${zone.name}:`, err)
        }
      }
    } else {
      const seaZone = getZoneForType('sea_temp') ?? getCurrentZoneForType('sea_temp')
      const seaKey = `sea_zone_${seaZone.id}`
      const zoneCache = allCachedZones?.find((c: any) => c.layer_type === seaKey)
      if (!zoneCache || new Date(zoneCache.fetched_at) < sixHoursAgo) {
        try {
          const points = await getSeaTempForZone(seaZone)
          if (points.length > 0) {
            await supabase.from('env_data_cache').upsert({
              layer_type: seaKey,
              data: { points, zone: seaZone.id },
              fetched_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 172_800_000).toISOString(),
            })
            console.log(`[SeaTemp] Refreshed ${points.length} pts for ${seaZone.name}`)
          }
        } catch (err) {
          console.error(`[SeaTemp] Failed to refresh ${seaZone.name}:`, err)
        }
      }
    }

    // Merge all cached zones
    const { data: freshZones } = await supabase
      .from('env_data_cache').select('*').like('layer_type', 'sea_zone_%')

    const allSeaPoints: SeaTempPoint[] = []
    freshZones?.forEach((z: any) => {
      const d = z.data as { points: SeaTempPoint[] }
      if (d?.points) allSeaPoints.push(...d.points)
    })

    const coverage = Math.round((freshZones?.length ?? 0) / GLOBE_ZONES.length * 100)
    console.log(`[SeaTemp] Returning ${allSeaPoints.length} pts (${coverage}% coverage)`)

    const seaData: EnvLayerData = {
      type: 'sea_temp',
      updatedAt: now.toISOString(),
      seaTemp: allSeaPoints,
    }

    return NextResponse.json(
      { ...seaData, meta: { coverage: `${coverage}%`, zonesLoaded: freshZones?.length ?? 0, totalZones: GLOBE_ZONES.length } },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    )
  } catch (error) {
    console.error('[SeaTemp] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch sea temperature data' }, { status: 500 })
  }
}
