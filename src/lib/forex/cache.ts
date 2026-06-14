import { adminDb } from '@/lib/firebase/admin'
import type { ForexPair } from '@/store/types'

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

export async function getForexPairFromCache(pair: string): Promise<ForexPair | null> {
  try {
    const doc = await adminDb.collection('forex_cache').doc(pair.replace('/', '_')).get()
    
    if (!doc.exists) return null
    
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
    return null
  }
}

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
    await adminDb.collection('forex_cache').doc(pair.replace('/', '_')).set({
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
      const ref = adminDb.collection('forex_cache').doc(p.pair.replace('/', '_'))
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

export async function getTopMovers(limit = 5): Promise<ForexPair[]> {
  try {
    const snapshot = await adminDb.collection('forex_cache').get()
    
    return snapshot.docs
      .map(doc => {
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
      .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
      .slice(0, limit)
  } catch (error) {
    console.error('Failed to fetch top movers:', error)
    return []
  }
}

export async function linkForexPairToEvent(
  pair: string,
  eventId: string
): Promise<void> {
  try {
    await adminDb.collection('forex_cache').doc(pair.replace('/', '_')).update({
      driving_event_id: eventId
    })
  } catch (error) {
    console.error(`Failed to link ${pair} to event ${eventId}:`, error)
    throw error
  }
}

export async function isCacheStale(thresholdMinutes = 5): Promise<boolean> {
  try {
    const snapshot = await adminDb.collection('forex_cache')
      .orderBy('last_updated', 'desc')
      .limit(1)
      .get()
      
    if (snapshot.empty) return true
    
    const lastUpdated = new Date(snapshot.docs[0].data().last_updated)
    const diffMinutes = (Date.now() - lastUpdated.getTime()) / 60000
    
    return diffMinutes > thresholdMinutes
  } catch (error) {
    return true
  }
}
