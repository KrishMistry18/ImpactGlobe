import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ForexPair } from '@/store/types'

/**
 * Forex data cache management
 * Stores forex pair data in Supabase for fast retrieval
 */

/**
 * Get cached forex pairs from database
 */
export async function getCachedForexPairs(): Promise<ForexPair[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('forex_cache')
    .select('*')
    .order('change_percent_24h', { ascending: false })

  if (error) {
    console.error('Failed to fetch cached forex pairs:', error)
    return []
  }

  return data.map((row) => ({
    pair: row.pair,
    currentPrice: Number(row.current_price),
    change24h: Number(row.change_24h),
    changePercent24h: Number(row.change_percent_24h),
    sparklineData: Array.isArray(row.sparkline_data) ? row.sparkline_data : [],
    drivingEventId: row.driving_event_id || undefined,
    lastUpdated: row.last_updated,
  }))
}

/**
 * Get a single cached forex pair from database
 */
export async function getForexPairFromCache(pair: string): Promise<ForexPair | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('forex_cache')
    .select('*')
    .eq('pair', pair)
    .single()

  if (error || !data) {
    return null
  }

  return {
    pair: data.pair,
    currentPrice: Number(data.current_price),
    change24h: Number(data.change_24h),
    changePercent24h: Number(data.change_percent_24h),
    sparklineData: Array.isArray(data.sparkline_data) ? data.sparkline_data : [],
    drivingEventId: data.driving_event_id || undefined,
    lastUpdated: data.last_updated,
  }
}

/**
 * Update forex pair in cache (uses admin client to bypass RLS)
 */
export async function updateForexPairCache(
  pair: string,
  data: {
    currentPrice: number
    change24h: number
    changePercent24h: number
    sparklineData: number[]
    drivingEventId?: string
  }
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('forex_cache')
    .upsert({
      pair,
      current_price: data.currentPrice,
      change_24h: data.change24h,
      change_percent_24h: data.changePercent24h,
      sparkline_data: data.sparklineData,
      driving_event_id: data.drivingEventId || null,
      last_updated: new Date().toISOString(),
    })

  if (error) {
    console.error(`Failed to update forex cache for ${pair}:`, error)
    throw error
  }
}

/**
 * Update multiple forex pairs in cache (batch) (uses admin client to bypass RLS)
 */
export async function updateForexPairsCacheBatch(
  pairs: Array<{
    pair: string
    currentPrice: number
    change24h: number
    changePercent24h: number
    sparklineData: number[]
    drivingEventId?: string
  }>
): Promise<void> {
  const supabase = createAdminClient()

  const rows = pairs.map((p) => ({
    pair: p.pair,
    current_price: p.currentPrice,
    change_24h: p.change24h,
    change_percent_24h: p.changePercent24h,
    sparkline_data: p.sparklineData,
    driving_event_id: p.drivingEventId || null,
    last_updated: new Date().toISOString(),
  }))

  const { error } = await supabase.from('forex_cache').upsert(rows)

  if (error) {
    console.error('Failed to batch update forex cache:', error)
    throw error
  }
}

/**
 * Get top N movers (by absolute change percent)
 */
export async function getTopMovers(limit = 5): Promise<ForexPair[]> {
  const supabase = await createClient()

  // Get all pairs and sort by absolute change percent in memory
  // (Supabase doesn't support ORDER BY abs() directly)
  const { data, error } = await supabase
    .from('forex_cache')
    .select('*')

  if (error) {
    console.error('Failed to fetch top movers:', error)
    return []
  }

  const pairs = data
    .map((row) => ({
      pair: row.pair,
      currentPrice: Number(row.current_price),
      change24h: Number(row.change_24h),
      changePercent24h: Number(row.change_percent_24h),
      sparklineData: Array.isArray(row.sparkline_data) ? row.sparkline_data : [],
      drivingEventId: row.driving_event_id || undefined,
      lastUpdated: row.last_updated,
    }))
    .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
    .slice(0, limit)

  return pairs
}

/**
 * Link a forex pair to a driving event
 */
export async function linkForexPairToEvent(
  pair: string,
  eventId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('forex_cache')
    .update({ driving_event_id: eventId })
    .eq('pair', pair)

  if (error) {
    console.error(`Failed to link ${pair} to event ${eventId}:`, error)
    throw error
  }
}

/**
 * Check if cache is stale (older than threshold)
 */
export async function isCacheStale(thresholdMinutes = 5): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('forex_cache')
    .select('last_updated')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return true // No data = stale
  }

  const lastUpdated = new Date(data.last_updated)
  const now = new Date()
  const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60)

  return diffMinutes > thresholdMinutes
}
