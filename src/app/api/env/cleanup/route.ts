import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/env/cleanup
 * Delete environmental data older than 48 hours
 * Should be called by cron job once per day
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const twoDaysAgo = new Date(Date.now() - 172800_000) // 48 hours

    // Delete zone data older than 48 hours
    const { data, error } = await supabase
      .from('env_data_cache')
      .delete()
      .or('layer_type.like.wind_zone_%,layer_type.like.temp_zone_%,layer_type.like.aqi_zone_%')
      .lt('fetched_at', twoDaysAgo.toISOString())

    if (error) {
      console.error('[Cleanup] Error deleting old data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Cleanup] Deleted environmental data older than 48 hours`)

    return NextResponse.json({
      success: true,
      message: 'Cleaned up old environmental data',
      deletedBefore: twoDaysAgo.toISOString(),
    })
  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup old data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
