/**
 * Sea Surface Temperature via Open-Meteo Marine API.
 * https://marine-api.open-meteo.com/v1/marine
 *
 * Open-Meteo bills every coordinate as one API call (600/min · 5k/hr · 10k/day).
 * The previous per-zone parallel fetch fired thousands of coordinates at once
 * and tripped HTTP 429 on every batch (returning 0 points AND burning the
 * shared budget that the weather layer also needs). This module instead does a
 * single throttled global pass that stays well under the rate limit and is only
 * ever run off the request path (background refresh).
 */

import axios from 'axios'
import type { SeaTempPoint } from '@/store/types'

const BASE = 'https://marine-api.open-meteo.com/v1/marine'

/** Coarse ocean grid — SST changes slowly and the result is heavily blurred. */
const RESOLUTION = 8
const BATCH_SIZE = 100
/** 100 calls / 12s ≈ 500 calls/min — under the 600 cap. */
const BATCH_DELAY_MS = 12_000

export interface SeaTempFetchResult {
  points: SeaTempPoint[]
  /** false if any batch failed after retries (caller may skip caching). */
  complete: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function globalGrid(resolution: number): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = []
  for (let lat = -78; lat <= 80; lat += resolution) {
    for (let lon = -180; lon < 180; lon += resolution) pts.push({ lat, lon })
  }
  return pts
}

async function fetchBatchWithRetry(
  params: Record<string, unknown>,
  maxRetries = 4,
): Promise<Record<string, unknown>[]> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await axios.get(BASE, { params, timeout: 20_000 })
      return Array.isArray(data) ? data : [data]
    } catch (err) {
      lastErr = err
      const status = (err as { response?: { status?: number } })?.response?.status
      const base = status === 429 ? 15_000 : 1_500
      await sleep(base * Math.pow(1.8, attempt) + Math.random() * 1_000)
    }
  }
  throw lastErr
}

/**
 * Fetch global sea-surface temperature in one throttled pass.
 * SLOW BY DESIGN (~2 min) — must run only in a background refresh, never on
 * the request path.
 */
export async function fetchGlobalSeaTemp(
  resolution = RESOLUTION,
): Promise<SeaTempFetchResult> {
  const coords = globalGrid(resolution)
  const points: SeaTempPoint[] = []
  let failedBatches = 0
  const totalBatches = Math.ceil(coords.length / BATCH_SIZE)

  console.log(`[SeaTemp] Global pass: ${coords.length} locations, ${totalBatches} batches @ ${resolution}°`)

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE)
    const params = {
      latitude: batch.map((c) => c.lat).join(','),
      longitude: batch.map((c) => c.lon).join(','),
      current: 'sea_surface_temperature',
      forecast_days: 1,
    }
    try {
      const results = await fetchBatchWithRetry(params)
      results.forEach((result, idx) => {
        const cur = result.current as Record<string, number> | undefined
        const coord = batch[idx]
        // Marine API returns null SST for land points — skip them.
        if (cur && coord && cur.sea_surface_temperature != null) {
          points.push({ lat: coord.lat, lon: coord.lon, tempC: cur.sea_surface_temperature })
        }
      })
    } catch (err) {
      failedBatches++
      console.warn(
        `[SeaTemp] Batch ${i / BATCH_SIZE + 1}/${totalBatches} failed:`,
        (err as { response?: { status?: number } })?.response?.status ?? err,
      )
    }
    if (i + BATCH_SIZE < coords.length) await sleep(BATCH_DELAY_MS)
  }

  const complete = failedBatches === 0
  console.log(`[SeaTemp] Global pass done: ${points.length} ocean pts, failedBatches=${failedBatches}/${totalBatches}, complete=${complete}`)
  return { points, complete }
}
