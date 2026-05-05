import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/rss/trigger
 * Manually trigger a news poll (no auth required — just fires the poll)
 * Used by the frontend to kick off a poll when the page loads with no events
 */
export async function GET(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET || ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Fire the poll in the background
    const pollUrl = `${appUrl}/api/rss/poll`

    // Non-blocking: don't await, just trigger
    fetch(pollUrl, {
      headers: { 'x-admin-secret': adminSecret },
    }).catch((err) => {
      console.error('[RSS Trigger] Failed to trigger poll:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'News poll triggered. Events will appear within 1-2 minutes.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to trigger poll' },
      { status: 500 }
    )
  }
}
