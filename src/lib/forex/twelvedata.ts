/**
 * Twelve Data API client for forex data
 * Free tier: 800 API credits/day, 8 requests/minute
 * https://twelvedata.com/docs
 */

const BASE_URL = 'https://api.twelvedata.com'
const API_KEY = process.env.TWELVE_DATA_API_KEY

/**
 * Major forex pairs to track
 * Limited to 5 pairs to fit within free tier (8 credits/minute)
 */
export const MAJOR_PAIRS = [
  'EUR/USD', // Euro / US Dollar
  'GBP/USD', // British Pound / US Dollar
  'USD/JPY', // US Dollar / Japanese Yen
  'AUD/USD', // Australian Dollar / US Dollar
  'USD/CAD', // US Dollar / Canadian Dollar
]

export interface TwelveDataQuote {
  symbol: string
  name: string
  exchange: string
  currency: string
  datetime: string
  timestamp: number
  open: string
  high: string
  low: string
  close: string
  volume?: string
  previous_close: string
  change: string
  percent_change: string
  average_volume?: string
  is_market_open: boolean
}

export interface TwelveDataTimeSeriesValue {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume?: string
}

export interface TwelveDataTimeSeries {
  meta: {
    symbol: string
    interval: string
    currency: string
    exchange_timezone: string
    exchange: string
    type: string
  }
  values: TwelveDataTimeSeriesValue[]
  status: string
}

/**
 * Get real-time quote for a forex pair
 */
export async function getForexQuote(pair: string): Promise<TwelveDataQuote> {
  if (!API_KEY) {
    throw new Error('TWELVE_DATA_API_KEY not configured')
  }

  // Twelve Data API accepts symbols with slashes: EUR/USD
  const url = `${BASE_URL}/quote?symbol=${pair}&apikey=${API_KEY}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twelve Data API error: ${response.status} ${error}`)
  }

  const data = await response.json()

  if (data.code === 429) {
    throw new Error('Twelve Data API rate limit exceeded')
  }

  if (data.status === 'error') {
    throw new Error(`Twelve Data API error: ${data.message}`)
  }

  return data
}

/**
 * Get time series data for sparkline (last 24 hours, hourly)
 */
export async function getForexTimeSeries(
  pair: string,
  interval: '1h' | '5min' | '15min' | '30min' = '1h',
  outputsize = 24
): Promise<TwelveDataTimeSeries> {
  if (!API_KEY) {
    throw new Error('TWELVE_DATA_API_KEY not configured')
  }

  // Twelve Data API accepts symbols with slashes: EUR/USD
  const url = `${BASE_URL}/time_series?symbol=${pair}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twelve Data API error: ${response.status} ${error}`)
  }

  const data = await response.json()

  if (data.code === 429) {
    throw new Error('Twelve Data API rate limit exceeded')
  }

  if (data.status === 'error') {
    throw new Error(`Twelve Data API error: ${data.message}`)
  }

  return data
}

/**
 * Get quotes for multiple pairs (batch request)
 * Note: Batch requests count as 1 API credit per symbol
 */
export async function getForexQuotesBatch(pairs: string[]): Promise<Record<string, TwelveDataQuote>> {
  if (!API_KEY) {
    throw new Error('TWELVE_DATA_API_KEY not configured')
  }

  // Twelve Data API accepts symbols with slashes: EUR/USD,USD/JPY
  const symbols = pairs.join(',')
  const url = `${BASE_URL}/quote?symbol=${symbols}&apikey=${API_KEY}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twelve Data API error: ${response.status} ${error}`)
  }

  const data = await response.json()

  if (data.code === 429) {
    throw new Error('Twelve Data API rate limit exceeded')
  }

  // Batch response is an object with symbol keys
  const result: Record<string, TwelveDataQuote> = {}

  for (const [symbol, quote] of Object.entries(data)) {
    if (typeof quote === 'object' && quote !== null && 'symbol' in quote) {
      // Symbol is already in correct format (EUR/USD)
      result[symbol] = quote as TwelveDataQuote
    }
  }

  return result
}

/**
 * Calculate 24h change from time series data
 */
export function calculate24hChange(values: TwelveDataTimeSeriesValue[]): {
  change: number
  changePercent: number
} {
  if (values.length < 2) {
    return { change: 0, changePercent: 0 }
  }

  const latest = parseFloat(values[0].close)
  const oldest = parseFloat(values[values.length - 1].close)

  const change = latest - oldest
  const changePercent = (change / oldest) * 100

  return {
    change: parseFloat(change.toFixed(5)),
    changePercent: parseFloat(changePercent.toFixed(2)),
  }
}

/**
 * Extract sparkline data from time series (close prices only)
 */
export function extractSparklineData(values: TwelveDataTimeSeriesValue[]): number[] {
  return values.reverse().map((v) => parseFloat(v.close))
}
