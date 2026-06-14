"use client";

import { useEffect } from "react";

/**
 * Dev-only cron simulator. Vercel crons don't run locally, so in development
 * we ping the heartbeat endpoint once on mount and then every minute. The
 * heartbeat route decides which jobs are actually due.
 */
export function useHeartbeat() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const fire = () => fetch("/api/cron/heartbeat").catch(() => {});
    fire();
    const id = setInterval(fire, 60_000);
    return () => clearInterval(id);
  }, []);
}

/**
 * On first load with no events in the store, kick off Gemini event generation
 * once. Subsequent refreshes are handled by the heartbeat.
 */
export function useInitialEventSeed(hasEvents: boolean) {
  useEffect(() => {
    if (!hasEvents) fetch("/api/news/gemini").catch(() => {});
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
