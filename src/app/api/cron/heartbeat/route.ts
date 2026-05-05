import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cron/heartbeat
 * Local development cron simulator.
 * Called by the browser every minute via useEffect in the app.
 * In production, Vercel crons handle this automatically.
 *
 * Fires all cron jobs based on current time:
 * - Forex refresh: every minute (minute % 5 determines which pair)
 * - RSS poll: every 10 minutes (skips if Gemini cache < 4h)
 * - Earthquakes: every 5 minutes
 * - Wildfires: every 15 minutes
 * - AQI: every 30 minutes
 * - Weather: every 60 minutes
 * - Sea temp: every 360 minutes (6 hours)
 */
export async function GET(request: NextRequest) {
  // Only allow in development or with admin secret
  const adminSecret = request.headers.get('x-admin-secret')
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const minute = now.getMinutes()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || ''
  const headers = { 'x-cron-secret': cronSecret }

  const jobs: { name: string; url: string; shouldRun: boolean }[] = [
    {
      name: 'forex-refresh',
      url: `${appUrl}/api/forex/refresh`,
      shouldRun: true, // every minute
    },
    {
      name: 'news-gemini',
      url: `${appUrl}/api/news/gemini`,
      // Fire every minute — the route's own 2-min retry gap and 4-hour
      // success cadence control actual Gemini API call frequency.
      // This lets retries land automatically without waiting an hour.
      shouldRun: true,
    },
    {
      name: 'earthquakes',
      url: `${appUrl}/api/env/earthquakes`,
      shouldRun: minute % 5 === 0,
    },
    {
      name: 'wildfires',
      url: `${appUrl}/api/env/wildfires`,
      shouldRun: minute % 15 === 0,
    },
    {
      name: 'aqi',
      url: `${appUrl}/api/env/aqi`,
      shouldRun: minute % 30 === 0,
    },
    {
      name: 'weather',
      url: `${appUrl}/api/env/weather`,
      shouldRun: minute === 0,
    },
    {
      name: 'sea-temp',
      url: `${appUrl}/api/env/sea-temp`,
      shouldRun: minute === 0 && now.getHours() % 6 === 0,
    },
    {
      name: 'cleanup',
      url: `${appUrl}/api/cron/cleanup`,
      // Run every 30 minutes to keep data fresh
      shouldRun: minute % 30 === 0,
    },
  ]

  const triggered: string[] = []

  // Fire all due jobs in parallel (non-blocking)
  await Promise.allSettled(
    jobs
      .filter((j) => j.shouldRun)
      .map(async (job) => {
        try {
          await fetch(job.url, { headers })
          triggered.push(job.name)
        } catch {
          // Silently ignore — job will retry next cycle
        }
      })
  )

  return NextResponse.json({
    ok: true,
    minute,
    triggered,
    skipped: jobs.filter((j) => !j.shouldRun).map((j) => j.name),
  })
}
