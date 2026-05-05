import { NextRequest, NextResponse } from 'next/server'
import {
  MAJOR_PAIRS,
  getForexQuote,
  getForexTimeSeries,
  calculate24hChange,
  extractSparklineData,
} from '@/lib/forex/twelvedata'
import { updateForexPairsCacheBatch } from '@/lib/forex/cache'

/**
 * GET /api/forex/init
 * Initialize ALL forex pairs at once
 * Use this ONLY for initial setup or when cache is completely empty
 * 
 * WARNING: Uses 10 API credits (2 per pair × 5 pairs)
 * Protected by ADMIN_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin secret
    const adminSecret = request.headers.get('x-admin-secret')

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Forex Init] Initializing all forex pairs...')

    const results = []
    const errors = []

    // Fetch all pairs with delays between calls
    for (let i = 0; i < MAJOR_PAIRS.length; i++) {
      const pair = MAJOR_PAIRS[i]
      
      try {
        console.log(`[Forex Init] Fetching ${pair} (${i + 1}/${MAJOR_PAIRS.length})...`)
        
        // Fetch quote (1 API credit)
        const quote = await getForexQuote(pair)
        console.log(`[Forex Init] Quote fetched for ${pair}: ${quote.close}`)

        // Wait 10 seconds between calls to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 10000))

        // Fetch 24h time series (1 API credit)
        const timeSeries = await getForexTimeSeries(pair, '1h', 24)
        console.log(`[Forex Init] Time series fetched for ${pair}: ${timeSeries.values.length} points`)

        const { change, changePercent } = calculate24hChange(timeSeries.values)
        const sparklineData = extractSparklineData(timeSeries.values)

        results.push({
          pair,
          currentPrice: parseFloat(quote.close),
          change24h: change,
          changePercent24h: changePercent,
          sparklineData,
        })

        // Wait another 10 seconds before next pair
        if (i < MAJOR_PAIRS.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }
      } catch (error) {
        console.error(`[Forex Init] Failed to fetch ${pair}:`, error)
        errors.push({
          pair,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Update cache with all successfully fetched pairs
    if (results.length > 0) {
      await updateForexPairsCacheBatch(results)
      console.log(`[Forex Init] Successfully initialized ${results.length} pairs`)
    }

    return NextResponse.json({
      success: true,
      message: `Initialized ${results.length}/${MAJOR_PAIRS.length} pairs`,
      initialized: results.map(r => ({
        pair: r.pair,
        currentPrice: r.currentPrice,
        changePercent24h: r.changePercent24h,
      })),
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        totalPairs: MAJOR_PAIRS.length,
        successfulPairs: results.length,
        failedPairs: errors.length,
        apiCreditsUsed: results.length * 2,
      },
    })
  } catch (error) {
    console.error('[Forex Init] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Forex initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
