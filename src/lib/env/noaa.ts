import axios from 'axios'

const ALERTS_URL = 'https://api.weather.gov/alerts/active'

export interface NOAAAlert {
  id: string
  headline: string
  severity: string
  event: string
  areaDesc: string
  onset: string
  expires: string
}

/**
 * Fetch active weather alerts from NOAA (US only).
 */
export async function getActiveAlerts(): Promise<NOAAAlert[]> {
  try {
    const { data } = await axios.get(ALERTS_URL, {
      params: { status: 'actual', message_type: 'alert' },
      headers: {
        'User-Agent': 'ImpactGlobe/1.0 (contact@impactglobe.app)',
        'Accept': 'application/geo+json',
      },
      timeout: 10000,
    })

    if (!data?.features) return []

    return data.features
      .slice(0, 50)
      .map((f: {
        properties: {
          id: string
          headline: string
          severity: string
          event: string
          areaDesc: string
          onset: string
          expires: string
        }
      }) => ({
        id: f.properties.id,
        headline: f.properties.headline || f.properties.event,
        severity: f.properties.severity,
        event: f.properties.event,
        areaDesc: f.properties.areaDesc,
        onset: f.properties.onset,
        expires: f.properties.expires,
      }))
  } catch {
    return []
  }
}
