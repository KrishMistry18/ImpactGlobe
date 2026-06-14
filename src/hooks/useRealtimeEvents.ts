"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useGlobeStore } from "@/store/useGlobeStore";
import type { GlobeEvent } from "@/store/types";

export function useRealtimeEvents() {
  const setEvents = useGlobeStore((s) => s.setEvents);

  useEffect(() => {
    const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    
    const eventsQuery = query(
      collection(db, "events"),
      where("published_at", ">=", since),
      orderBy("published_at", "desc"),
      limit(500)
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      // Get all current events
      const allEvents = snapshot.docs.map(doc => mapRow({ id: doc.id, ...doc.data() }));
      setEvents(allEvents);
    }, (error) => {
      console.error("[Realtime] fetch error:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [setEvents]);
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
