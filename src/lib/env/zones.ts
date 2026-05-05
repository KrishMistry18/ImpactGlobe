/**
 * Globe zone definitions for progressive environmental data loading
 * Divides the globe into 4 equal regions to avoid API timeouts and rate limits
 */

export interface GlobeZone {
  id: string
  name: string
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
  priority: number
}

export const GLOBE_ZONES: GlobeZone[] = [
  { id: 'zone-1', name: 'Zone 1: Americas',         latMin: -90, latMax: 90, lonMin: -180, lonMax: -90, priority: 1 },
  { id: 'zone-2', name: 'Zone 2: Atlantic & Africa', latMin: -90, latMax: 90, lonMin: -90,  lonMax: 0,   priority: 2 },
  { id: 'zone-3', name: 'Zone 3: Europe & Asia',     latMin: -90, latMax: 90, lonMin: 0,    lonMax: 90,  priority: 3 },
  { id: 'zone-4', name: 'Zone 4: Asia & Pacific',    latMin: -90, latMax: 90, lonMin: 90,   lonMax: 180, priority: 4 },
]

/**
 * Staggered zone rotation — each data type gets its own minute offset
 * so they never all fire at the same time and hammer the API.
 *
 * With 4 zones and 4 data types, the 16-minute cycle looks like:
 *
 * Minute mod 16 | 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
 * Wind zone     | 1  -  -  -  2  -  -  -  3  -  -  -  4  -  -  -
 * Temp zone     | -  1  -  -  -  2  -  -  -  3  -  -  -  4  -  -
 * AQI zone      | -  -  1  -  -  -  2  -  -  -  3  -  -  -  4  -
 * Sea temp zone | -  -  -  1  -  -  -  2  -  -  -  3  -  -  -  4
 *
 * Open-Meteo free tier: 600 req/min, 5000/hr, 10000/day
 * Wind:     ~65 req/zone × 4 zones = 260 req/cycle (every 16 min) = ~23,400/day ← needs caching!
 * Temp:     ~26 req/zone × 4 zones = 104 req/cycle                = ~9,360/day
 * Sea temp: ~26 req/zone × 4 zones = 104 req/cycle                = ~9,360/day
 * AQI:      OpenAQ — 1 req/zone (no rate limit issues)
 *
 * With 6-hour cache per zone, actual API calls drop to ~4 per day per layer. ✅
 */
export type EnvDataType = 'wind' | 'temp' | 'aqi' | 'sea_temp'

const TYPE_OFFSET: Record<EnvDataType, number> = {
  wind:     0,
  temp:     1,
  aqi:      2,
  sea_temp: 3,
}

/**
 * Get which zone to fetch RIGHT NOW for a given data type.
 * Returns null if this minute is not this type's turn.
 */
export function getZoneForType(type: EnvDataType): GlobeZone | null {
  const minute = new Date().getMinutes()
  const offset = TYPE_OFFSET[type]
  const stride = Object.keys(TYPE_OFFSET).length // 4

  // Only fire on minutes that belong to this type
  if ((minute - offset) % stride !== 0) return null

  // Which zone index (0-3) based on how many full cycles have passed
  const zoneIndex = Math.floor((minute - offset) / stride) % GLOBE_ZONES.length
  return GLOBE_ZONES[zoneIndex]
}

/**
 * Always returns a zone (for forced fetches / cache misses).
 * Uses the same rotation logic but ignores the minute check.
 */
export function getCurrentZoneForType(type: EnvDataType): GlobeZone {
  const minute = new Date().getMinutes()
  const offset = TYPE_OFFSET[type]
  const stride = Object.keys(TYPE_OFFSET).length
  const zoneIndex = Math.floor(Math.abs(minute - offset) / stride) % GLOBE_ZONES.length
  return GLOBE_ZONES[zoneIndex]
}

/** Legacy — kept for backward compat */
export function getCurrentZone(): GlobeZone {
  return getCurrentZoneForType('wind')
}

export function getZonesByPriority(): GlobeZone[] {
  return [...GLOBE_ZONES].sort((a, b) => a.priority - b.priority)
}

export function isPointInZone(lat: number, lon: number, zone: GlobeZone): boolean {
  if (zone.lonMin > zone.lonMax) {
    return lat >= zone.latMin && lat <= zone.latMax && (lon >= zone.lonMin || lon <= zone.lonMax)
  }
  return lat >= zone.latMin && lat <= zone.latMax && lon >= zone.lonMin && lon <= zone.lonMax
}

export function generateZoneGrid(
  zone: GlobeZone,
  resolution = 10
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = []
  const crossesMeridian = zone.lonMin > zone.lonMax

  if (crossesMeridian) {
    for (let lat = zone.latMin; lat <= zone.latMax; lat += resolution) {
      for (let lon = zone.lonMin; lon <= 180; lon += resolution) points.push({ lat, lon })
      for (let lon = -180; lon <= zone.lonMax; lon += resolution) points.push({ lat, lon })
    }
  } else {
    for (let lat = zone.latMin; lat <= zone.latMax; lat += resolution) {
      for (let lon = zone.lonMin; lon <= zone.lonMax; lon += resolution) {
        points.push({ lat, lon })
      }
    }
  }
  return points
}
