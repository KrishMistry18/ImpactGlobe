"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useGlobeStore } from "@/store/useGlobeStore";
import type { GlobeEvent } from "@/store/types";

export function useRealtimeEvents() {
  const setEvents = useGlobeStore((s) => s.setEvents);
  const addEvent = useGlobeStore((s) => s.addEvent);

  useEffect(() => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Create query for events from the last 48h
    const eventsRef = collection(db, "events");
    const q = query(
      eventsRef,
      where("published_at", ">=", fortyEightHoursAgo),
      orderBy("published_at", "desc"),
      limit(500)
    );

    // Subscribe to realtime updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const isInitialFetch = snapshot.metadata.hasPendingWrites === false && snapshot.docChanges().length === snapshot.size;

        if (isInitialFetch) {
          // Initial fetch: set all events
          const initialEvents = snapshot.docs.map(doc => mapRow({ id: doc.id, ...doc.data() }));
          setEvents(initialEvents);
        } else {
          // Handle incremental changes
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              addEvent(mapRow({ id: change.doc.id, ...change.doc.data() }));
            }
            if (change.type === "removed") {
              const deletedId = change.doc.id;
              setEvents(
                useGlobeStore.getState().events.filter((e) => e.id !== deletedId)
              );
            }
          });
        }
      },
      (error) => {
        console.error("[Realtime] fetch/subscribe error:", error);
      }
    );

    return () => {
      unsubscribe();
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
    impactLevel: row.impact_level || row.impactLevel, // Fallback for camelCase data
    category: row.category,
    summary: row.summary,
    sentiment: row.sentiment,
    forexImpacts: row.forex_impacts || row.forexImpacts || [],
    confidenceScore: Number(row.confidence_score || row.confidenceScore),
    isMarketMoving: row.is_market_moving || row.isMarketMoving,
    publishedAt: row.published_at || row.publishedAt,
    expiresAt: row.expires_at || row.expiresAt,
    sourceUrl: row.source_url || row.sourceUrl || undefined,
    createdBy: row.created_by || row.createdBy,
  };
}

