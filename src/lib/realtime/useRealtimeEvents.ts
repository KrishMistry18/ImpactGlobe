"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGlobeStore } from "@/store/useGlobeStore";
import type { GlobeEvent } from "@/store/types";

export function useRealtimeEvents() {
  const setEvents = useGlobeStore((s) => s.setEvents);
  const addEvent = useGlobeStore((s) => s.addEvent);

  useEffect(() => {
    const supabase = createClient();

    // Fetch events from the last 48h — this gives the globe a healthy spread
    // from "just now" (freshly polled) to "47h ago" (older but still valid).
    const fetchInitial = async () => {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("published_at", fortyEightHoursAgo)
        .order("published_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[Realtime] fetch error:", error);
        return;
      }
      if (data) {
        setEvents(data.map(mapRow));
      }
    };

    fetchInitial();

    // Subscribe to INSERT / UPDATE — new events arrive live
    // Subscribe to DELETE — when /api/news/refresh clears stale rows,
    //   they're removed from the store immediately (no "17h ago" ghost events)
    const channel = supabase
      .channel("events-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (p) => addEvent(mapRow(p.new as any)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        (p) => addEvent(mapRow(p.new as any)),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "events" },
        (p) => {
          // Remove the deleted event from store
          const deletedId = (p.old as any)?.id;
          if (!deletedId) return;
          setEvents(
            useGlobeStore.getState().events.filter((e) => e.id !== deletedId)
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setEvents, addEvent]);
}

function mapRow(row: any): GlobeEvent {
  return {
    id: row.id,
    headline: row.headline,
    country: row.country,
    lat: Number(row.lat),
    lon: Number(row.lon),
    impactLevel: row.impact_level,
    category: row.category,
    summary: row.summary,
    sentiment: row.sentiment,
    forexImpacts: row.forex_impacts || [],
    confidenceScore: Number(row.confidence_score),
    isMarketMoving: row.is_market_moving,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    sourceUrl: row.source_url || undefined,
    createdBy: row.created_by,
  };
}

