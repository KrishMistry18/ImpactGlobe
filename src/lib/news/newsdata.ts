/**
 * NewsData.io API client
 * Free tier: 200 requests/day, 10 articles per request = 2,000 articles/day
 * No AI needed — articles come with category, country, and coordinates
 * Sign up free at: https://newsdata.io/register
 *
 * API docs: https://newsdata.io/documentation
 */

import type { GlobeEvent, ImpactLevel, EventCategory, ForexImpact } from '@/store/types'

const BASE = 'https://newsdata.io/api/1'
const API_KEY = process.env.NEWSDATA_API_KEY || ''

// Country full name (as returned by NewsData.io) → lat/lon of capital
const COUNTRY_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  // Full names from NewsData.io
  'united states of america': { lat: 38.8951, lon: -77.0364, name: 'United States' },
  'united states':            { lat: 38.8951, lon: -77.0364, name: 'United States' },
  'united kingdom':           { lat: 51.5074, lon: -0.1278,  name: 'United Kingdom' },
  'germany':                  { lat: 52.5200, lon: 13.4050,  name: 'Germany' },
  'france':                   { lat: 48.8566, lon: 2.3522,   name: 'France' },
  'china':                    { lat: 39.9042, lon: 116.4074, name: 'China' },
  'japan':                    { lat: 35.6762, lon: 139.6503, name: 'Japan' },
  'india':                    { lat: 28.6139, lon: 77.2090,  name: 'India' },
  'russia':                   { lat: 55.7558, lon: 37.6173,  name: 'Russia' },
  'brazil':                   { lat: -15.7975, lon: -47.8919, name: 'Brazil' },
  'australia':                { lat: -35.2809, lon: 149.1300, name: 'Australia' },
  'canada':                   { lat: 45.4215, lon: -75.6972, name: 'Canada' },
  'south korea':              { lat: 37.5665, lon: 126.9780, name: 'South Korea' },
  'saudi arabia':             { lat: 24.6877, lon: 46.7219,  name: 'Saudi Arabia' },
  'south africa':             { lat: -25.7479, lon: 28.2293, name: 'South Africa' },
  'mexico':                   { lat: 19.4326, lon: -99.1332, name: 'Mexico' },
  'turkey':                   { lat: 39.9334, lon: 32.8597,  name: 'Turkey' },
  'italy':                    { lat: 41.9028, lon: 12.4964,  name: 'Italy' },
  'spain':                    { lat: 40.4168, lon: -3.7038,  name: 'Spain' },
  'argentina':                { lat: -34.6037, lon: -58.3816, name: 'Argentina' },
  'nigeria':                  { lat: 9.0765, lon: 7.3986,   name: 'Nigeria' },
  'egypt':                    { lat: 30.0444, lon: 31.2357,  name: 'Egypt' },
  'pakistan':                 { lat: 33.6844, lon: 73.0479,  name: 'Pakistan' },
  'indonesia':                { lat: -6.2088, lon: 106.8456, name: 'Indonesia' },
  'israel':                   { lat: 31.7683, lon: 35.2137,  name: 'Israel' },
  'ukraine':                  { lat: 50.4501, lon: 30.5234,  name: 'Ukraine' },
  'poland':                   { lat: 52.2297, lon: 21.0122,  name: 'Poland' },
  'netherlands':              { lat: 52.3676, lon: 4.9041,   name: 'Netherlands' },
  'sweden':                   { lat: 59.3293, lon: 18.0686,  name: 'Sweden' },
  'switzerland':              { lat: 46.9481, lon: 7.4474,   name: 'Switzerland' },
  'norway':                   { lat: 59.9139, lon: 10.7522,  name: 'Norway' },
  'singapore':                { lat: 1.3521, lon: 103.8198,  name: 'Singapore' },
  'hong kong':                { lat: 22.3193, lon: 114.1694, name: 'Hong Kong' },
  'taiwan':                   { lat: 25.0330, lon: 121.5654, name: 'Taiwan' },
  'thailand':                 { lat: 13.7563, lon: 100.5018, name: 'Thailand' },
  'malaysia':                 { lat: 3.1390, lon: 101.6869,  name: 'Malaysia' },
  'philippines':              { lat: 14.5995, lon: 120.9842, name: 'Philippines' },
  'vietnam':                  { lat: 21.0285, lon: 105.8542, name: 'Vietnam' },
  'iran':                     { lat: 35.6892, lon: 51.3890,  name: 'Iran' },
  'iraq':                     { lat: 33.3152, lon: 44.3661,  name: 'Iraq' },
  'syria':                    { lat: 33.5138, lon: 36.2765,  name: 'Syria' },
  'libya':                    { lat: 32.9020, lon: 13.1800,  name: 'Libya' },
  'yemen':                    { lat: 15.3694, lon: 44.1910,  name: 'Yemen' },
  'afghanistan':              { lat: 34.5553, lon: 69.2075,  name: 'Afghanistan' },
  'kenya':                    { lat: -1.2921, lon: 36.8219,  name: 'Kenya' },
  'ethiopia':                 { lat: 9.0320, lon: 38.7469,   name: 'Ethiopia' },
  'ghana':                    { lat: 5.6037, lon: -0.1870,   name: 'Ghana' },
  'morocco':                  { lat: 33.9716, lon: -6.8498,  name: 'Morocco' },
  'algeria':                  { lat: 36.7372, lon: 3.0865,   name: 'Algeria' },
  'chile':                    { lat: -33.4489, lon: -70.6693, name: 'Chile' },
  'colombia':                 { lat: 4.7110, lon: -74.0721,  name: 'Colombia' },
  'peru':                     { lat: -12.0464, lon: -77.0428, name: 'Peru' },
  'venezuela':                { lat: 10.4806, lon: -66.9036, name: 'Venezuela' },
  'new zealand':              { lat: -41.2865, lon: 174.7762, name: 'New Zealand' },
  'bangladesh':               { lat: 23.8103, lon: 90.4125,  name: 'Bangladesh' },
  'sri lanka':                { lat: 6.9271, lon: 79.8612,   name: 'Sri Lanka' },
  'myanmar':                  { lat: 19.7633, lon: 96.0785,  name: 'Myanmar' },
  'north korea':              { lat: 39.0392, lon: 125.7625, name: 'North Korea' },
  'azerbaijan':               { lat: 40.4093, lon: 49.8671,  name: 'Azerbaijan' },
  'armenia':                  { lat: 40.1872, lon: 44.5152,  name: 'Armenia' },
  'georgia':                  { lat: 41.6938, lon: 44.8015,  name: 'Georgia' },
  'kazakhstan':               { lat: 51.1801, lon: 71.4460,  name: 'Kazakhstan' },
  'uzbekistan':               { lat: 41.2995, lon: 69.2401,  name: 'Uzbekistan' },
  'lebanon':                  { lat: 33.8886, lon: 35.4955,  name: 'Lebanon' },
  'jordan':                   { lat: 31.9522, lon: 35.9330,  name: 'Jordan' },
  'qatar':                    { lat: 25.2854, lon: 51.5310,  name: 'Qatar' },
  'united arab emirates':     { lat: 24.4539, lon: 54.3773,  name: 'UAE' },
  'uae':                      { lat: 24.4539, lon: 54.3773,  name: 'UAE' },
  'kuwait':                   { lat: 29.3759, lon: 47.9774,  name: 'Kuwait' },
  'bahrain':                  { lat: 26.0667, lon: 50.5577,  name: 'Bahrain' },
  'oman':                     { lat: 23.5880, lon: 58.3829,  name: 'Oman' },
  'portugal':                 { lat: 38.7223, lon: -9.1393,  name: 'Portugal' },
  'greece':                   { lat: 37.9838, lon: 23.7275,  name: 'Greece' },
  'austria':                  { lat: 48.2082, lon: 16.3738,  name: 'Austria' },
  'belgium':                  { lat: 50.8503, lon: 4.3517,   name: 'Belgium' },
  'denmark':                  { lat: 55.6761, lon: 12.5683,  name: 'Denmark' },
  'finland':                  { lat: 60.1699, lon: 24.9384,  name: 'Finland' },
  'czech republic':           { lat: 50.0755, lon: 14.4378,  name: 'Czech Republic' },
  'hungary':                  { lat: 47.4979, lon: 19.0402,  name: 'Hungary' },
  'romania':                  { lat: 44.4268, lon: 26.1025,  name: 'Romania' },
  'serbia':                   { lat: 44.8176, lon: 20.4633,  name: 'Serbia' },
  'croatia':                  { lat: 45.8150, lon: 15.9819,  name: 'Croatia' },
  'cuba':                     { lat: 23.1136, lon: -82.3666, name: 'Cuba' },
  'haiti':                    { lat: 18.5944, lon: -72.3074, name: 'Haiti' },
  'sudan':                    { lat: 15.5007, lon: 32.5599,  name: 'Sudan' },
  'somalia':                  { lat: 2.0469, lon: 45.3182,   name: 'Somalia' },
  'mali':                     { lat: 12.6392, lon: -8.0029,  name: 'Mali' },
  'senegal':                  { lat: 14.7167, lon: -17.4677, name: 'Senegal' },
  'tanzania':                 { lat: -6.7924, lon: 39.2083,  name: 'Tanzania' },
  'uganda':                   { lat: 0.3476, lon: 32.5825,   name: 'Uganda' },
  'zimbabwe':                 { lat: -17.8252, lon: 31.0335, name: 'Zimbabwe' },
  'mozambique':               { lat: -25.9692, lon: 32.5732, name: 'Mozambique' },
}

