'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useGlobeStore } from '@/store/useGlobeStore'
import type { EnvLayerType, EnvLayerData } from '@/store/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

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

/** Refresh intervals per layer type (ms) */
const REFRESH_INTERVALS: Record<EnvLayerType, number> = {
  none: 0,
  wind: 3600_000,
  aqi: 1800_000,
  temperature_anomaly: 21600_000,
  earthquakes: 300_000,
  wildfires: 900_000,
  storms: 900_000,
  sea_temp: 86400_000,
}

/** Fetch environmental layer data and sync to Zustand store */
export function useEnvLayer(layerType: EnvLayerType) {
  const setEnvLayerData = useGlobeStore((s) => s.setEnvLayerData)

  const path = layerTypeToPath(layerType)
  // Include layerType in the SWR key so wind vs temperature_anomaly are
  // treated as distinct cache entries even though they share the same endpoint.
  // This ensures the useEffect fires when switching between the two.
  const swrKey = layerType === 'none' || !path
    ? null
    : [`/api/env/${path}`, layerType]

  const { data, isLoading, error } = useSWR<any>(
    swrKey,
    // SWR passes the full key array — we only need the URL (first element)
    ([url]: [string]) => fetcher(url),
    {
      refreshInterval: REFRESH_INTERVALS[layerType],
      revalidateOnFocus: false,
      onErrorRetry: (err, _key, _cfg, revalidate, { retryCount }) => {
        if (retryCount >= 3) return
        setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1))
      },
    }
  )

  useEffect(() => {
    if (!data) return

    // Weather endpoint returns both wind and temp under separate keys
    if ('wind' in data && 'temperature_anomaly' in data) {
      if (layerType === 'wind') {
        setEnvLayerData((data as any).wind as EnvLayerData)
      } else if (layerType === 'temperature_anomaly') {
        setEnvLayerData((data as any).temperature_anomaly as EnvLayerData)
      }
      return
    }

    // All other endpoints return EnvLayerData directly — strip meta field
    const { meta: _meta, ...layerData } = data as any
    setEnvLayerData(layerData as EnvLayerData)
  }, [data, layerType, setEnvLayerData])

  useEffect(() => {
    if (error) {
      console.error(`[useEnvLayer] Failed to fetch ${layerType}:`, error)
    }
  }, [error, layerType])

  return { isLoading, error }
}
