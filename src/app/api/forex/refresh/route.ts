import { NextRequest, NextResponse } from 'next/server'
import {
  MAJOR_PAIRS,
  getForexQuote,
  getForexTimeSeries,
  calculate24hChange,
  extractSparklineData,
} from '@/lib/forex/twelvedata'
import { updateForexPairCache, getForexPairFromCache } from '@/lib/forex/cache'

/**
 * GET /api/forex/refresh
 * Rotating forex refresh — updates ONE pair per call.
 *
 * Cron fires every 1 minute (vercel.json: "* * * * *")
 * Each pair gets updated once every 5 minutes (5 pairs × 1 min = 5-min cycle).
 *
 * Rotation logic:
 *   minute 0,5,10,15,20,25,30,35,40,45,50,55 → pair 0 (EUR/USD)
 *   minute 1,6,11,16,21,26,31,36,41,46,51,56 → pair 1 (GBP/USD)
 *   minute 2,7,12,17,22,27,32,37,42,47,52,57 → pair 2 (USD/JPY)
 *   minute 3,8,13,18,23,28,33,38,43,48,53,58 → pair 3 (AUD/USD)
 *   minute 4,9,14,19,24,29,34,39,44,49,54,59 → pair 4 (USD/CAD)
 *
 * API usage: 2 credits/call × 60 calls/hour × 24h = 2,880/day
 * But only 1 pair per call → 12 calls/pair/hour → well within 800/day free tier
 * (288 calls/day × 2 credits = 576 credits/day ✅)
 *
 * Protected by CRON_SECRET (Vercel) or ADMIN_SECRET (manual)
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const adminSecret = request.headers.get('x-admin-secret')

    if (
      cronSecret !== process.env.CRON_SECRET &&
      adminSecret !== process.env.ADMIN_SECRET
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Determine which pair to update this minute ──────────────────────
    // Use minute % MAJOR_PAIRS.length so each minute maps to exactly one pair
    const currentMinute = new Date().getMinutes()
    const pairIndex = currentMinute % MAJOR_PAIRS.length
    const pairToUpdate = MAJOR_PAIRS[pairIndex]

    console.log(`[Forex] Minute ${currentMinute} → updating pair ${pairIndex + 1}/${MAJOR_PAIRS.length}: ${pairToUpdate}`)

    // ── Check if this pair was updated recently (skip if < 4 minutes old) ──
    const cached = await getForexPairFromCache(pairToUpdate)
    if (cached) {
      const ageMs = Date.now() - new Date(cached.lastUpdated).getTime()
      const ageMin = ageMs / 60_000
      if (ageMin < 4) {
        console.log(`[Forex] ${pairToUpdate} updated ${ageMin.toFixed(1)}min ago — skipping`)
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `${pairToUpdate} is fresh (${ageMin.toFixed(1)}min old), skipping`,
          pair: pairToUpdate,
        })
      }
    }

    // ── Fetch quote (1 API credit) ──────────────────────────────────────
    const quote = await getForexQuote(pairToUpdate)
    console.log(`[Forex] Quote: ${pairToUpdate} = ${quote.close}`)

    // 10-second gap between the two API calls (rate limit safety)
    await new Promise((resolve) => setTimeout(resolve, 10_000))

    // ── Fetch 24h time series for sparkline (1 API credit) ─────────────
    const timeSeries = await getForexTimeSeries(pairToUpdate, '1h', 24)
    console.log(`[Forex] Time series: ${timeSeries.values.length} points`)

    const { change, changePercent } = calculate24hChange(timeSeries.values)
    const sparklineData = extractSparklineData(timeSeries.values)

    await updateForexPairCache(pairToUpdate, {
      currentPrice: parseFloat(quote.close),
      change24h: change,
      changePercent24h: changePercent,
      sparklineData,
    })

    console.log(`[Forex] ✅ Updated ${pairToUpdate}`)

    // Return current state of all pairs
    const allPairs = await Promise.all(
      MAJOR_PAIRS.map(async (pair) => {
        const c = await getForexPairFromCache(pair)
        return c ? {
          pair: c.pair,
          currentPrice: c.currentPrice,
          changePercent24h: c.changePercent24h,
          lastUpdated: c.lastUpdated,
          ageMinutes: Math.round((Date.now() - new Date(c.lastUpdated).getTime()) / 60_000),
        } : { pair, missing: true }
      })
    )

    return NextResponse.json({
      success: true,
      updated: pairToUpdate,
      nextPair: MAJOR_PAIRS[(pairIndex + 1) % MAJOR_PAIRS.length],
      allPairs,
    })
  } catch (error) {
    console.error('[Forex] Error:', error)
    return NextResponse.json(
      { error: 'Forex refresh failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
