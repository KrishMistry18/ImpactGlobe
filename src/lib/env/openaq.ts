/**
 * Air Quality data via Open-Meteo Air Quality API
 * Free, no API key required.
 * https://air-quality-api.open-meteo.com
 *
 * NOTE: OpenAQ v2 was retired. OpenAQ v3 requires an API key.
 * Open-Meteo provides equivalent PM2.5 + AQI data for free with no key.
 *
 * Rate limits: same as Open-Meteo weather (600 req/min, 5000/hr, 10000/day)
 * With 6-hour zone caching, actual calls ≈ 4/day. ✅
 */

import axios from "axios";
import type { AQIPoint } from "@/store/types";
import { type GlobeZone, generateZoneGrid } from "./zones";

const BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

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

// ─── Zone-based AQI fetch ─────────────────────────────────────────────────────

/**
 * Fetch AQI for a zone using Open-Meteo Air Quality API.
 * Uses a 10° grid — enough resolution for a heatmap overlay.
 * Batches 10 points per request (same pattern as weather API).
 */
export async function getAQIForZone(zone: GlobeZone): Promise<AQIPoint[]> {
  const points: AQIPoint[] = [];
  const batchSize = 10;

  // 10° resolution — coarser than wind but fine for AQI heatmap
  const coords = generateZoneGrid(zone, 10);

  console.log(
    `[AQI] Fetching for zone: ${zone.name} (${coords.length} points)`,
  );

  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize);
    const latitudes = batch.map((c) => c.lat).join(",");
    const longitudes = batch.map((c) => c.lon).join(",");

    try {
      const { data } = await axios.get(BASE, {
        params: {
          latitude: latitudes,
          longitude: longitudes,
          current: "pm2_5,european_aqi",
          forecast_days: 1,
        },
        timeout: 12000,
      });

      const results = Array.isArray(data) ? data : [data];
      results.forEach((result: Record<string, unknown>, idx: number) => {
        const current = result.current as Record<string, number> | undefined;
        if (!current) return;

        const pm25 = current.pm2_5 ?? 0;
        // Prefer european_aqi (0–500 continuous scale) when available;
        // fall back to EPA conversion from PM2.5 otherwise.
        const eaqi = current.european_aqi ?? null;
        const aqi = eaqi != null ? Math.round(eaqi * 5) : aqiFromPm25(pm25);
        // european_aqi is 0–100 CAQI scale; multiply ×5 to map to US EPA 0–500 range
        // so the same colour scale applies to all points uniformly.
        if (aqi < 0) return; // skip missing data

        points.push({
          lat: batch[idx].lat,
          lon: batch[idx].lon,
          city: `${batch[idx].lat.toFixed(1)}°, ${batch[idx].lon.toFixed(1)}°`,
          country: "",
          aqi,
          pm25,
          category: aqiCategory(Math.min(aqi, 500)),
        });
      });
    } catch {
      // Skip failed batches silently
    }

    // 1-second delay between batches
    if (i + batchSize < coords.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`[AQI] Fetched ${points.length} points for ${zone.name}`);
  return points;
}

// ─── Legacy exports (kept for backward compat) ───────────────────────────────

export function aqiColor(category: AQIPoint["category"]): string {
  switch (category) {
    case "Good":
      return "#00e676";
    case "Moderate":
      return "#ffeb3b";
    case "Unhealthy for Sensitive":
      return "#ff9800";
    case "Unhealthy":
      return "#f44336";
    case "Very Unhealthy":
      return "#9c27b0";
    case "Hazardous":
      return "#7b1fa2";
    default:
      return "#ffffff";
  }
}

export async function getGlobalAQI(): Promise<AQIPoint[]> {
  // Fetch a coarse global grid as fallback
  const coords: { lat: number; lon: number }[] = [];
  for (let lat = -80; lat <= 80; lat += 20) {
    for (let lon = -180; lon <= 170; lon += 20) {
      coords.push({ lat, lon });
    }
  }

  const points: AQIPoint[] = [];
  const batchSize = 10;

  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize);
    try {
      const { data } = await axios.get(BASE, {
        params: {
          latitude: batch.map((c) => c.lat).join(","),
          longitude: batch.map((c) => c.lon).join(","),
          current: "pm2_5,european_aqi",
          forecast_days: 1,
        },
        timeout: 12000,
      });
      const results = Array.isArray(data) ? data : [data];
      results.forEach((result: Record<string, unknown>, idx: number) => {
        const current = result.current as Record<string, number> | undefined;
        if (current?.pm2_5 != null) {
          const pm25 = current.pm2_5;
          const aqi = aqiFromPm25(pm25);
          points.push({
            lat: batch[idx].lat,
            lon: batch[idx].lon,
            city: `${batch[idx].lat}°, ${batch[idx].lon}°`,
            country: "",
            aqi,
            pm25,
            category: aqiCategory(aqi),
          });
        }
      });
    } catch {
      /* skip */
    }
    if (i + batchSize < coords.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return points;
}
