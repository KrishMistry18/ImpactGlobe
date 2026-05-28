import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

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
    const twoDaysAgo = new Date(Date.now() - 172800_000).toISOString() // 48 hours

    // Delete zone data older than 48 hours
    const snapshot = await adminDb.collection('env_data_cache')
      .where('fetched_at', '<', twoDaysAgo)
      .get()
      
    const batch = adminDb.batch()
    let count = 0
    snapshot.docs.forEach(doc => {
      if (doc.id.startsWith('wind_zone_') || doc.id.startsWith('temp_zone_') || doc.id.startsWith('aqi_zone_')) {
        batch.delete(doc.ref)
        count++
      }
    })

    if (count > 0) {
      await batch.commit()
    }

    console.log(`[Cleanup] Deleted ${count} environmental data entries older than 48 hours`)

    return NextResponse.json({
      success: true,
      message: 'Cleaned up old environmental data',
      deletedBefore: twoDaysAgo,
      count
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
