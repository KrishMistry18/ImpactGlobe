import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ── Seed events — used when all AI providers are unavailable ─────────────────
const SEED_EVENTS = [
  { headline: 'Russia launches mass drone strike on Kyiv energy grid', country: 'Ukraine', lat: 50.4501, lon: 30.5234, impactLevel: 'Critical', category: 'Geopolitical', summary: 'Russia launched 120+ Shahed drones targeting Kyiv power infrastructure, triggering EU emergency energy summit. UAH and regional currencies under pressure.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'EUR/USD', direction: -1, magnitude: 'Large', movePercent: '-0.6%', reasoning: 'Risk-off; European energy supply shock' }, { pair: 'USD/JPY', direction: -1, magnitude: 'Medium', movePercent: '-0.4%', reasoning: 'Yen safe-haven demand surge' }] },
  { headline: 'Israel expands ground operation into Rafah amid ceasefire collapse', country: 'Israel', lat: 31.2918, lon: 34.2479, impactLevel: 'Critical', category: 'Geopolitical', summary: 'IDF ground forces entered Rafah as ceasefire talks broke down in Doha. Oil futures jumped 3% on Middle East escalation fears.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'XAU/USD', direction: 1, magnitude: 'Large', movePercent: '+1.2%', reasoning: 'Gold safe-haven bid on conflict escalation' }] },
  { headline: 'India-Pakistan exchange cross-border artillery fire in Kashmir', country: 'India', lat: 34.0837, lon: 74.7973, impactLevel: 'Critical', category: 'Geopolitical', summary: 'Heavy shelling along the Line of Control following terrorist attack. Nuclear-armed neighbours on highest alert in 5 years.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/INR', direction: 1, magnitude: 'Large', movePercent: '+1.1%', reasoning: 'Rupee crash on war risk' }, { pair: 'USD/PKR', direction: 1, magnitude: 'Large', movePercent: '+2.3%', reasoning: 'Pakistan peso collapses amid conflict' }] },
  { headline: 'Fed emergency cut 50bps as US bank failures trigger liquidity crisis', country: 'United States', lat: 38.8951, lon: -77.0364, impactLevel: 'Critical', category: 'Central Bank', summary: 'Federal Reserve slashes rates 50bp in emergency session after two regional banks collapse. S&P 500 futures halted limit-down.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'EUR/USD', direction: 1, magnitude: 'Large', movePercent: '+1.4%', reasoning: 'Dollar collapse on Fed crisis cut' }, { pair: 'USD/JPY', direction: -1, magnitude: 'Large', movePercent: '-1.8%', reasoning: 'Massive yen safe-haven surge' }] },
  { headline: 'Chinese military encircles Taiwan with live-fire naval exercises', country: 'China', lat: 25.0330, lon: 121.5654, impactLevel: 'Critical', category: 'Geopolitical', summary: 'PLA Navy conducts unprecedented 72-hour blockade simulation around Taiwan Strait. Semiconductor stocks plunge 8% globally.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/CNY', direction: 1, magnitude: 'Large', movePercent: '+0.9%', reasoning: 'Yuan pressure on capital flight risk' }, { pair: 'USD/TWD', direction: 1, magnitude: 'Large', movePercent: '+2.1%', reasoning: 'Taiwan dollar sold heavily' }] },
  { headline: 'ECB raises rates 25bp citing persistent eurozone inflation', country: 'Germany', lat: 50.1109, lon: 8.6821, impactLevel: 'High', category: 'Central Bank', summary: 'European Central Bank delivered 25bp hike to 4.5%, signalling higher-for-longer. Euro strengthened; peripheral bond spreads tightened.', sentiment: 'Positive market sentiment', forexImpacts: [{ pair: 'EUR/USD', direction: 1, magnitude: 'Medium', movePercent: '+0.5%', reasoning: 'ECB hawkishness supports euro' }] },
  { headline: 'Trump announces 60% tariff on all Chinese electronics imports', country: 'United States', lat: 40.7128, lon: -74.0060, impactLevel: 'High', category: 'Macro', summary: 'Trump White House unveiled sweeping 60% tariff on Chinese tech exports, escalating trade war. Apple and NVIDIA led tech selloff.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/CNY', direction: 1, magnitude: 'Large', movePercent: '+0.7%', reasoning: 'Trade war pressure on yuan' }, { pair: 'AUD/USD', direction: -1, magnitude: 'Medium', movePercent: '-0.5%', reasoning: 'Australia trade exposure to China' }] },
  { headline: 'Magnitude 7.8 earthquake strikes Istanbul, 2,000 feared dead', country: 'Turkey', lat: 41.0082, lon: 28.9784, impactLevel: 'High', category: 'Natural Disaster', summary: 'Major earthquake struck Istanbul at 3am local time. Turkey declared state of emergency; lira fell 4% on reconstruction cost fears.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/TRY', direction: 1, magnitude: 'Large', movePercent: '+4.1%', reasoning: 'Lira collapses on disaster spending' }] },
  { headline: 'Saudi Arabia extends voluntary oil production cut by 6 months', country: 'Saudi Arabia', lat: 24.6877, lon: 46.7219, impactLevel: 'High', category: 'Macro', summary: 'Riyadh announced 1mb/d voluntary cut extension through Q2, pushing Brent above $95. Inflation outlook worsened in oil-importing nations.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/NOK', direction: -1, magnitude: 'Medium', movePercent: '-0.6%', reasoning: 'Krone strengthens on oil price rise' }] },
  { headline: 'North Korea fires ICBM over Japan into Pacific Ocean', country: 'North Korea', lat: 39.0392, lon: 125.7625, impactLevel: 'High', category: 'Geopolitical', summary: 'DPRK launched Hwasong-17 ICBM over Hokkaido, landing 200km inside Japanese EEZ. Yen spiked on safe-haven demand.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/JPY', direction: -1, magnitude: 'Medium', movePercent: '-0.7%', reasoning: 'Yen safe-haven surge on DPRK launch' }, { pair: 'USD/KRW', direction: 1, magnitude: 'Medium', movePercent: '+0.8%', reasoning: 'Won weakens on Korea peninsula tension' }] },
  { headline: 'Brazil central bank cuts Selic rate to 10.5% amid easing cycle', country: 'Brazil', lat: -15.7975, lon: -47.8919, impactLevel: 'Medium', category: 'Central Bank', summary: 'Banco do Brasil reduced benchmark rate 50bp in unanimous decision. Real weakened slightly as carry-trade appeal diminished.', sentiment: 'Neutral market sentiment', forexImpacts: [{ pair: 'USD/BRL', direction: 1, magnitude: 'Small', movePercent: '+0.3%', reasoning: 'Real softens on lower carry yield' }] },
  { headline: 'UK inflation rises to 4.2%, above BOE 2% target for 14th month', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, impactLevel: 'Medium', category: 'Macro', summary: 'UK CPI surprised to the upside at 4.2%, forcing Bank of England to delay expected rate cuts. Sterling rallied on higher-for-longer bets.', sentiment: 'Positive market sentiment', forexImpacts: [{ pair: 'GBP/USD', direction: 1, magnitude: 'Medium', movePercent: '+0.4%', reasoning: 'Cable rises on sticky inflation' }] },
  { headline: 'US imposes fresh sanctions on Iranian oil exports via third parties', country: 'Iran', lat: 35.6892, lon: 51.3890, impactLevel: 'Medium', category: 'Sanctions', summary: 'Treasury OFAC designated 5 Chinese shipping firms aiding Iranian oil exports. Oil prices rose 1.5% on supply tightening fears.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/CNY', direction: 1, magnitude: 'Small', movePercent: '+0.2%', reasoning: 'Yuan pressure on secondary sanctions risk' }] },
  { headline: 'Argentina peso devalued 30% as IMF deal reaches restructuring terms', country: 'Argentina', lat: -34.6037, lon: -58.3816, impactLevel: 'Medium', category: 'Macro', summary: 'Milei government devalued ARS 30% in surprise overnight move as IMF agreed $44B restructuring. Bond yields fell sharply.', sentiment: 'Positive market sentiment', forexImpacts: [{ pair: 'USD/ARS', direction: 1, magnitude: 'Large', movePercent: '+30%', reasoning: 'Official peso devaluation to IMF-agreed rate' }] },
  { headline: 'Kenya floods displace 200,000; humanitarian crisis declared', country: 'Kenya', lat: -1.2921, lon: 36.8219, impactLevel: 'Medium', category: 'Natural Disaster', summary: 'Worst floods in 30 years hit Nairobi and the Rift Valley. World Bank activated $500M emergency facility; shilling weakened.', sentiment: 'Negative market sentiment', forexImpacts: [{ pair: 'USD/KES', direction: 1, magnitude: 'Small', movePercent: '+0.5%', reasoning: 'Shilling pressured on emergency spending' }] },
  { headline: 'Reserve Bank of Australia holds rates at 4.35% for third meeting', country: 'Australia', lat: -33.8688, lon: 151.2093, impactLevel: 'Low', category: 'Central Bank', summary: 'RBA kept the cash rate unchanged as board assessed lagging inflation data. AUD was little changed as decision was fully priced.', sentiment: 'Neutral market sentiment', forexImpacts: [{ pair: 'AUD/USD', direction: 1, magnitude: 'Small', movePercent: '+0.1%', reasoning: 'Slight relief as no hike delivered' }] },
  { headline: 'Japan-EU sign digital trade agreement at Tokyo summit', country: 'Japan', lat: 35.6762, lon: 139.6503, impactLevel: 'Low', category: 'Political', summary: 'Japan and EU finalised landmark digital trade rules covering AI, data flows and e-commerce. Minimal immediate market impact.', sentiment: 'Positive market sentiment', forexImpacts: [] },
  { headline: 'Canada posts stronger-than-expected Q4 GDP at 2.8% annualised', country: 'Canada', lat: 45.4215, lon: -75.6972, impactLevel: 'Low', category: 'Macro', summary: 'Statistics Canada GDP beat consensus of 2.2%, reducing pressure for Bank of Canada rate cuts in Q2. Loonie firmed modestly.', sentiment: 'Positive market sentiment', forexImpacts: [{ pair: 'USD/CAD', direction: -1, magnitude: 'Small', movePercent: '-0.2%', reasoning: 'Loonie firms on strong GDP beat' }] },
  { headline: 'Swiss National Bank holds rates at 1.0%; signals no near-term cuts', country: 'Switzerland', lat: 46.9481, lon: 7.4474, impactLevel: 'Low', category: 'Central Bank', summary: 'SNB left rates steady, noting inflation at 1.4% within target band. Franc moved marginally; decision in line with expectations.', sentiment: 'Neutral market sentiment', forexImpacts: [{ pair: 'EUR/CHF', direction: 1, magnitude: 'Small', movePercent: '+0.1%', reasoning: 'Slight franc softening on hold decision' }] },
  { headline: 'Singapore expands MAS green bond framework for ASEAN issuers', country: 'Singapore', lat: 1.3521, lon: 103.8198, impactLevel: 'Low', category: 'Macro', summary: 'Monetary Authority of Singapore expanded green bond guidelines to include ASEAN sovereign issuers, attracting $2B in pipeline deals.', sentiment: 'Positive market sentiment', forexImpacts: [] },
]

