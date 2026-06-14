/**
 * Air Quality via Open-Meteo Air Quality API (CAMS model — global, free, no key).
 * https://air-quality-api.open-meteo.com
 *
 * Open-Meteo bills every coordinate as one API call (600/min · 5k/hr · 10k/day).
 * The old per-zone parallel fetch fired thousands of coordinates at once and
 * tripped HTTP 429, leaving lopsided coverage (one hemisphere populated, the
 * other sparse — the "half-fetched" globe). This module does a single throttled
 * global pass, run only off the request path (background refresh).
 *
 * AQI here is a continuous modelled field (not sparse stations), so it covers
 * the whole globe — land and ocean.
 */

import axios from "axios";
import type { AQIPoint } from "@/store/types";

const BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

const RESOLUTION = 8;
const BATCH_SIZE = 100;
/** 100 calls / 12s ≈ 500 calls/min — under the 600 cap. */
const BATCH_DELAY_MS = 12_000;

export interface AQIFetchResult {
  points: AQIPoint[];
  complete: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── EPA PM2.5 → AQI conversion ───────────────────────────────────────────────

export function aqiFromPm25(pm25: number): number {
  const bp: [number, number, number, number][] = [
    [0, 12, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];
  for (const [cLo, cHi, iLo, iHi] of bp) {
    if (pm25 >= cLo && pm25 <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (pm25 - cLo) + iLo);
    }
  }
  return pm25 > 500 ? 500 : 0;
}

export function aqiCategory(aqi: number): AQIPoint["category"] {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function globalGrid(resolution: number): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let lat = -90; lat <= 90; lat += resolution) {
    for (let lon = -180; lon < 180; lon += resolution) pts.push({ lat, lon });
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
      const status = (err as { response?: { status?: number } })?.response?.status;
      const base = status === 429 ? 15_000 : 1_500;
      await sleep(base * Math.pow(1.8, attempt) + Math.random() * 1_000);
    }
  }
  throw lastErr;
}

/**
 * Fetch global air quality in one throttled pass. SLOW BY DESIGN (~2 min);
 * must run only in a background refresh, never on the request path.
 */
export async function fetchGlobalAQI(
  resolution = RESOLUTION,
): Promise<AQIFetchResult> {
  const coords = globalGrid(resolution);
  const points: AQIPoint[] = [];
  let failedBatches = 0;
  const totalBatches = Math.ceil(coords.length / BATCH_SIZE);

  console.log(`[AQI] Global pass: ${coords.length} locations, ${totalBatches} batches @ ${resolution}°`);

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE);
    const params = {
      latitude: batch.map((c) => c.lat).join(","),
      longitude: batch.map((c) => c.lon).join(","),
      current: "pm2_5,european_aqi",
      forecast_days: 1,
    };
    try {
      const results = await fetchBatchWithRetry(params);
      results.forEach((result, idx) => {
        const cur = result.current as Record<string, number> | undefined;
        const coord = batch[idx];
        if (!cur || !coord) return;
        const pm25 = cur.pm2_5 ?? 0;
        const eaqi = cur.european_aqi ?? null;
        const rawAqi = eaqi != null ? Math.round(eaqi) : aqiFromPm25(pm25);
        const aqi = Math.max(0, Math.min(500, rawAqi));
        points.push({
          lat: coord.lat,
          lon: coord.lon,
          city: `${coord.lat.toFixed(1)}°, ${coord.lon.toFixed(1)}°`,
          country: "",
          aqi,
          pm25,
          category: aqiCategory(aqi),
        });
      });
    } catch (err) {
      failedBatches++;
      console.warn(
        `[AQI] Batch ${i / BATCH_SIZE + 1}/${totalBatches} failed:`,
        (err as { response?: { status?: number } })?.response?.status ?? err,
      );
    }
    if (i + BATCH_SIZE < coords.length) await sleep(BATCH_DELAY_MS);
  }

  const complete = failedBatches === 0;
  console.log(`[AQI] Global pass done: ${points.length} pts, failedBatches=${failedBatches}/${totalBatches}, complete=${complete}`);
  return { points, complete };
}
