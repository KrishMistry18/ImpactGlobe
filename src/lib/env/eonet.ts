import axios from 'axios'
import type { WildfireEvent, StormEvent } from '@/store/types'

const BASE = 'https://eonet.gsfc.nasa.gov/api/v3'

/**
 * Fetch active wildfires from NASA EONET.
 * Takes the first geometry coordinate for each event.
 */
export async function getWildfires(): Promise<WildfireEvent[]> {
  try {
    const { data } = await axios.get(`${BASE}/events`, {
      params: {
        category: 'wildfires',
        status: 'open',
        limit: 50,
      },
      timeout: 15000,
    })

    if (!data?.events) return []

    return data.events
      .filter((e: { geometry: Array<{ coordinates: number[] }> }) =>
        e.geometry?.length > 0
      )
      .map((e: {
        id: string
        title: string
        geometry: Array<{ date: string; coordinates: number[] }>
        sources: Array<{ url: string }>
      }) => ({
        id: e.id,
        lat: e.geometry[0].coordinates[1],
        lon: e.geometry[0].coordinates[0],
        title: e.title,
        date: e.geometry[0].date || new Date().toISOString(),
        source: e.sources?.[0]?.url || 'NASA EONET',
      }))
  } catch {
    return []
  }
}

/**
 * Fetch active severe storms from NASA EONET.
 */
export async function getStorms(): Promise<StormEvent[]> {
  try {
    const { data } = await axios.get(`${BASE}/events`, {
      params: {
        category: 'severeStorms',
        status: 'open',
        limit: 30,
      },
      timeout: 15000,
    })

    if (!data?.events) return []

    return data.events
      .filter((e: { geometry: Array<{ coordinates: number[] }> }) =>
        e.geometry?.length > 0
      )
      .map((e: {
        id: string
        title: string
        categories: Array<{ title: string }>
        geometry: Array<{ date: string; coordinates: number[] }>
      }) => ({
        id: e.id,
        lat: e.geometry[0].coordinates[1],
        lon: e.geometry[0].coordinates[0],
        title: e.title,
        category: e.categories?.[0]?.title,
        date: e.geometry[0].date || new Date().toISOString(),
      }))
  } catch {
    return []
  }
}