// ── Category sanitizer — DB enforces strict check constraint ─────────────────
const VALID_CATEGORIES = new Set([
  'Geopolitical', 'Central Bank', 'Macro', 'Political',
  'Crisis', 'Sanctions', 'Earnings', 'Natural Disaster',
])

function sanitizeCategory(raw: string): string {
  if (VALID_CATEGORIES.has(raw)) return raw
  const r = (raw || '').toLowerCase()
  if (r.includes('bank') || r.includes('monetary') || r.includes('rate') || r.includes('fed') || r.includes('ecb') || r.includes('boj')) return 'Central Bank'
  if (r.includes('war') || r.includes('military') || r.includes('conflict') || r.includes('geo') || r.includes('terror') || r.includes('nuclear')) return 'Geopolitical'
  if (r.includes('sanction') || r.includes('embargo') || r.includes('tariff') || r.includes('trade')) return 'Sanctions'
  if (r.includes('disaster') || r.includes('earthquake') || r.includes('flood') || r.includes('hurricane') || r.includes('natural')) return 'Natural Disaster'
  if (r.includes('crisis') || r.includes('emergency') || r.includes('collapse')) return 'Crisis'
  if (r.includes('politic') || r.includes('election') || r.includes('government') || r.includes('diplomatic')) return 'Political'
  if (r.includes('earn') || r.includes('profit') || r.includes('corporate') || r.includes('stock')) return 'Earnings'
  return 'Macro' // safe fallback
}

