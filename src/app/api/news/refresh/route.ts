import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchNewsDataEvents } from '@/lib/news/newsdata'

/**
 * GET /api/news/refresh
 * Insert fresh events from NewsData.io stamped with current time.
 * OLD events are NOT deleted — they live until their expires_at (48h).
 * This gives the globe a mix of fresh (minutes ago) and older (hours ago) events
 * spread across the 48h window, exactly as the user wants.
 *
 * 1-hour cache guard: skips the NewsData.io API call if we already inserted
 * events in the last 55 minutes (respects 200 req/day limit).
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 55 * 60 * 1000).toISOString()

  // ── 1h cache guard ────────────────────────────────────────────────────────
  const { count: recentCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', 'ai-auto')
    .gte('created_at', oneHourAgo)

  if (recentCount && recentCount > 0) {
    console.log(`[News Refresh] Skipping — ${recentCount} events inserted in last 55 min`)
    return NextResponse.json({
      success: true,
      skipped: true,
      message: `Cache active — ${recentCount} fresh events already in DB`,
    })
  }

  // ── Fetch fresh events from NewsData.io ───────────────────────────────────
  console.log('[News Refresh] Fetching from NewsData.io...')
  const newEvents = await fetchNewsDataEvents()
  console.log(`[News Refresh] Got ${newEvents.length} events from NewsData.io`)

  if (newEvents.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No events from NewsData.io (check NEWSDATA_API_KEY)',
      created: 0,
    })
  }

  // ── Dedup: skip articles already in DB (check last 48h by source_url/headline) ──
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const { data: existingEvents } = await supabase
    .from('events')
    .select('source_url, headline')
    .gte('created_at', twoDaysAgo)

  const existingUrls = new Set(
    existingEvents?.map((e: any) => e.source_url).filter(Boolean) ?? []
  )
  const existingHeadlines = new Set(
    existingEvents?.map((e: any) => e.headline.toLowerCase().slice(0, 50)) ?? []
  )

  const toInsert = newEvents.filter((e) => {
    if (e.sourceUrl && existingUrls.has(e.sourceUrl)) return false
    if (existingHeadlines.has(e.headline.toLowerCase().slice(0, 50))) return false
    if (Math.abs(e.lat) < 0.1 && Math.abs(e.lon) < 0.1) return false
    return true
  })

  console.log(`[News Refresh] ${toInsert.length} new events after dedup`)

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'All events already in database',
      created: 0,
    })
  }

  // Cap at 20 per cycle
  const capped = toInsert.slice(0, 20)

  // ── Insert with current timestamp ─────────────────────────────────────────
  const rows = capped.map((e) => ({
    headline: e.headline,
    country: e.country,
    lat: e.lat,
    lon: e.lon,
    impact_level: e.impactLevel,
    category: e.category,
    summary: e.summary,
    sentiment: e.sentiment,
    forex_impacts: e.forexImpacts,
    confidence_score: e.confidenceScore,
    is_market_moving: e.isMarketMoving,
    published_at: e.publishedAt, // stamped with NOW by newsdata.ts
    expires_at: e.expiresAt,
    source_url: e.sourceUrl || null,
    created_by: 'ai-auto' as const,
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from('events')
    .insert(rows)
    .select('id, headline, impact_level')

  if (insertErr) {
    console.error('[News Refresh] Insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[News Refresh] ✅ Inserted ${inserted?.length ?? 0} fresh events`)

  return NextResponse.json({
    success: true,
    message: `Inserted ${inserted?.length ?? 0} fresh events`,
    created: inserted?.length ?? 0,
    events: inserted?.map((e: any) => ({
      id: e.id,
      headline: e.headline,
      impactLevel: e.impact_level,
    })),
  })
}
