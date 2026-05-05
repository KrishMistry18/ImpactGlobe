import { NextRequest, NextResponse } from 'next/server'
import { getForexTimeSeries, extractSparklineData } from '@/lib/forex/twelvedata'

/**
 * GET /api/forex/sparkline/[pair]
 * Get sparkline data for a specific forex pair
 * Returns 24 hours of hourly data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pair: string }> }
) {
  try {
    const { pair } = await params

    // Validate pair format (e.g., EUR-USD or EURUSD)
    const normalizedPair = pair.replace('-', '/').toUpperCase()

    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(normalizedPair)) {
      return NextResponse.json(
        { error: 'Invalid pair format. Use format: EUR-USD or EURUSD' },
        { status: 400 }
      )
    }

    // Fetch time series data
    const timeSeries = await getForexTimeSeries(normalizedPair, '1h', 24)

    // Extract sparkline data (close prices)
    const sparklineData = extractSparklineData(timeSeries.values)

    return NextResponse.json(
      {
        pair: normalizedPair,
        interval: '1h',
        dataPoints: sparklineData.length,
        data: sparklineData,
        meta: timeSeries.meta,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Sparkline API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch sparkline data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
