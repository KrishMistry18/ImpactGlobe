import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { fetchNewsDataEvents } from '@/lib/news/newsdata'

export async function GET(request: NextRequest) {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 55 * 60 * 1000).toISOString()

  // ── 1h cache guard ────────────────────────────────────────────────────────
  const snapshot = await adminDb.collection('events')
    .where('created_by', '==', 'ai-auto')
    .where('created_at', '>=', oneHourAgo)
    .limit(1)
    .get()

  if (!snapshot.empty) {
    console.log(`[News Refresh] Skipping — events inserted in last 55 min`)
    return NextResponse.json({
      success: true,
      skipped: true,
      message: `Cache active — fresh events already in DB`,
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
  const existingEventsSnap = await adminDb.collection('events')
    .where('created_at', '>=', twoDaysAgo)
    .get()

  const existingUrls = new Set<string>()
  const existingHeadlines = new Set<string>()
  
  existingEventsSnap.docs.forEach(doc => {
    const data = doc.data()
    if (data.source_url) existingUrls.add(data.source_url)
    if (data.headline) existingHeadlines.add(data.headline.toLowerCase().slice(0, 50))
  })

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
  const batch = adminDb.batch()
  const inserted: any[] = []

  capped.forEach((e) => {
    const ref = adminDb.collection('events').doc()
    const row = {
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
      published_at: e.publishedAt,
      expires_at: e.expiresAt,
      created_at: now.toISOString(),
      source_url: e.sourceUrl || null,
      created_by: 'ai-auto' as const,
    }
    batch.set(ref, row)
    inserted.push({ id: ref.id, headline: e.headline, impactLevel: e.impactLevel })
  })

  try {
    await batch.commit()
  } catch (insertErr: any) {
    console.error('[News Refresh] Insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[News Refresh] ✅ Inserted ${inserted.length} fresh events`)

  return NextResponse.json({
    success: true,
    message: `Inserted ${inserted.length} fresh events`,
    created: inserted.length,
    events: inserted,
  })
}