// ── Content-based country extraction ─────────────────────────────────────────
// NewsData.io's `country` field = the PUBLISHER's country (e.g. BBC → 'united kingdom'),
// not necessarily the SUBJECT country. We scan title + description first to find
// the geographic subject of the article, then fall back to the publisher country.
// Keys sorted longest-first to avoid partial matches ("south korea" before "korea",
// "iran" must not match inside "ukraine").
const SORTED_COUNTRY_KEYS = Object.keys(COUNTRY_COORDS).sort((a, b) => b.length - a.length)

function extractCountryFromContent(
  title: string,
  description: string
): { lat: number; lon: number; name: string } | undefined {
  const text = (title + ' ' + description).toLowerCase()
  for (const key of SORTED_COUNTRY_KEYS) {
    const idx = text.indexOf(key)
    if (idx === -1) continue
    // Word-boundary check: not preceded or followed by a letter/digit
    const charBefore = idx > 0 ? text[idx - 1] : ' '
    const charAfter = idx + key.length < text.length ? text[idx + key.length] : ' '
    if (/[a-z0-9]/.test(charBefore) || /[a-z0-9]/.test(charAfter)) continue
    return COUNTRY_COORDS[key]
  }
  return undefined
}

// NewsData.io category → ImpactGlobe category
const CATEGORY_MAP: Record<string, EventCategory> = {
  politics: 'Political',
  business: 'Macro',
  economy: 'Macro',
  finance: 'Macro',
  world: 'Geopolitical',
  top: 'Geopolitical',
  crime: 'Crisis',
  domestic: 'Political',
  environment: 'Natural Disaster',
  food: 'Macro',
  health: 'Crisis',
  science: 'Macro',
  sports: 'Macro',
  technology: 'Macro',
  tourism: 'Macro',
  entertainment: 'Macro',
  other: 'Geopolitical',
}

