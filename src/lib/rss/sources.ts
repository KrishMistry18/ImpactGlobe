/**
 * RSS feed sources for global news
 * All feeds verified to be publicly accessible (no paywalls, no auth required)
 * Focus on geopolitical, economic, and market-moving news
 */

export interface RSSSource {
  name: string
  url: string
  category: 'geopolitical' | 'economic' | 'general' | 'regional'
  priority: number // 1-5, higher = more important
}

export const DEFAULT_RSS_SOURCES: RSSSource[] = [
  // ── TIER 1: Highest priority, always reliable ──────────────────────────────

  // BBC World News (free, no paywall)
  {
    name: 'BBC News - World',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'geopolitical',
    priority: 5,
  },
  // BBC Business
  {
    name: 'BBC News - Business',
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'economic',
    priority: 5,
  },

  // Al Jazeera (free, global coverage)
  {
    name: 'Al Jazeera - World',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'geopolitical',
    priority: 5,
  },

  // Associated Press (working URLs)
  {
    name: 'Associated Press - Top News',
    url: 'https://apnews.com/rss/apf-topnews',
    category: 'general',
    priority: 5,
  },
  {
    name: 'Associated Press - World',
    url: 'https://apnews.com/rss/apf-intlnews',
    category: 'geopolitical',
    priority: 5,
  },
  {
    name: 'Associated Press - Business',
    url: 'https://apnews.com/rss/apf-business',
    category: 'economic',
    priority: 5,
  },

  // Reuters (via Yahoo Finance relay — Reuters direct blocks scrapers)
  {
    name: 'Reuters via Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'economic',
    priority: 5,
  },

  // ── TIER 2: High priority ──────────────────────────────────────────────────

  // The Guardian (free, global)
  {
    name: 'The Guardian - World',
    url: 'https://www.theguardian.com/world/rss',
    category: 'geopolitical',
    priority: 4,
  },
  {
    name: 'The Guardian - Business',
    url: 'https://www.theguardian.com/uk/business/rss',
    category: 'economic',
    priority: 4,
  },

  // NPR World News (free)
  {
    name: 'NPR - World',
    url: 'https://feeds.npr.org/1004/rss.xml',
    category: 'geopolitical',
    priority: 4,
  },

  // CNBC (free RSS)
  {
    name: 'CNBC - World Economy',
    url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
    category: 'economic',
    priority: 4,
  },
  {
    name: 'CNBC - Finance',
    url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
    category: 'economic',
    priority: 4,
  },
  {
    name: 'CNBC - Top News',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'general',
    priority: 4,
  },

  // MarketWatch (working feed only)
  {
    name: 'MarketWatch - Top Stories',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    category: 'economic',
    priority: 4,
  },

  // ── TIER 3: Regional & Specialized ────────────────────────────────────────

  // South China Morning Post (Asia coverage)
  {
    name: 'South China Morning Post - Asia',
    url: 'https://www.scmp.com/rss/91/feed',
    category: 'regional',
    priority: 3,
  },

  // Times of India (South Asia)
  {
    name: 'Times of India - World',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    category: 'regional',
    priority: 3,
  },

  // Deutsche Welle (Europe/Global, free)
  {
    name: 'Deutsche Welle - World',
    url: 'https://rss.dw.com/rdf/rss-en-world',
    category: 'geopolitical',
    priority: 3,
  },
  {
    name: 'Deutsche Welle - Business',
    url: 'https://rss.dw.com/rdf/rss-en-bus',
    category: 'economic',
    priority: 3,
  },

  // France 24 (free, global)
  {
    name: 'France 24 - World',
    url: 'https://www.france24.com/en/rss',
    category: 'geopolitical',
    priority: 3,
  },

  // ── TIER 4: Central Banks & Policy (highest signal for forex) ─────────────

  {
    name: 'Federal Reserve - Press Releases',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    category: 'economic',
    priority: 5,
  },
  {
    name: 'ECB - Press Releases',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    category: 'economic',
    priority: 5,
  },

  // ── TIER 5: Conflict & Crisis Monitoring ──────────────────────────────────

  {
    name: 'UN News - Global',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    category: 'geopolitical',
    priority: 4,
  },
  {
    name: 'ReliefWeb - Disasters',
    url: 'https://reliefweb.int/disasters/rss.xml',
    category: 'geopolitical',
    priority: 3,
  },
]

/**
 * Get RSS sources filtered by category
 */
export function getSourcesByCategory(category: RSSSource['category']): RSSSource[] {
  return DEFAULT_RSS_SOURCES.filter((source) => source.category === category)
}

/**
 * Get RSS sources filtered by minimum priority
 */
export function getSourcesByPriority(minPriority: number): RSSSource[] {
  return DEFAULT_RSS_SOURCES.filter((source) => source.priority >= minPriority)
}

/**
 * Get all RSS source URLs
 */
export function getAllSourceURLs(): string[] {
  return DEFAULT_RSS_SOURCES.map((source) => source.url)
}
