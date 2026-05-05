import axios from 'axios'
import type { EarthquakeEvent } from '@/store/types'

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'

/**
 * Fetch recent earthquakes (M2.5+) from USGS GeoJSON feed.
 * Returns sorted by magnitude descending.
 */
export async function getRecentEarthquakes(): Promise<EarthquakeEvent[]> {
  try {
    const { data } = await axios.get(FEED_URL, { timeout: 10000 })

    if (!data?.features) return []

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    return data.features
      .filter((f: { properties: { mag: number; time: number } }) =>
        f.properties.mag >= 2.5 && f.properties.time >= oneDayAgo
      )
      .map((f: {
        id: string
        properties: { mag: number; place: string; time: number; url: string }
        geometry: { coordinates: number[] }
      }) => ({
        id: f.id,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        magnitude: f.properties.mag,
        depth: f.geometry.coordinates[2] ?? 0,
        location: f.properties.place || 'Unknown',
        time: new Date(f.properties.time).toISOString(),
        url: f.properties.url || '',
      }))
      .sort((a: EarthquakeEvent, b: EarthquakeEvent) => b.magnitude - a.magnitude)
  } catch {
    return []
  }
}