// Keywords → impact level
const CRITICAL_KEYWORDS = [
  'war', 'invasion', 'nuclear', 'attack', 'missile', 'coup', 'collapse',
  'federal reserve', 'rate decision', 'interest rate', 'central bank',
  'earthquake', 'tsunami', 'hurricane', 'catastrophe', 'crisis',
  'sanctions', 'default', 'recession', 'crash',
]
const HIGH_KEYWORDS = [
  'conflict', 'protest', 'election', 'gdp', 'inflation', 'tariff',
  'trade war', 'military', 'airstrike', 'explosion', 'flood', 'wildfire',
  'bank', 'oil', 'energy', 'summit', 'agreement', 'deal',
]

function classifyImpact(title: string, description: string): ImpactLevel {
  const text = (title + ' ' + description).toLowerCase()
  if (CRITICAL_KEYWORDS.some((k) => text.includes(k))) return 'Critical'
  if (HIGH_KEYWORDS.some((k) => text.includes(k))) return 'High'
  // Low: matches at most one global keyword AND has a short title/description
  const globalKeywordHits = [
    'war', 'conflict', 'attack', 'military', 'election', 'gdp', 'inflation',
    'trade', 'tariff', 'oil', 'energy', 'nuclear', 'protest', 'crisis',
    'summit', 'treaty', 'agreement', 'deal', 'ukraine', 'russia', 'china',
    'iran', 'israel', 'nato', 'trump', 'fed ', 'imf', 'climate',
  ].filter((k) => text.includes(k)).length
  if (globalKeywordHits <= 1 && text.length < 400) return 'Low'
  return 'Medium'
}

function classifyCategory(
  newsCategory: string[],
  title: string
): EventCategory {
  const text = title.toLowerCase()
  // Override by keywords first
  if (text.includes('central bank') || text.includes('rate') || text.includes('fed ') || text.includes('ecb') || text.includes('boj')) return 'Central Bank'
  if (text.includes('sanction')) return 'Sanctions'
  if (text.includes('earthquake') || text.includes('flood') || text.includes('hurricane') || text.includes('wildfire') || text.includes('tsunami')) return 'Natural Disaster'
  if (text.includes('earnings') || text.includes('profit') || text.includes('revenue') || text.includes('ipo')) return 'Earnings'
  if (text.includes('gdp') || text.includes('inflation') || text.includes('trade') || text.includes('tariff')) return 'Macro'

  // Fall back to category map
  for (const cat of newsCategory) {
    const mapped = CATEGORY_MAP[cat.toLowerCase()]
    if (mapped) return mapped
  }
  return 'Geopolitical'
}

