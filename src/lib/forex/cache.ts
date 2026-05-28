import { adminDb } from '@/lib/firebase/admin'
import type { ForexPair } from '@/store/types'

/**
 * Forex data cache management
 * Stores forex pair data in Firestore for fast retrieval
 */

/**
 * Get cached forex pairs from database
 */
export async function getCachedForexPairs(): Promise<ForexPair[]> {
  try {
    const snapshot = await adminDb.collection('forex_cache')
      .orderBy('change_percent_24h', 'desc')
      .get()

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        pair: data.pair,
        currentPrice: Number(data.current_price),
        change24h: Number(data.change_24h),
        changePercent24h: Number(data.change_percent_24h),
        sparklineData: Array.isArray(data.sparkline_data) ? data.sparkline_data : [],
        drivingEventId: data.driving_event_id || undefined,
        lastUpdated: data.last_updated,
      }
    })
  } catch (error) {
    console.error('Failed to fetch cached forex pairs:', error)
    return []
  }
}

/**
 * Get a single cached forex pair from database
 */
export async function getForexPairFromCache(pair: string): Promise<ForexPair | null> {
  try {
    const docRef = adminDb.collection('forex_cache').doc(pair.replace('/', '_'))
    const doc = await docRef.get()

    if (!doc.exists) {
      return null
    }

    const data = doc.data()!
    return {
      pair: data.pair,
      currentPrice: Number(data.current_price),
      change24h: Number(data.change_24h),
      changePercent24h: Number(data.change_percent_24h),
      sparklineData: Array.isArray(data.sparkline_data) ? data.sparkline_data : [],
      drivingEventId: data.driving_event_id || undefined,
      lastUpdated: data.last_updated,
    }
  } catch (error) {
    console.error(`Failed to fetch forex pair ${pair}:`, error)
    return null
  }
}

/**
 * Update forex pair in cache
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
  try {
    const docId = pair.replace('/', '_')
    await adminDb.collection('forex_cache').doc(docId).set({
      pair,
      current_price: data.currentPrice,
      change_24h: data.change24h,
      change_percent_24h: data.changePercent24h,
      sparkline_data: data.sparklineData,
      driving_event_id: data.drivingEventId || null,
      last_updated: new Date().toISOString(),
    }, { merge: true })
  } catch (error) {
    console.error(`Failed to update forex cache for ${pair}:`, error)
    throw error
  }
}

/**
 * Update multiple forex pairs in cache (batch)
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
  try {
    const batch = adminDb.batch()

    pairs.forEach(p => {
      const docId = p.pair.replace('/', '_')
      const ref = adminDb.collection('forex_cache').doc(docId)
      batch.set(ref, {
        pair: p.pair,
        current_price: p.currentPrice,
        change_24h: p.change24h,
        change_percent_24h: p.changePercent24h,
        sparkline_data: p.sparklineData,
        driving_event_id: p.drivingEventId || null,
        last_updated: new Date().toISOString(),
      }, { merge: true })
    })

    await batch.commit()
  } catch (error) {
    console.error('Failed to batch update forex cache:', error)
    throw error
  }
}

/**
 * Get top N movers (by absolute change percent)
 */
export async function getTopMovers(limit = 5): Promise<ForexPair[]> {
  try {
    const snapshot = await adminDb.collection('forex_cache').get()

    const pairs = snapshot.docs
      .map((doc) => {
        const row = doc.data()
        return {
          pair: row.pair,
          currentPrice: Number(row.current_price),
          change24h: Number(row.change_24h),
          changePercent24h: Number(row.change_percent_24h),
          sparklineData: Array.isArray(row.sparkline_data) ? row.sparkline_data : [],
          drivingEventId: row.driving_event_id || undefined,
          lastUpdated: row.last_updated,
        }
      })
      .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
      .slice(0, limit)

    return pairs
  } catch (error) {
    console.error('Failed to fetch top movers:', error)
    return []
  }
}

/**
 * Link a forex pair to a driving event
 */
export async function linkForexPairToEvent(
  pair: string,
  eventId: string
): Promise<void> {
  try {
    const docId = pair.replace('/', '_')
    await adminDb.collection('forex_cache').doc(docId).update({
      driving_event_id: eventId
    })
  } catch (error) {
    console.error(`Failed to link ${pair} to event ${eventId}:`, error)
    throw error
  }
}

/**
 * Check if cache is stale (older than threshold)
 */
export async function isCacheStale(thresholdMinutes = 5): Promise<boolean> {
  try {
    const snapshot = await adminDb.collection('forex_cache')
      .orderBy('last_updated', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) {
      return true // No data = stale
    }

    const data = snapshot.docs[0].data()
    const lastUpdated = new Date(data.last_updated)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60)

    return diffMinutes > thresholdMinutes
  } catch (error) {
    console.error('Failed to check if cache is stale:', error)
    return true // Assume stale on error
  }
}
