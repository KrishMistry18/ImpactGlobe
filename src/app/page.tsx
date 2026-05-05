"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import GlobeWrapper from "@/components/globe/GlobeWrapper";
import { EventModal } from "@/components/ui/EventModal";
import { TooltipOverlay } from "@/components/ui/TooltipOverlay";
import { NewsInsightPanel } from '@/components/ui/NewsInsightPanel'
import { EnvDataPanel } from "@/components/ui/EnvDataPanel";
import { NewsTicker } from "@/components/ui/NewsTicker";
import { EnvLayerPanel } from "@/components/ui/EnvLayerPanel";
import { PlaybackControls } from "@/components/ui/PlaybackControls";
import { useRealtimeEvents } from "@/lib/realtime/useRealtimeEvents";
import { useEnvLayer } from "@/hooks/useEnvLayer";
import { useGlobeStore } from "@/store/useGlobeStore";
import type { GlobeRef } from "@/components/globe/GlobeRenderer";
import type { GlobeEvent } from "@/store/types";
import type { HoveredEnvPoint } from "@/store/useGlobeStore";

// 2D map loaded client-side only (Leaflet requires window)
const MapView2D = dynamic(() => import("@/components/map/MapView2D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center"
         style={{ background: "#050d1a", color: "#8aaccc", fontSize: 14 }}>
      Loading 2D Map…
    </div>
  ),
});

