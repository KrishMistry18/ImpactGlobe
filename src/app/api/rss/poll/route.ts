import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseMultipleFeeds, filterNewItems, deduplicateItems } from '@/lib/rss/parser'
import { DEFAULT_RSS_SOURCES } from '@/lib/rss/sources'
import { analyzeWithGemini } from '@/lib/gemini/client'

/**
 * GET /api/rss/poll
 * Poll RSS feeds → analyze with Gemini → store events.
 *
 * Guards:
 * - Skips if events were created < 4 hours ago (saves Gemini quota)
 * - Gracefully returns 200 (not 500) when Gemini is rate limited
 * - Confidence score stored as integer 0-100 (matches DB schema)
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const adminSecret = request.headers.get('x-admin-secret')
    const isDev = process.env.NODE_ENV === 'development'

    if (!isDev && cronSecret !== process.env.CRON_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()

    // ── 1-hour cache guard — skip Gemini if we already have recent events ──
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
    const { data: recent, count } = await supabase
      .from('events')
      .select('id, created_at', { count: 'exact' })
      .gte('created_at', oneHourAgo)
      .limit(1)

    if (count && count > 0 && recent?.[0]) {
      const ageMin = Math.round((now.getTime() - new Date(recent[0].created_at).getTime()) / 60_000)
      console.log(`[RSS Poll] Skipping — events created ${ageMin}min ago (1h cache active)`)
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Events created ${ageMin}min ago — Gemini skipped (1h cache).`,
      })
    }

    // ── Fetch RSS feeds ────────────────────────────────────────────────────
    const { data: dbSources } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('is_active', true)

    const sources = dbSources?.length
      ? dbSources.map((s: any) => ({ name: s.name, url: s.url }))
      : DEFAULT_RSS_SOURCES

    console.log(`[RSS Poll] Polling ${sources.length} sources...`)
    const feeds = await parseMultipleFeeds(sources.map((s: { url: string }) => s.url))
    console.log(`[RSS Poll] Parsed ${feeds.length} feeds`)

    let allItems = feeds.flatMap((f) => f.items)
    allItems = filterNewItems(allItems, new Date(now.getTime() - 6 * 60 * 60 * 1000))
    allItems = deduplicateItems(allItems)

    if (allItems.length === 0) {
      return NextResponse.json({ success: true, message: 'No new items', stats: { created: 0 } })
    }

    // Top 12 most recent
    const items = allItems
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 12)

    console.log(`[RSS Poll] Analyzing ${items.length} items with Gemini...`)

    // ── Gemini analysis ────────────────────────────────────────────────────
    const headlines = items.map((it, i) => `${i + 1}. ${it.title}`).join('\n')

    const prompt = `You are a financial and geopolitical news analyst. Analyze these headlines and extract the 3-5 most market-moving global events.

HEADLINES:
${headlines}

Return ONLY a valid JSON array (no markdown, no explanation). Each element:
{
  "headline": "concise title max 90 chars",
  "country": "primary country name",
  "lat": number,
  "lon": number,
  "impactLevel": "Critical" | "High" | "Medium" | "Low",
  "category": "Geopolitical" | "Central Bank" | "Macro" | "Political" | "Crisis" | "Sanctions" | "Earnings" | "Natural Disaster",
  "summary": "2-3 sentences on market impact, max 250 chars",
  "sentiment": "one sentence market sentiment, max 150 chars",
  "confidenceScore": number 0-100,
  "isMarketMoving": boolean,
  "forexImpacts": [{"pair":"EUR/USD","direction":1,"magnitude":"Large","movePercent":"+0.5%","reasoning":"brief reason"}]
}

Return [] if no significant events. No markdown, no extra text.`

    let analysisText = ''
    try {
      analysisText = await analyzeWithGemini(prompt)
    } catch (err: any) {
      // Gemini rate limited — return gracefully, don't crash
      const isRateLimit = err?.message?.includes('rate limit') || err?.message?.includes('quota') || err?.message?.includes('429')
      console.warn(`[RSS Poll] Gemini unavailable: ${err?.message?.slice(0, 100)}`)
      return NextResponse.json({
        success: true,
        skipped: true,
        message: isRateLimit
          ? 'Gemini rate limited — will retry next cycle'
          : `Gemini error: ${err?.message?.slice(0, 100)}`,
        stats: { feeds: feeds.length, items: items.length, created: 0 },
      })
    }

    // ── Parse Gemini response ──────────────────────────────────────────────
    let events: any[] = []
    try {
      const clean = analysisText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      // Find the JSON array in the response
      const match = clean.match(/\[[\s\S]*\]/)
      if (match) {
        events = JSON.parse(match[0])
      }
      if (!Array.isArray(events)) events = []
    } catch {
      console.error('[RSS Poll] Failed to parse Gemini JSON:', analysisText.slice(0, 200))
      return NextResponse.json({ success: true, message: 'Could not parse AI response', stats: { created: 0 } })
    }

    if (events.length === 0) {
      return NextResponse.json({ success: true, message: 'No significant events found', stats: { created: 0 } })
    }

    // ── Deduplicate against last 48h (matches event retention window) ──────
    const { data: existing } = await supabase
      .from('events')
      .select('headline')
      .gte('published_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())

    const existingSet = new Set((existing || []).map((e: any) => e.headline.toLowerCase().slice(0, 50)))
    const unique = events.filter((e) => !existingSet.has((e.headline || '').toLowerCase().slice(0, 50)))

    if (unique.length === 0) {
      return NextResponse.json({ success: true, message: 'All events already exist', stats: { created: 0 } })
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    const rows = unique.map((e) => ({
      headline: String(e.headline || '').slice(0, 100),
      country: String(e.country || 'Unknown'),
      lat: Number(e.lat) || 0,
      lon: Number(e.lon) || 0,
      impact_level: e.impactLevel || 'Medium',
      category: e.category || 'Geopolitical',
      summary: String(e.summary || '').slice(0, 500),
      sentiment: String(e.sentiment || '').slice(0, 200),
      forex_impacts: Array.isArray(e.forexImpacts) ? e.forexImpacts : [],
      confidence_score: Math.min(100, Math.max(0, Math.round(Number(e.confidenceScore) || 75))),
      is_market_moving: Boolean(e.isMarketMoving),
      published_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      created_by: 'ai-auto' as const,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('events')
      .insert(rows)
      .select()

    if (insertErr) {
      console.error('[RSS Poll] Insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to save events', details: insertErr.message }, { status: 500 })
    }

    console.log(`[RSS Poll] ✅ Created ${inserted?.length ?? 0} events`)
    return NextResponse.json({
      success: true,
      message: `Created ${inserted?.length ?? 0} events`,
      stats: { feeds: feeds.length, items: items.length, created: inserted?.length ?? 0 },
      events: inserted?.map((e: any) => ({ id: e.id, headline: e.headline, impactLevel: e.impact_level })),
    })
  } catch (error) {
    console.error('[RSS Poll] Fatal error:', error)
    return NextResponse.json({ error: 'RSS poll failed', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
