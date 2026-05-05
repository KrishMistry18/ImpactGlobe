/**
 * Sea Surface Temperature via Open-Meteo Marine API
 * Free, no API key required.
 * https://marine-api.open-meteo.com/v1/marine
 *
 * Rate limits (same as Open-Meteo weather):
 *   600 req/min · 5,000/hr · 10,000/day
 * With 6-hour zone caching we use ~4 calls/day per zone. ✅
 */

import axios from 'axios'
import type { SeaTempPoint } from '@/store/types'
import { type GlobeZone, generateZoneGrid } from './zones'

const BASE = 'https://marine-api.open-meteo.com/v1/marine'

/**
 * Fetch sea surface temperature for a zone.
 * Uses a 10° grid (coarser than wind) — oceans are large, fewer points needed.
 * Skips land points gracefully (marine API returns error for inland coords).
 */
export async function getSeaTempForZone(zone: GlobeZone): Promise<SeaTempPoint[]> {
  const points: SeaTempPoint[] = []
  const batchSize = 10

  // 10° resolution — enough for ocean coverage without hammering the API
  const coords = generateZoneGrid(zone, 10)

  console.log(`[SeaTemp] Fetching sea temp for zone: ${zone.name} (${coords.length} points)`)

  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize)
    const latitudes = batch.map((c) => c.lat).join(',')
    const longitudes = batch.map((c) => c.lon).join(',')

    try {
      const { data } = await axios.get(BASE, {
        params: {
          latitude: latitudes,
          longitude: longitudes,
          current: 'sea_surface_temperature',
          forecast_days: 1,
        },
        timeout: 12000,
      })

      // Handle single or multiple results
      const results = Array.isArray(data) ? data : [data]
      results.forEach((result: Record<string, unknown>, idx: number) => {
        const current = result.current as Record<string, number> | undefined
        // Marine API returns null for land points — skip them
        if (current?.sea_surface_temperature != null) {
          points.push({
            lat: batch[idx].lat,
            lon: batch[idx].lon,
            tempC: current.sea_surface_temperature,
          })
        }
      })
    } catch {
      // Silently skip failed batches (land points cause 400 errors)
    }

    // 1-second delay between batches — stays well under 600 req/min
    if (i + batchSize < coords.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  console.log(`[SeaTemp] Fetched ${points.length} sea temp points for ${zone.name}`)
  return points
}