export default function Home() {
  const [viewMode, setViewMode] = useState<"globe" | "map">("globe");
  const globeRef = useRef<GlobeRef>(null);
  const newsEvents = useGlobeStore((s) => s.events);
  const setEvents = useGlobeStore((s) => s.setEvents);
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent);
  const setHoveredEvent = useGlobeStore((s) => s.setHoveredEvent);
  const setHoveredEnvPoint = useGlobeStore((s) => s.setHoveredEnvPoint);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const envLayerData = useGlobeStore((s) => s.envLayerData);
  const filters = useGlobeStore((s) => s.filters);

  // Subscribe to realtime events from Supabase
  useRealtimeEvents();

  // Fetch environmental layer data when layer changes
  useEnvLayer(activeEnvLayer);

  // ── Dev-mode cron heartbeat ──────────────────────────────────────────────
  // Vercel crons don't run locally. This fires every minute in development
  // to simulate the cron schedule (forex rotation, env data refresh, etc.).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const fireHeartbeat = () => {
      fetch("/api/cron/heartbeat").catch(() => {});
    };

    // Fire immediately on mount, then every 60 seconds
    fireHeartbeat();
    const interval = setInterval(fireHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, []);

  // On first load with no events: trigger Gemini to generate 20 fresh events.
  // The heartbeat handles hourly refreshes after that.
  useEffect(() => {
    if (newsEvents.length === 0) {
      fetch("/api/news/gemini").catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply filters to news events ──────────────────────────────────────────
  // When categories or impact levels are selected, only events matching ALL
  // active filter criteria appear as ripple markers on the globe.
  const applyFilters = useCallback(
    (events: GlobeEvent[]): GlobeEvent[] => {
      let filtered = events;

      // Time range filter
      const hoursMap: Record<string, number> = {
        "1h": 1,
        "6h": 6,
        "24h": 24,
        "48h": 48,
      };
      const hours = hoursMap[filters.timeRange] ?? 48;
      const cutoff = Date.now() - hours * 3_600_000;
      filtered = filtered.filter(
        (e) => new Date(e.publishedAt).getTime() >= cutoff,
      );

      // Category filter — if any are selected, only show those categories
      if (filters.categories.length > 0) {
        filtered = filtered.filter((e) =>
          filters.categories.includes(e.category),
        );
      }

      // Impact level filter — if any are selected, only show those levels
      if (filters.impactLevels.length > 0) {
        filtered = filtered.filter((e) =>
          filters.impactLevels.includes(e.impactLevel),
        );
      }

      // Search query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.headline.toLowerCase().includes(q) ||
            e.country.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q),
        );
      }

      return filtered;
    },
    [filters],
  );

  // Convert environmental data to event markers
  // Heatmap layers (wind, temp, aqi, sea_temp): hide news ripples — heatmap IS the visualization
  // Discrete layers (earthquakes, fires, storms): show those events as ripple markers
  // None: show all news events as ripples (filtered by active filters)
  const displayEvents = useCallback((): GlobeEvent[] => {
    // Heatmap layers — no ripple markers, the heatmap covers the globe
    if (
      ["wind", "temperature_anomaly", "aqi", "sea_temp"].includes(
        activeEnvLayer,
      )
    ) {
      return [];
    }

    if (activeEnvLayer === "none") {
      // Filter out events with invalid coordinates (0,0 = Gulf of Guinea)
      const validEvents = applyFilters(newsEvents).filter(
        (e) => !(Math.abs(e.lat) < 0.1 && Math.abs(e.lon) < 0.1)
      )

      // ── Pick 5 per tier spread across the 0–47h window ─────────────────
      // Instead of always taking the 5 newest, we divide 47 hours into 5 buckets
      // and pick one event per bucket. This gives the globe events from "just now"
      // AND from several hours ago, covering different regions at different times.
      // Any unfilled buckets fall back to newest-available.
      const spreadPick = (tier: GlobeEvent[]): GlobeEvent[] => {
        const MAX = 5
        if (tier.length <= MAX) return tier

        const now = Date.now()
        const windowMs = 47 * 3_600_000            // 47h total window
        const bucketMs  = windowMs / MAX            // ~9.4h per bucket
        const picked: GlobeEvent[] = []
        const usedIds = new Set<string>()

        // bucket 0 = oldest end, bucket 4 = freshest end
        for (let i = 0; i < MAX; i++) {
          const bucketEnd   = now - (MAX - 1 - i) * bucketMs
          const bucketStart = bucketEnd - bucketMs
          const inBucket = tier
            .filter(e => {
              const t = new Date(e.publishedAt).getTime()
              return t >= bucketStart && t < bucketEnd && !usedIds.has(e.id)
            })
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          if (inBucket.length > 0) {
            picked.push(inBucket[0])
            usedIds.add(inBucket[0].id)
          }
        }

        // Fill any empty buckets with the newest events not yet selected
        if (picked.length < MAX) {
          const remaining = tier
            .filter(e => !usedIds.has(e.id))
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          picked.push(...remaining.slice(0, MAX - picked.length))
        }

        return picked
      }

      const tierEvents = (level: GlobeEvent['impactLevel']) =>
        validEvents.filter(e => e.impactLevel === level)

      const chosen = [
        ...spreadPick(tierEvents('Critical')),
        ...spreadPick(tierEvents('High')),
        ...spreadPick(tierEvents('Medium')),
        ...spreadPick(tierEvents('Low')),
      ]

      // ── Spread events from the same location so each shows as its own ripple ──
      // Without jitter, multiple events from the same country stack on the same
      // pixel and appear as one dot. Golden-angle spiral gives each a unique spot.
      const seen = new Map<string, number>()
      return chosen.map((e) => {
        const key = `${Math.round(e.lat * 10)},${Math.round(e.lon * 10)}`
        const idx = seen.get(key) ?? 0
        seen.set(key, idx + 1)
        if (idx === 0) return e

        const angle  = (idx * 137.5 * Math.PI) / 180  // golden angle
        const radius = 1.5 + idx * 0.8                 // grows per collision (°)
        return { ...e, lat: e.lat + radius * Math.sin(angle), lon: e.lon + radius * Math.cos(angle) }
      })
    }

    // Convert environmental data to GlobeEvent format
    const envEvents: GlobeEvent[] = [];

    if (activeEnvLayer === "earthquakes" && envLayerData?.earthquakes) {
      envLayerData.earthquakes.forEach((quake) => {
        const impactLevel: GlobeEvent["impactLevel"] =
          quake.magnitude >= 6.0
            ? "Critical"
            : quake.magnitude >= 5.0
              ? "High"
              : quake.magnitude >= 4.0
                ? "Medium"
                : "Low";

        envEvents.push({
          id: quake.id,
          headline: `M${quake.magnitude} Earthquake`,
          country: quake.location,
          lat: quake.lat,
          lon: quake.lon,
          impactLevel,
          category: "Natural Disaster",
          summary: `Magnitude ${quake.magnitude} earthquake at depth of ${quake.depth}km. ${quake.location}`,
          sentiment: "Negative",
          forexImpacts: [],
          confidenceScore: 100,
          isMarketMoving: quake.magnitude >= 6.0,
          publishedAt: quake.time,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          sourceUrl: quake.url,
          createdBy: "ai-auto",
        });
      });
    }

    if (activeEnvLayer === "wildfires" && envLayerData?.wildfires) {
      envLayerData.wildfires.forEach((fire) => {
        envEvents.push({
          id: fire.id,
          headline: fire.title,
          country: fire.title.split(",").pop()?.trim() || "Unknown",
          lat: fire.lat,
          lon: fire.lon,
          impactLevel: "High",
          category: "Natural Disaster",
          summary: `Active wildfire: ${fire.title}. Started: ${new Date(fire.date).toLocaleDateString()}`,
          sentiment: "Negative",
          forexImpacts: [],
          confidenceScore: 100,
          isMarketMoving: false,
          publishedAt: fire.date,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          sourceUrl: `https://eonet.gsfc.nasa.gov/`,
          createdBy: "ai-auto",
        });
      });
    }

    if (activeEnvLayer === "storms" && envLayerData?.storms) {
      envLayerData.storms.forEach((storm) => {
        const isHurricane =
          storm.category?.toLowerCase().includes("hurricane") ?? false;
        envEvents.push({
          id: storm.id,
          headline: storm.title,
          country: storm.title.split(",").pop()?.trim() || "Unknown",
          lat: storm.lat,
          lon: storm.lon,
          impactLevel: isHurricane ? "Critical" : "High",
          category: "Natural Disaster",
          summary: `${storm.category || "Storm"}: ${storm.title}`,
          sentiment: "Negative",
          forexImpacts: [],
          confidenceScore: 100,
          isMarketMoving: isHurricane,
          publishedAt: storm.date,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          sourceUrl: `https://eonet.gsfc.nasa.gov/`,
          createdBy: "ai-auto",
        });
      });
    }

    return envEvents;
  }, [activeEnvLayer, envLayerData, newsEvents, applyFilters]);

  const events = displayEvents();

  const handleEventClick = useCallback(
    (event: GlobeEvent) => {
      console.log("[ImpactGlobe] Event clicked:", event.headline);
      // Open modal
      setSelectedEvent(event);
      // Fly to the event location
      globeRef.current?.flyTo(event.lat, event.lon);
    },
    [setSelectedEvent],
  );

  const handleEnvHover = useCallback(
    (point: HoveredEnvPoint | null, pos?: { x: number; y: number }) => {
      setHoveredEnvPoint(point, pos);
    },
    [setHoveredEnvPoint],
  );

  const handleEventHover = useCallback(
    (event: GlobeEvent | null) => {
      if (event) {
        console.log("[ImpactGlobe] Hovering:", event.headline);
        // Update store with hovered event
        setHoveredEvent(event.id, { x: 0, y: 0 }); // Position will be updated by raycaster
      } else {
        setHoveredEvent(null);
      }
    },
    [setHoveredEvent],
  );

  return (
    <AppShell>
      {/* ── View mode toggle ── */}
      <div style={{
        position: "absolute", top: 80, left: 20, zIndex: 50,
        display: "flex", gap: 0, borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(100,150,255,0.2)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
      }}>
        {(["globe", "map"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "7px 18px",
              fontSize: 12, fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: viewMode === mode
                ? "rgba(59,130,246,0.35)"
                : "rgba(5,13,26,0.85)",
              color: viewMode === mode ? "#93c5fd" : "#4a6a8a",
              border: "none", cursor: "pointer",
              borderRight: mode === "globe" ? "1px solid rgba(100,150,255,0.15)" : "none",
              transition: "all .2s",
            }}
          >
            {mode === "globe" ? "🌍 Globe" : "🗺️ Map"}
          </button>
        ))}
      </div>

      {/* ── 3D Globe ── */}
      {viewMode === "globe" && (
        <GlobeWrapper
          ref={globeRef}
          events={events}
          onEventClick={handleEventClick}
          onEventHover={handleEventHover}
          onEnvHover={handleEnvHover}
          activeEnvLayer={activeEnvLayer}
          envLayerData={envLayerData}
        />
      )}

      {/* ── 2D Leaflet Map ── */}
      {viewMode === "map" && (
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <MapView2D
            events={events}
            activeEnvLayer={activeEnvLayer}
            envLayerData={envLayerData}
            onEventClick={handleEventClick}
          />
        </div>
      )}

      {/* Gradient vignette overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(5,10,20,0.7) 100%)",
        }}
      />

      {/* Right sidebar - show EnvDataPanel if env layer active, otherwise NewsInsightPanel */}
      {activeEnvLayer !== "none" ? <EnvDataPanel /> : <NewsInsightPanel />}

      {/* Environmental layer controls */}
      <EnvLayerPanel />

      {/* Playback controls */}
      <PlaybackControls />

      {/* News ticker */}
      <NewsTicker />

      {/* Tooltip overlay */}
      <TooltipOverlay />

      {/* Event modal */}
      <EventModal />
    </AppShell>
  );
}
