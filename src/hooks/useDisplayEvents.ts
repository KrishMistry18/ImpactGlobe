"use client";

import { useMemo } from "react";
import { useGlobeStore } from "@/store/useGlobeStore";
import {
  convertQuakeToEvent,
  convertWildfireToEvent,
  convertStormToEvent,
} from "@/lib/utils/events";
import {
  isHeatmapLayer,
  isValidCoord,
  TIME_RANGE_HOURS,
} from "@/lib/constants";
import type { GlobeEvent, Filters, ImpactLevel } from "@/store/types";

const MAX_PER_TIER = 5;
const TIERS: ImpactLevel[] = ["Critical", "High", "Medium", "Low"];

/** Apply the active filters (time/category/impact/search) to a list of events. */
function applyFilters(events: GlobeEvent[], filters: Filters): GlobeEvent[] {
  const hours = TIME_RANGE_HOURS[filters.timeRange] ?? 48;
  const cutoff = Date.now() - hours * 3_600_000;

  let out = events.filter(
    (e) => new Date(e.publishedAt).getTime() >= cutoff,
  );

  if (filters.categories.length > 0) {
    out = out.filter((e) => filters.categories.includes(e.category));
  }
  if (filters.impactLevels.length > 0) {
    out = out.filter((e) => filters.impactLevels.includes(e.impactLevel));
  }
  const q = filters.searchQuery.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (e) =>
        e.headline.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q),
    );
  }
  return out;
}

/**
 * Pick up to 5 events per tier, spread across the 47-hour window so the globe
 * shows events from "just now" AND several hours ago rather than only the
 * newest. Empty buckets fall back to newest-available.
 */
function spreadPick(tier: GlobeEvent[]): GlobeEvent[] {
  if (tier.length <= MAX_PER_TIER) return tier;

  const now = Date.now();
  const windowMs = 47 * 3_600_000;
  const bucketMs = windowMs / MAX_PER_TIER;
  const picked: GlobeEvent[] = [];
  const used = new Set<string>();

  for (let i = 0; i < MAX_PER_TIER; i++) {
    const bucketEnd = now - (MAX_PER_TIER - 1 - i) * bucketMs;
    const bucketStart = bucketEnd - bucketMs;
    const inBucket = tier
      .filter((e) => {
        const t = new Date(e.publishedAt).getTime();
        return t >= bucketStart && t < bucketEnd && !used.has(e.id);
      })
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    if (inBucket.length > 0) {
      picked.push(inBucket[0]);
      used.add(inBucket[0].id);
    }
  }

  if (picked.length < MAX_PER_TIER) {
    const rest = tier
      .filter((e) => !used.has(e.id))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    picked.push(...rest.slice(0, MAX_PER_TIER - picked.length));
  }
  return picked;
}

/**
 * De-overlap events that share a location using a golden-angle spiral, so each
 * shows as its own ripple instead of stacking on one pixel.
 */
function jitterColocated(events: GlobeEvent[]): GlobeEvent[] {
  const seen = new Map<string, number>();
  return events.map((e) => {
    const key = `${Math.round(e.lat * 10)},${Math.round(e.lon * 10)}`;
    const idx = seen.get(key) ?? 0;
    seen.set(key, idx + 1);
    if (idx === 0) return e;
    const angle = (idx * 137.5 * Math.PI) / 180;
    const radius = 1.5 + idx * 0.8;
    return {
      ...e,
      lat: e.lat + radius * Math.sin(angle),
      lon: e.lon + radius * Math.cos(angle),
    };
  });
}

/**
 * Derive the set of GlobeEvents to render given the active layer:
 *  - heatmap layers → no markers (the heatmap is the visualization)
 *  - marker layers (quakes/fires/storms) → converted env markers
 *  - none → filtered news events (≤5 per tier, jittered)
 */
export function useDisplayEvents(): GlobeEvent[] {
  const newsEvents = useGlobeStore((s) => s.events);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const envLayerData = useGlobeStore((s) => s.envLayerData);
  const filters = useGlobeStore((s) => s.filters);

  return useMemo(() => {
    if (isHeatmapLayer(activeEnvLayer)) return [];

    if (activeEnvLayer === "earthquakes") {
      return (envLayerData?.earthquakes ?? []).map(convertQuakeToEvent);
    }
    if (activeEnvLayer === "wildfires") {
      return (envLayerData?.wildfires ?? []).map(convertWildfireToEvent);
    }
    if (activeEnvLayer === "storms") {
      return (envLayerData?.storms ?? []).map(convertStormToEvent);
    }

    // activeEnvLayer === "none" → filtered news events
    const valid = applyFilters(newsEvents, filters).filter((e) =>
      isValidCoord(e.lat, e.lon),
    );
    const chosen = TIERS.flatMap((tier) =>
      spreadPick(valid.filter((e) => e.impactLevel === tier)),
    );
    return jitterColocated(chosen);
  }, [activeEnvLayer, envLayerData, newsEvents, filters]);
}
