import type { EnvLayerType, EnvLayerData } from '@/store/types'

/**
 * In-memory environmental data cache with per-layer TTL.
 * Used as first-level cache before hitting Supabase env_data_cache table.
 */

interface CacheEntry {
  data: EnvLayerData
  expiresAt: number
}

const cache = new Map<EnvLayerType, CacheEntry>()

/** TTL in milliseconds per layer type */
const TTL: Record<EnvLayerType, number> = {
  none: 0,
  wind: 3600_000,             // 1 hour
  aqi: 1800_000,              // 30 minutes
  temperature_anomaly: 21600_000, // 6 hours
  earthquakes: 300_000,       // 5 minutes
  wildfires: 900_000,         // 15 minutes
  storms: 900_000,            // 15 minutes
  sea_temp: 86400_000,        // 24 hours
}

export function getCachedEnvData(layer: EnvLayerType): EnvLayerData | null {
  const entry = cache.get(layer)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(layer)
    return null
  }
  return entry.data
}

export function setCachedEnvData(layer: EnvLayerType, data: EnvLayerData): void {
  cache.set(layer, {
    data,
    expiresAt: Date.now() + TTL[layer],
  })
}