// Simple forex impact inference from country + category
function inferForexImpacts(
  country: string,
  category: EventCategory,
  impactLevel: ImpactLevel
): ForexImpact[] {
  const impacts: ForexImpact[] = []
  const magnitude = impactLevel === 'Critical' ? 'Large' : impactLevel === 'High' ? 'Medium' : 'Small' // Medium & Low both get Small

  const currencyMap: Record<string, string> = {
    'United States': 'USD', 'United Kingdom': 'GBP', 'Germany': 'EUR',
    'France': 'EUR', 'Japan': 'JPY', 'China': 'CNH', 'Australia': 'AUD',
    'Canada': 'CAD', 'Switzerland': 'CHF', 'New Zealand': 'NZD',
    'Russia': 'RUB', 'Brazil': 'BRL', 'India': 'INR', 'South Korea': 'KRW',
    'Mexico': 'MXN', 'Turkey': 'TRY', 'Norway': 'NOK', 'Sweden': 'SEK',
  }

  const currency = currencyMap[country]
  if (!currency) return []

  const pairMap: Record<string, string> = {
    'USD': 'EUR/USD', 'GBP': 'GBP/USD', 'JPY': 'USD/JPY',
    'AUD': 'AUD/USD', 'CAD': 'USD/CAD', 'CHF': 'USD/CHF',
    'NZD': 'NZD/USD', 'EUR': 'EUR/USD',
  }

  const pair = pairMap[currency]
  if (!pair) return []

  const isNegative = ['Crisis', 'Natural Disaster', 'Sanctions', 'Geopolitical'].includes(category)
  const direction: 1 | -1 = isNegative ? -1 : 1
  const moveAbs = magnitude === 'Large' ? '0.8' : magnitude === 'Medium' ? '0.4' : '0.15'

  impacts.push({
    pair,
    direction,
    magnitude,
    movePercent: `${direction > 0 ? '+' : '-'}${moveAbs}%`,
    reasoning: `${country} ${category.toLowerCase()} event affects ${currency}`,
  })

  return impacts
}

interface NewsDataArticle {
  article_id: string
  title: string
  description: string | null
  content: string | null
  pubDate: string
  link: string
  country: string[]
  category: string[]
  language: string
  sentiment?: string
  sentiment_stats?: Record<string, number>
}

interface NewsDataResponse {
  status: string
  totalResults: number
  results: NewsDataArticle[]
  nextPage?: string
}

/**
 * Fetch latest world news from NewsData.io
 * Returns structured GlobeEvent objects — no AI needed
 */
