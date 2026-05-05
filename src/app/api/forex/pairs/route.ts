import { NextResponse } from 'next/server'
import { getCachedForexPairs, getTopMovers } from '@/lib/forex/cache'

/**
 * GET /api/forex/pairs
 * Fetch forex pairs data (cached)
 * Query params:
 *   - top: number (optional) - Get top N movers only
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const topParam = searchParams.get('top')

    let pairs

    if (topParam) {
      const limit = parseInt(topParam, 10)
      if (isNaN(limit) || limit < 1 || limit > 20) {
        return NextResponse.json(
          { error: 'Invalid top parameter (must be 1-20)' },
          { status: 400 }
        )
      }
      pairs = await getTopMovers(limit)
    } else {
      pairs = await getCachedForexPairs()
    }

    return NextResponse.json(pairs, {
      headers: {
        // No CDN caching — forex data changes every minute, always serve fresh
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Forex pairs API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch forex pairs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
