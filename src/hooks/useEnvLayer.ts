'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useGlobeStore } from '@/store/useGlobeStore'
import type { EnvLayerType, EnvLayerData } from '@/store/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Map layer type to API path */
function layerTypeToPath(type: EnvLayerType): string {
  switch (type) {
    case 'wind': return 'weather'
    case 'temperature_anomaly': return 'weather'
    case 'aqi': return 'aqi'
    case 'earthquakes': return 'earthquakes'
    case 'wildfires': return 'wildfires'
    case 'storms': return 'storms'
    case 'sea_temp': return 'sea-temp'
    default: return ''
  }
}

/**
 * Normal refresh intervals per layer type (ms).
 * These control how often we poll the API to pick up background-refreshed data.
 */
const REFRESH_INTERVALS: Record<EnvLayerType, number> = {
  none: 0,
  wind: 3600_000,             // 1 hour
  aqi: 1800_000,              // 30 minutes
  temperature_anomaly: 21600_000, // 6 hours
  earthquakes: 300_000,       // 5 minutes
  wildfires: 900_000,         // 15 minutes
  storms: 900_000,            // 15 minutes
  sea_temp: 86400_000,        // 24 hours
}

/**
 * Fetch environmental layer data and sync to Zustand store.
 *
 * The API routes now guarantee a complete (full-globe) response on every
 * request — they fetch any missing zones synchronously before responding.
 * No partial-data polling needed.
 */
export function useEnvLayer(layerType: EnvLayerType) {
  const setEnvLayerData = useGlobeStore((s) => s.setEnvLayerData)

  const path = layerTypeToPath(layerType)
  const endpoint = layerType === 'none' || !path ? null : `/api/env/${path}`

  const { data, isLoading, error } = useSWR<any>(
    endpoint,
    fetcher,
    {
      refreshInterval: (currentData) => {
        if (currentData && 'meta' in currentData && currentData.meta.refreshing) {
          return 5000; // Poll every 5s while background task runs
        }
        return REFRESH_INTERVALS[layerType];
      },

      // Show previous layer data while new layer data is loading — no blank flicker.
      keepPreviousData: true,

      // Don't refetch just because the user switched tabs
      revalidateOnFocus: false,

      // Deduplicate requests within a 2-second window
      dedupingInterval: 2_000,
    }
  )

  // Push data into the globe store whenever we get a successful response
  useEffect(() => {
    if (!data) return

    // Weather endpoint returns both wind and temp under separate keys
    if ('wind' in data && 'temperature_anomaly' in data) {
      if (layerType === 'wind') {
        setEnvLayerData((data as any).wind)
      } else if (layerType === 'temperature_anomaly') {
        setEnvLayerData((data as any).temperature_anomaly)
      }
    } else {
      setEnvLayerData(data as EnvLayerData)
    }
  }, [data, layerType, setEnvLayerData])

  return { isLoading, error }
}