let lastAttemptMs = 0
let lastSuccessMs = 0
let failureStreak = 0

const RETRY_GAP_MS   = 2 * 60 * 1000
const REFRESH_GAP_MS = 4 * 60 * 60 * 1000
const TARGET_EVENTS  = 20

export async function GET(request: NextRequest) {
  const cronSecret  = request.headers.get('x-cron-secret')
  const adminSecret = request.headers.get('x-admin-secret')
  const isDev       = process.env.NODE_ENV === 'development'
  const isForced    = request.nextUrl.searchParams.get('force') === '1'

  if (!isDev && cronSecret !== process.env.CRON_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const nowMs    = Date.now()
  const now      = new Date(nowMs)

  // ── Guard 1: 4-hour success cadence ──────────────────────────────────────
  if (!isForced && lastSuccessMs > 0 && nowMs - lastSuccessMs < REFRESH_GAP_MS) {
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('expires_at', now.toISOString())

    if ((count ?? 0) >= TARGET_EVENTS) {
      const nextIn = Math.round((REFRESH_GAP_MS - (nowMs - lastSuccessMs)) / 60_000)
      return NextResponse.json({ success: true, skipped: true, message: `${count} events live. Next refresh in ~${nextIn}min` })
    }
  }

  // ── Guard 2: 2-minute retry gap (rate-limit safety) ───────────────────────
  if (!isForced && lastAttemptMs > 0 && nowMs - lastAttemptMs < RETRY_GAP_MS) {
    const waitSec = Math.round((RETRY_GAP_MS - (nowMs - lastAttemptMs)) / 1000)
    return NextResponse.json({ success: true, skipped: true, message: `Rate guard — retry in ${waitSec}s (streak: ${failureStreak})` })
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const prompt = `You are a real-time geopolitical and financial markets intelligence analyst. Today is ${now.toUTCString()}.

Generate exactly 20 current global news events from the last 48 hours that significantly impact financial markets and geopolitical stability.

EXACTLY 5 events per impact tier — no more, no less:
• Critical (5): Active armed conflicts, financial system shocks, mass-casualty events
• High (5): Central bank decisions, major geopolitical escalations, large natural disasters
• Medium (5): Sanctions, significant political crises, major economic data releases
• Low (5): Diplomatic meetings, minor market moves, routine policy announcements

For EACH event, produce this EXACT JSON object with ALL fields populated:
{
  "headline": "Specific, informative headline describing exactly what happened — aim for 60-90 characters",
  "country": "Primary affected country full name",
  "lat": 48.8566,
  "lon": 2.3522,
  "impactLevel": "Critical",
  "category": "Geopolitical",
  "summary": "2-3 sentences: what happened, why it matters for markets, and what traders should watch. Be specific with numbers/percentages where possible. Max 300 chars.",
  "sentiment": "Negative market sentiment",
  "forexImpacts": [
    { "pair": "EUR/USD", "direction": -1, "magnitude": "Large", "movePercent": "-0.8%", "reasoning": "Risk-off flight from euro assets" },
    { "pair": "USD/JPY", "direction": -1, "magnitude": "Medium", "movePercent": "-0.5%", "reasoning": "Yen safe-haven demand" }
  ]
}

CRITICAL RULES — violations will make the data useless:
1. headline: NEVER use generic phrases like 'Ukraine War Escalates' or 'Fed Rate Hike'. Write the SPECIFIC event: e.g. 'Ukraine Strikes Russian Black Sea Fleet HQ in Sevastopol' or 'Fed Holds Rates at 5.5% Amid Cooling Jobs Data'
2. lat/lon: CITY-level coordinates where the event is physically happening. Never use 0,0.
3. forexImpacts: Critical/High events MUST have 2-3 forex pairs. Medium events: 1-2 pairs. Low events: 0-1 pairs. direction: 1 = pair price goes UP, -1 = goes DOWN
4. Geographic spread: events must span at least 5 different continents/regions
5. No two events at the same location
6. Use REAL ongoing situations: Russia-Ukraine war, Israel-Gaza conflict, India-Pakistan tensions, Fed/ECB/BOJ policy, China-Taiwan, Trump tariffs, OPEC cuts, commodity prices, EM currency crises

Return ONLY a raw JSON array of exactly 20 objects. No markdown fences, no explanation, no preamble.`

  // Record attempt BEFORE API calls
  lastAttemptMs = nowMs
  let responseText = ''
  let modelUsed    = ''

  // ── 1. Try Groq (primary — 14,400 RPD, no IP restrictions) ───────────────
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768']
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 4096 }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) { console.warn(`[Groq] ${model} HTTP ${res.status}`); continue }
        const data = await res.json()
        responseText = data?.choices?.[0]?.message?.content || ''
        if (responseText) { modelUsed = `groq:${model}`; console.log(`[Groq] ✅ ${model} (${responseText.length} chars)`); break }
      } catch (e: any) { console.warn(`[Groq] ${model} error: ${e?.message?.slice(0, 80)}`) }
    }
  }

  // ── 2. Try Gemini (fallback) ───────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY
  if (!responseText && geminiKey) {
    const geminiModels = ['gemini-2.0-flash-lite', 'gemini-2.0-flash']
    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
        const res = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4096 } }),
          signal: AbortSignal.timeout(25_000),
        })
        if (!res.ok) { console.warn(`[Gemini] ${model} HTTP ${res.status}`); continue }
        const data = await res.json()
        responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (responseText) { modelUsed = `gemini:${model}`; console.log(`[Gemini] ✅ ${model} (${responseText.length} chars)`); break }
      } catch (e: any) { console.warn(`[Gemini] ${model} error: ${e?.message?.slice(0, 80)}`) }
    }
  }

  // ── 3. Seed fallback — globe is never empty ────────────────────────────────
  if (!responseText) {
    failureStreak++
    console.warn(`[News] All AI providers failed (streak: ${failureStreak}). Inserting seed events.`)
    await supabase.from('events').delete().eq('created_by', 'ai-auto')
    const seedRows = SEED_EVENTS.map(e => ({
      headline: e.headline, country: e.country, lat: e.lat, lon: e.lon,
      impact_level: e.impactLevel, category: e.category, summary: e.summary,
      sentiment: e.sentiment, forex_impacts: e.forexImpacts,
      confidence_score: e.impactLevel === 'Critical' ? 90 : e.impactLevel === 'High' ? 80 : 70,
      is_market_moving: e.impactLevel === 'Critical' || e.impactLevel === 'High',
      published_at: now.toISOString(),
      expires_at:   new Date(nowMs + 48 * 3_600_000).toISOString(),
      source_url: null, created_by: 'ai-auto' as const,
    }))
    const { data: seeded } = await supabase.from('events').insert(seedRows).select('id')
    console.log(`[News] 🌱 Seeded ${seeded?.length ?? 0} fallback events`)
    return NextResponse.json({ success: true, seeded: seeded?.length ?? 0, failureStreak, retryInSec: Math.round(RETRY_GAP_MS / 1000) })
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  let rawEvents: any[] = []
  try {
    const clean = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    if (match) rawEvents = JSON.parse(match[0])
    if (!Array.isArray(rawEvents)) rawEvents = []
  } catch {
    failureStreak++
    return NextResponse.json({ error: 'JSON parse failed', raw: responseText.slice(0, 200) }, { status: 500 })
  }

  // ── Enforce 5 per tier ────────────────────────────────────────────────────
  const TIERS = ['Critical', 'High', 'Medium', 'Low'] as const
  const buckets: Record<string, any[]> = { Critical: [], High: [], Medium: [], Low: [] }
  for (const e of rawEvents) {
    const t = e.impactLevel as string
    if (!buckets[t] || buckets[t].length >= 5) continue
    if (!e.headline || !e.country || typeof e.lat !== 'number' || typeof e.lon !== 'number') continue
    if (Math.abs(e.lat) < 0.01 && Math.abs(e.lon) < 0.01) continue
    buckets[t].push(e)
  }
  const validated = TIERS.flatMap(t => buckets[t])
  console.log(`[News] Parsed ${validated.length} events via ${modelUsed} (C:${buckets.Critical.length} H:${buckets.High.length} M:${buckets.Medium.length} L:${buckets.Low.length})`)

  if (validated.length === 0) {
    failureStreak++
    return NextResponse.json({ error: 'No valid events parsed', raw: responseText.slice(0, 200) }, { status: 500 })
  }

  // ── Replace DB events ─────────────────────────────────────────────────────
  await supabase.from('events').delete().eq('created_by', 'ai-auto')
  const rows = validated.map(e => ({
    headline: String(e.headline).slice(0, 100), country: String(e.country).slice(0, 100),
    lat: Number(e.lat), lon: Number(e.lon), impact_level: e.impactLevel,
    category: sanitizeCategory(e.category || 'Geopolitical'), summary: String(e.summary || '').slice(0, 500),
    sentiment: String(e.sentiment || 'Neutral market sentiment'),
    forex_impacts: Array.isArray(e.forexImpacts) ? e.forexImpacts : [],
    confidence_score: e.impactLevel === 'Critical' ? 90 : e.impactLevel === 'High' ? 80 : 70,
    is_market_moving: e.impactLevel === 'Critical' || e.impactLevel === 'High',
    published_at: now.toISOString(), expires_at: new Date(nowMs + 48 * 3_600_000).toISOString(),
    source_url: null, created_by: 'ai-auto' as const,
  }))

  const { data: inserted, error: insertErr } = await supabase.from('events').insert(rows).select('id, headline, impact_level, country, lat, lon')
  if (insertErr) { failureStreak++; return NextResponse.json({ error: insertErr.message }, { status: 500 }) }

  lastSuccessMs = Date.now()
  failureStreak = 0
  console.log(`[News] ✅ Inserted ${inserted?.length ?? 0} AI events via ${modelUsed}. Next refresh in 4h.`)

  return NextResponse.json({
    success: true, model: modelUsed, created: inserted?.length ?? 0, nextRefreshIn: '4 hours',
    tiers: { Critical: buckets.Critical.length, High: buckets.High.length, Medium: buckets.Medium.length, Low: buckets.Low.length },
    events: inserted?.map((e: any) => ({ id: e.id, headline: e.headline, impactLevel: e.impact_level, country: e.country, lat: e.lat, lon: e.lon })),
  })
}
