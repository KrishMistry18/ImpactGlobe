import axios from "axios";
import type { WindPoint, TempAnomalyPoint } from "@/store/types";

const BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Open-Meteo free tier limits: 600 calls/min · 5,000/hour · 10,000/day.
 * CRUCIALLY, every coordinate in a multi-location request counts as a
 * separate call. The old code fetched thousands of points for wind AND
 * temperature across 4 zones in parallel — tens of thousands of calls in a
 * burst — which tripped HTTP 429 after the very first batch and left the
 * cache with only fragments (e.g. Antarctica-only).
 *
 * This module fetches the WHOLE globe in a single combined pass:
 *   - one request returns BOTH temperature and wind per location (each
 *     location is billed once, not twice)
 *   - a coarse grid keeps the total call count small
 *   - batches are throttled to stay well under 600 calls/min
 *   - 429 responses back off and retry
 *
 * A full 8° global pass is ~1,080 locations → comfortably within budget when
 * run a few times a day from a background refresh (never on the request path).
 */

/** Default global sampling resolution in degrees. 8° = 45×24 ≈ 1,080 points. */
const RESOLUTION = 8;
const BATCH_SIZE = 100;
/** Delay between batches. 100 calls / 12s ≈ 500 calls/min — under the 600 cap. */
const BATCH_DELAY_MS = 12_000;

export interface WeatherFetchResult {
  wind: WindPoint[];
  temp: TempAnomalyPoint[];
  /** false if any batch failed after retries (caller may skip caching). */
  complete: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Even global grid at the given resolution (degrees). */
function globalGrid(resolution: number): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let lat = -90; lat <= 90; lat += resolution) {
    for (let lon = -180; lon < 180; lon += resolution) {
      pts.push({ lat, lon });
    }
  }
  return pts;
}

async function fetchBatchWithRetry(
  params: Record<string, unknown>,
  maxRetries = 4,
): Promise<Record<string, unknown>[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await axios.get(BASE, { params, timeout: 20_000 });
      return Array.isArray(data) ? data : [data];
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      // 429 = rate limited → wait substantially longer before retrying.
      const base = status === 429 ? 15_000 : 1_500;
      const wait = base * Math.pow(1.8, attempt) + Math.random() * 1_000;
      if (attempt < maxRetries) await sleep(wait);
    }
  }
  throw lastErr;
}

/**
 * Fetch temperature + wind for the whole globe in one throttled pass.
 * SLOW BY DESIGN (~2 min for an 8° grid) to respect the rate limit, so this
 * must only ever run off the request path (background refresh / cron).
 */
export async function fetchGlobalWeather(
  resolution = RESOLUTION,
): Promise<WeatherFetchResult> {
  const coords = globalGrid(resolution);
  const wind: WindPoint[] = [];
  const temp: TempAnomalyPoint[] = [];
  let failedBatches = 0;
  const totalBatches = Math.ceil(coords.length / BATCH_SIZE);

  console.log(
    `[OpenMeteo] Global weather pass: ${coords.length} locations, ${totalBatches} batches @ ${resolution}°`,
  );

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE);
    const params = {
      latitude: batch.map((c) => c.lat).join(","),
      longitude: batch.map((c) => c.lon).join(","),
      current: "temperature_2m,wind_speed_10m,wind_direction_10m",
      wind_speed_unit: "ms", // default km/h would inflate speeds 3.6×
      forecast_days: 1,
    };

    try {
      const results = await fetchBatchWithRetry(params);
      results.forEach((result, idx) => {
        const cur = result.current as Record<string, number> | undefined;
        const coord = batch[idx];
        if (!cur || !coord) return;

        const t = cur.temperature_2m;
        if (t !== undefined) {
          temp.push({
            lat: coord.lat,
            lon: coord.lon,
            anomalyC: Math.round(t * 10) / 10,
          });
        }

        const speed = cur.wind_speed_10m;
        if (speed !== undefined && speed >= 0 && speed <= 70) {
          wind.push({
            lat: coord.lat,
            lon: coord.lon,
            speed: Math.round(speed * 10) / 10,
            direction: cur.wind_direction_10m ?? 0,
          });
        }
      });
    } catch (err) {
      failedBatches++;
      console.warn(
        `[OpenMeteo] Batch ${i / BATCH_SIZE + 1}/${totalBatches} failed:`,
        (err as { response?: { status?: number } })?.response?.status ?? err,
      );
    }

    if (i + BATCH_SIZE < coords.length) await sleep(BATCH_DELAY_MS);
  }

  const complete = failedBatches === 0;
  console.log(
    `[OpenMeteo] Global weather done: ${temp.length} temp, ${wind.length} wind pts, failedBatches=${failedBatches}/${totalBatches}, complete=${complete}`,
  );
  return { wind, temp, complete };
}