export async function fetchNewsDataEvents(): Promise<GlobeEvent[]> {
  if (!API_KEY) {
    console.warn('[NewsData] No API key configured (NEWSDATA_API_KEY)')
    return []
  }

  const events: GlobeEvent[] = []
  const seen = new Set<string>()

  // Fetch top world/politics/business/crime news from top domains
  const queries = [
    { category: 'world,politics', language: 'en', size: 10 },
    { category: 'business', language: 'en', size: 10 },
    { category: 'crime,environment', language: 'en', size: 5 },
  ]

  for (const params of queries) {
    try {
      const url = new URL(`${BASE}/news`)
      url.searchParams.set('apikey', API_KEY)
      url.searchParams.set('category', params.category)
      url.searchParams.set('language', params.language)
      url.searchParams.set('size', String(params.size))
      url.searchParams.set('prioritydomain', 'top') // only top-tier sources

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        console.error(`[NewsData] HTTP ${res.status}:`, await res.text())
        continue
      }

      const data: NewsDataResponse = await res.json()

      if (data.status !== 'success' || !data.results) continue

      for (const article of data.results) {
        if (seen.has(article.article_id)) continue
        seen.add(article.article_id)

        // ── Resolve country: scan article CONTENT first (subject country),
        // then fall back to article.country (publisher country).
        // This ensures "BBC reports on India" → ripple on India, not London.
        const description = article.description || article.content || ''
        let coords = extractCountryFromContent(article.title, description)
        if (!coords) {
          for (const c of (article.country || [])) {
            coords = COUNTRY_COORDS[c.toLowerCase().trim()]
            if (coords) break
          }
        }
        if (!coords) continue
        // Skip titles that are clearly financial ticker noise
        if (/\(NASDAQ:|OTCMKTS:|NYSE:|TSX:\)/.test(article.title)) continue
        // Skip very short or low-quality titles
        if (!article.title || article.title.length < 25) continue
        // Must have a description
        if (!article.description || article.description.length < 30) continue
        // Skip local/trivial content
        const titleLower = article.title.toLowerCase()
        const skipPatterns = [
          // Generic fluff
          'lottery', 'horoscope', 'recipe', 'weather forecast', 'sports result',
          'funny quote', 'joke', 'celebrity', 'gossip', 'fashion', 'beauty',
          'cricket score', 'football score', 'match result', 'live score',
          'drowns', 'accident', 'road accident', 'fire breaks out',
          'crore prize', 'lucky draw', 'win prize', 'exam result', 'hsc result',
          'ssc result', 'board result', 'nickel-per-nip', 'council planning',
          'airport maintenance', 're-polling', 'booth',
          'viral video', 'goes viral', 'video goes viral', 'sparks uproar',
          'quote of the day', 'sleeping carriage', 'luxury housing',
          'pet dog', 'bathing', 'twins born', 'different dads',
          'al pacino', 'godfather', 'curse-word', 'panelist',
          'hmrc', 'retirement plan', 'over-55s', 'gb news',
          'scottish rail', '150 years ago',
          // Local election constituency noise
          'constituency', 'constituency result', 'constituency election',
          'check live updates', 'live updates in', 'live: check',
          'assembly election result', 'assembly result',
          'vidhan sabha', 'lok sabha result', 'ward result',
          'seat result 2026', 'election result 2026',
          'counting begins', 'vote count', 'ballot count',
          'bypoll', 'by-election result', 'bypolls',
          'state election result', 'municipal result',
          // Other local noise
          'traffic update', 'power cut', 'water supply', 'road block',
          'school closure', 'local body', 'panchayat',
        ]
        if (skipPatterns.some((p) => titleLower.includes(p))) continue

        // Must contain at least one globally significant keyword.
        // NOTE: 'election' is intentionally NOT here — too broad (catches local
        // constituency results). Use specific global-scope election terms instead.
        const globalKeywords = [
          'war', 'conflict', 'attack', 'military', 'troops', 'sanctions',
          'presidential election', 'general election', 'federal election', 'snap election',
          'president', 'prime minister', 'federal government', 'parliament',
          'gdp', 'inflation', 'interest rate', 'central bank', 'federal reserve',
          'trade war', 'tariff', 'oil price', 'energy crisis', 'nuclear', 'missile',
          'earthquake', 'hurricane', 'flood', 'wildfire', 'tsunami',
          'protest', 'coup', 'crisis', 'collapse', 'recession',
          'summit', 'treaty', 'ceasefire', 'peace deal', 'sanctions',
          'ukraine', 'russia', 'china', 'iran', 'israel', 'nato',
          'trump', 'xi jinping', 'putin', 'zelensky', 'modi', 'macron',
          'stock market', 'wall street', 'fed ', 'ecb', 'imf', 'world bank',
          'climate change', 'carbon', 'emissions', 'pandemic', 'outbreak',
          'bank failure', 'currency crisis', 'debt default', 'bond yield',
        ]
        const hasGlobalKeyword = globalKeywords.some((k) => titleLower.includes(k))
        if (!hasGlobalKeyword) continue

        const impactLevel = classifyImpact(article.title, description)
        const category = classifyCategory(article.category || [], article.title)
        const forexImpacts = inferForexImpacts(coords.name, category, impactLevel)

        const sentiment = article.sentiment === 'positive'
          ? 'Positive market sentiment'
          : article.sentiment === 'negative'
            ? 'Negative market sentiment'
            : 'Neutral market sentiment'

        // Use current time as publishedAt so events appear as real-time on the globe.
        // The article's original pubDate can be many hours old (NewsData.io caches articles),
        // causing the globe to show "17h ago" for every event. We stamp with NOW on ingest.
        const now = new Date()
        events.push({
          id: `nd-${article.article_id}`,
          headline: article.title.slice(0, 100),
          country: coords.name,
          lat: coords.lat,
          lon: coords.lon,
          impactLevel,
          category,
          summary: description.slice(0, 250) || article.title,
          sentiment,
          forexImpacts,
          confidenceScore: 70,
          isMarketMoving: impactLevel === 'Critical',
          publishedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          sourceUrl: article.link,
          createdBy: 'ai-auto',
        })
      }
    } catch (err) {
      console.error('[NewsData] Fetch error:', err)
    }
  }

  // Sort newest first
  return events.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}
