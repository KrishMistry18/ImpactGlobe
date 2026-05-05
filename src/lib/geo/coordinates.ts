import * as THREE from 'three'

/** Country name → approximate centroid coordinates */
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'United States': { lat: 39.8283, lon: -98.5795 },
  'United Kingdom': { lat: 55.3781, lon: -3.436 },
  'China': { lat: 35.8617, lon: 104.1954 },
  'Japan': { lat: 36.2048, lon: 138.2529 },
  'Germany': { lat: 51.1657, lon: 10.4515 },
  'France': { lat: 46.2276, lon: 2.2137 },
  'India': { lat: 20.5937, lon: 78.9629 },
  'Brazil': { lat: -14.235, lon: -51.9253 },
  'Russia': { lat: 61.524, lon: 105.3188 },
  'Australia': { lat: -25.2744, lon: 133.7751 },
  'Canada': { lat: 56.1304, lon: -106.3468 },
  'South Korea': { lat: 35.9078, lon: 127.7669 },
  'Mexico': { lat: 23.6345, lon: -102.5528 },
  'Indonesia': { lat: -0.7893, lon: 113.9213 },
  'Turkey': { lat: 38.9637, lon: 35.2433 },
  'Saudi Arabia': { lat: 23.8859, lon: 45.0792 },
  'Switzerland': { lat: 46.8182, lon: 8.2275 },
  'Nigeria': { lat: 9.082, lon: 8.6753 },
  'South Africa': { lat: -30.5595, lon: 22.9375 },
  'Argentina': { lat: -38.4161, lon: -63.6167 },
  'Italy': { lat: 41.8719, lon: 12.5674 },
  'Spain': { lat: 40.4637, lon: -3.7492 },
  'Poland': { lat: 51.9194, lon: 19.1451 },
  'Ukraine': { lat: 48.3794, lon: 31.1656 },
  'Israel': { lat: 31.0461, lon: 34.8516 },
  'Iran': { lat: 32.4279, lon: 53.688 },
  'Egypt': { lat: 26.8206, lon: 30.8025 },
  'Taiwan': { lat: 23.6978, lon: 120.9605 },
  'Singapore': { lat: 1.3521, lon: 103.8198 },
  'Hong Kong': { lat: 22.3193, lon: 114.1694 },
  'Norway': { lat: 60.472, lon: 8.4689 },
  'Sweden': { lat: 60.1282, lon: 18.6435 },
  'Netherlands': { lat: 52.1326, lon: 5.2913 },
  'Belgium': { lat: 50.5039, lon: 4.4699 },
  'Austria': { lat: 47.5162, lon: 14.5501 },
  'Greece': { lat: 39.0742, lon: 21.8243 },
  'Portugal': { lat: 39.3999, lon: -8.2245 },
  'Denmark': { lat: 56.2639, lon: 9.5018 },
  'Finland': { lat: 61.9241, lon: 25.7482 },
  'Ireland': { lat: 53.1424, lon: -7.6921 },
  'New Zealand': { lat: -40.9006, lon: 174.886 },
  'Thailand': { lat: 15.87, lon: 100.9925 },
  'Vietnam': { lat: 14.0583, lon: 108.2772 },
  'Philippines': { lat: 12.8797, lon: 121.774 },
  'Malaysia': { lat: 4.2105, lon: 101.9758 },
  'Colombia': { lat: 4.5709, lon: -74.2973 },
  'Chile': { lat: -35.6751, lon: -71.543 },
  'Peru': { lat: -9.19, lon: -75.0152 },
  'Pakistan': { lat: 30.3753, lon: 69.3451 },
  'Bangladesh': { lat: 23.685, lon: 90.3563 },
}

/** Convert lat/lon to THREE.Vector3 on a sphere of given radius */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius = 1
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  return new THREE.Vector3(x, y, z)
}

/** Inverse of latLonToVector3 — convert a THREE.Vector3 back to lat/lon */
export function vector3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const radius = v.length()
  if (radius === 0) return { lat: 0, lon: 0 }

  const lat = 90 - Math.acos(v.y / radius) * (180 / Math.PI)
  const lon = -(Math.atan2(v.z, -v.x) * (180 / Math.PI)) - 180

  // Normalize longitude to [-180, 180]
  const normalizedLon = ((lon + 540) % 360) - 180

  return { lat, lon: normalizedLon }
}

/**
 * Calculate the sub-solar point (lat/lon where the sun is directly overhead)
 * for a given date. Used for day/night terminator rendering on the globe.
 */
export function sunPosition(date: Date): { lat: number; lon: number } {
  // Day of year (1-365)
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)

  // Solar declination (approximate) — angle of sun above/below equator
  // Max +23.44° at summer solstice (day ~172), min -23.44° at winter solstice
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))

  // Hour angle — based on UTC time, the sun is at 0° longitude at 12:00 UTC
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const solarLon = (12 - hours) * 15 // 15° per hour, noon = 0° offset

  // Normalize to [-180, 180]
  const normalizedLon = ((solarLon + 540) % 360) - 180

  return { lat: declination, lon: normalizedLon }
}

/** Get coordinates for a country name. Falls back to 0,0 if unknown. */
export function getCountryCoords(country: string): { lat: number; lon: number } {
  return COUNTRY_COORDS[country] ?? { lat: 0, lon: 0 }
}

/** Get all country coordinate entries */
export function getAllCountryCoords() {
  return COUNTRY_COORDS
}
