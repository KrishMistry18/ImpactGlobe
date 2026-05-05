import Parser from 'rss-parser'

/**
 * RSS feed parser for news sources
 * Fetches and parses RSS/Atom feeds into structured data
 */

export interface RSSItem {
  title: string
  link: string
  pubDate: string
  content?: string
  contentSnippet?: string
  guid?: string
  categories?: string[]
  creator?: string
}

export interface RSSFeed {
  title: string
  description?: string
  link: string
  items: RSSItem[]
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ImpactGlobe/1.0 (News Aggregator)',
  },
})

/**
 * Parse an RSS feed from a URL
 */
export async function parseRSSFeed(url: string): Promise<RSSFeed> {
  try {
    const feed = await parser.parseURL(url)
    
    return {
      title: feed.title || 'Unknown Feed',
      description: feed.description,
      link: feed.link || url,
      items: feed.items.map((item) => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        content: item.content,
        contentSnippet: item.contentSnippet,
        guid: item.guid || item.link,
        categories: item.categories,
        creator: item.creator,
      })),
    }
  } catch (error) {
    console.error(`Failed to parse RSS feed ${url}:`, error)
    throw new Error(`RSS parse error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse multiple RSS feeds in parallel
 */
export async function parseMultipleFeeds(urls: string[]): Promise<RSSFeed[]> {
  const results = await Promise.allSettled(
    urls.map((url) => parseRSSFeed(url))
  )

  return results
    .filter((result): result is PromiseFulfilledResult<RSSFeed> => result.status === 'fulfilled')
    .map((result) => result.value)
}

/**
 * Filter RSS items by date (only items newer than the given date)
 */
export function filterNewItems(items: RSSItem[], since: Date): RSSItem[] {
  return items.filter((item) => {
    const itemDate = new Date(item.pubDate)
    return itemDate > since
  })
}

/**
 * Deduplicate RSS items by GUID or link
 */
export function deduplicateItems(items: RSSItem[]): RSSItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.guid || item.link
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
