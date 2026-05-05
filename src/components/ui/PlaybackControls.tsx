"use client";

/**
 * PlaybackControls — real-data 48-hour event replay
 *
 * How it works:
 * 1. Click "Replay" → fetch ALL events from DB (last 48h, including expired)
 *    If DB returns nothing, fall back to whatever live events are in the store.
 * 2. Sort events oldest → newest by publishedAt.
 * 3. Smart-start: clock begins at (oldest event's publishedAt - 5 min) so the
 *    first event appears almost immediately.  The range shown on the scrubber is
 *    oldest → now.  No more "empty globe for 45 hours" problem.
 * 4. Every 100 ms tick, advance the virtual clock and reveal any events whose
 *    publishedAt ≤ clock.  Newly-crossed events trigger a "just appeared" toast.
 * 5. The globe shows exactly the events that existed at that moment in time.
 * 6. Speed options: 10× | 30× | 60×  (minutes-of-history per real second)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  Zap,
  Radio,
} from "lucide-react";
import { format, subMinutes } from "date-fns";
import { useGlobeStore } from "@/store/useGlobeStore";
import { ImpactBadge } from "./ImpactBadge";
import type { GlobeEvent, EarthquakeEvent } from "@/store/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS = 100; // real-time interval between ticks
const SPEEDS = [10, 30, 60] as const; // virtual minutes advanced per real second
type Speed = (typeof SPEEDS)[number];

const TOAST_DURATION_MS = 3500; // how long the "new event" toast shows

// ─── Component ────────────────────────────────────────────────────────────────

// Layers where playback makes no sense (continuous heatmap or live-only data)
const PLAYBACK_HIDDEN_LAYERS = [
  "wind",
  "temperature_anomaly",
  "aqi",
  "sea_temp",
  "wildfires",
  "storms",
] as const;

export function PlaybackControls() {
  const setEvents = useGlobeStore((s) => s.setEvents);
  const liveEvents = useGlobeStore((s) => s.events);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const envLayerData = useGlobeStore((s) => s.envLayerData);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(30);
  const [clock, setClock] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<GlobeEvent | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [allEventsSnap, setAllEventsSnap] = useState<GlobeEvent[]>([]);

  // ── Stable refs (no stale closures in intervals) ──────────────────────────
  const allEventsRef = useRef<GlobeEvent[]>([]); // full 48h set, sorted asc
  const liveRef = useRef<GlobeEvent[]>([]); // snapshot to restore on exit
  const clockRef = useRef<Date>(new Date());
  const startRef = useRef<Date>(new Date()); // oldest event time - 5min
  const nowRef = useRef<Date>(new Date()); // "present" = time of fetch
  const prevCountRef = useRef(0); // track when a new event crosses the threshold
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef<Speed>(speed);
  // Keep speedRef in sync via effect (not direct render mutation)
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // ── Derived (use state mirrors for render-safe values) ──────────────────
  const totalMs = endTime.getTime() - startTime.getTime();
  const elapsedMs = clock.getTime() - startTime.getTime();
  const progress =
    isOpen && totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const isAtEnd = endTime.getTime() > 0 && clock >= endTime;

  // ── eventsUpTo: events published at or before `t` ─────────────────────────
  const eventsUpTo = useCallback(
    (t: Date): GlobeEvent[] =>
      allEventsRef.current.filter(
        (e) => new Date(e.publishedAt).getTime() <= t.getTime(),
      ),
    [],
  );

  // ── showToast: display the "new event" badge briefly ──────────────────────
  const showToast = useCallback((event: GlobeEvent) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(event);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // ── tick: advance clock, reveal events, fire toast on new arrivals ─────────
  const tick = useCallback(() => {
    // advance by (speed mins / sec) * (tick interval / 1000)
    const advanceMs = speedRef.current * 60_000 * (TICK_MS / 1000);
    const next = new Date(clockRef.current.getTime() + advanceMs);
    const capped = next >= nowRef.current ? nowRef.current : next;

    clockRef.current = capped;
    setClock(capped);

    const visible = eventsUpTo(capped);
    setEvents(visible);
    setVisibleCount(visible.length);

    // Detect newly-revealed events → show toast for the latest one
    if (visible.length > prevCountRef.current) {
      const newest = visible[visible.length - 1];
      showToast(newest);
      prevCountRef.current = visible.length;
    }

    if (capped >= nowRef.current) {
      setIsPlaying(false);
    }
  }, [eventsUpTo, setEvents, showToast]);

  // ── convertQuakeToEvent: turn EarthquakeEvent into a GlobeEvent ─────────
  const convertQuakeToEvent = useCallback(
    (quake: EarthquakeEvent): GlobeEvent => ({
      id: quake.id,
      headline: `M${quake.magnitude.toFixed(1)} Earthquake — ${quake.location}`,
      country: quake.location,
      lat: quake.lat,
      lon: quake.lon,
      impactLevel:
        quake.magnitude >= 6.0
          ? "Critical"
          : quake.magnitude >= 5.0
            ? "High"
            : quake.magnitude >= 4.0
              ? "Medium"
              : "Low",
      category: "Natural Disaster",
      summary: `Magnitude ${quake.magnitude.toFixed(1)} earthquake at ${quake.depth}km depth. ${quake.location}`,
      sentiment: "Negative",
      forexImpacts: [],
      confidenceScore: 100,
      isMarketMoving: quake.magnitude >= 6.0,
      publishedAt: quake.time,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      sourceUrl: quake.url,
      createdBy: "ai-auto",
    }),
    [],
  );

  // ── enterPlayback ─────────────────────────────────────────────────────────
  const enterPlayback = useCallback(async () => {
    setIsLoading(true);
    liveRef.current = liveEvents; // snapshot live events

    const now = new Date();
    nowRef.current = now;

    let fetched: GlobeEvent[] = [];

    // ── Earthquake playback: use envLayerData (already fetched) ──────────
    if (activeEnvLayer === "earthquakes") {
      const quakes = envLayerData?.earthquakes ?? [];
      if (quakes.length === 0) {
        // Try to fetch from API
        try {
          const res = await fetch("/api/env/earthquakes");
          const data = await res.json();
          const eq: EarthquakeEvent[] = data.earthquakes ?? [];
          fetched = eq.map(convertQuakeToEvent);
        } catch {
          /* skip */
        }
      } else {
        fetched = quakes.map(convertQuakeToEvent);
      }
    } else {
      // ── News event playback: fetch from events API ──────────────────────
      try {
        const res = await fetch(
          "/api/events?include_expired=true&timeRange=48h",
        );
        const data = await res.json();
        fetched = (Array.isArray(data) ? data : (data.events ?? [])).filter(
          (e: GlobeEvent) => e.publishedAt,
        );
      } catch {
        /* fall through */
      }

      // Fallback to live store events
      if (fetched.length === 0) {
        fetched = liveEvents.filter((e) => e.publishedAt);
      }
    }

    if (fetched.length === 0) {
      setIsLoading(false);
      alert(
        activeEnvLayer === "earthquakes"
          ? "No earthquake data available to replay. Enable the Earthquakes layer first."
          : "No events found in the last 48 hours to replay.",
      );
      return;
    }

    // Sort oldest → newest
    const sorted = [...fetched].sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
    );
    allEventsRef.current = sorted;

    // Smart-start: 5 minutes before the oldest event
    const oldest = new Date(sorted[0].publishedAt);
    const start = subMinutes(oldest, 5);
    startRef.current = start;
    clockRef.current = start;
    prevCountRef.current = 0;

    setClock(start);
    setStartTime(start);
    setEndTime(now);
    setTotalCount(sorted.length);
    setAllEventsSnap(sorted);
    setVisibleCount(0);
    setToast(null);
    setEvents([]);
    setIsOpen(true);
    setIsLoading(false);
    setIsPlaying(true);
  }, [
    liveEvents,
    setEvents,
    activeEnvLayer,
    envLayerData,
    convertQuakeToEvent,
  ]);

  // ── exitPlayback ──────────────────────────────────────────────────────────
  const exitPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setIsPlaying(false);
    setIsOpen(false);
    setToast(null);
    setTotalCount(0);
    setAllEventsSnap([]);
    allEventsRef.current = [];
    setEvents(liveRef.current);
  }, [setEvents]);

  // ── Play/pause interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (isPlaying && !isAtEnd) {
      intervalRef.current = setInterval(tick, TICK_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, isOpen, isAtEnd, tick]);

  // ── seekTo ────────────────────────────────────────────────────────────────
  const seekTo = useCallback(
    (t: Date) => {
      const s = startRef.current;
      const e = nowRef.current;
      const clamped = t < s ? s : t > e ? e : t;
      clockRef.current = clamped;
      const visible = eventsUpTo(clamped);
      prevCountRef.current = visible.length;
      setClock(clamped);
      setEvents(visible);
      setVisibleCount(visible.length);
    },
    [eventsUpTo, setEvents],
  );

  const skipBack = () => seekTo(new Date(clock.getTime() - 3_600_000));
  const skipForward = () => seekTo(new Date(clock.getTime() + 3_600_000));
  const restart = () => {
    seekTo(startTime);
    prevCountRef.current = 0;
    setIsPlaying(true);
  };

  // ── Scrubber drag ─────────────────────────────────────────────────────────
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(
      new Date(
        startTime.getTime() + pct * (endTime.getTime() - startTime.getTime()),
      ),
    );
  };

  // ── Hide on incompatible layers (use useEffect for side-effect) ────────
  const hiddenLayer = (PLAYBACK_HIDDEN_LAYERS as readonly string[]).includes(
    activeEnvLayer,
  );
  useEffect(() => {
    if (hiddenLayer && isOpen) {
      const t = setTimeout(() => exitPlayback(), 0);
      return () => clearTimeout(t);
    }
  }, [hiddenLayer, isOpen, exitPlayback]);
  if (hiddenLayer) return null;

  // ── Collapsed button ────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="fixed bottom-14 left-1/2 z-30 -translate-x-1/2">
        <button
          onClick={enterPlayback}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface/90 px-5 py-2 text-sm font-medium text-text-primary shadow-xl backdrop-blur-sm transition-all hover:bg-bg-elevated disabled:opacity-60"
        >
          <RotateCcw
            className={`h-4 w-4 text-impact-medium ${isLoading ? "animate-spin" : ""}`}
          />
          {isLoading
            ? "Loading…"
            : activeEnvLayer === "earthquakes"
              ? "Replay Earthquakes"
              : "Replay Last 48 Hours"}
        </button>
      </div>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <>
      {/* New-event toast — slides in from the left */}
      {toast && (
        <div
          key={toast.id}
          className="fixed left-4 z-50 animate-fade-in"
          style={{ bottom: "6rem" }}
        >
          <div className="flex max-w-xs items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/95 p-3 shadow-2xl backdrop-blur-md">
            {/* Pulsing dot */}
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-impact-critical opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-impact-critical" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-impact-critical">
                  New Event
                </span>
                <ImpactBadge level={toast.impactLevel} size="sm" />
              </div>
              <p className="truncate text-xs font-medium text-text-primary">
                {toast.headline}
              </p>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {toast.country} · {format(new Date(toast.publishedAt), "HH:mm")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main controls panel */}
      <div className="fixed bottom-14 left-1/2 z-30 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
          {/* ── Header row ─────────────────────────────────────────────── */}
          <div className="mb-3 flex items-center justify-between gap-3">
            {/* Live-clock badge */}
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-impact-medium" />
              <span className="font-mono text-sm font-semibold text-text-primary">
                {format(clock, "MMM d, HH:mm")}
              </span>
            </div>

            {/* Event counter */}
            <div className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-3 py-1">
              <span className="text-xs font-medium text-text-primary">
                {visibleCount}
              </span>
              <span className="text-xs text-text-muted">
                / {totalCount} events
              </span>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-text-muted" />
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors ${
                    speed === s
                      ? "bg-impact-medium text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {s === 10 ? "10×" : s === 30 ? "30×" : "60×"}
                </button>
              ))}
            </div>

            {/* Exit */}
            <button
              onClick={exitPlayback}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Exit playback"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Timeline ──────────────────────────────────────────────────── */}
          {/* Event markers above the scrubber */}
          <div className="relative mb-1 h-3">
            {allEventsSnap.map((e) => {
              const range = endTime.getTime() - startTime.getTime();
              if (range <= 0) return null;
              const pct =
                ((new Date(e.publishedAt).getTime() - startTime.getTime()) /
                  range) *
                100;
              if (pct < 0 || pct > 100) return null;
              const revealed =
                new Date(e.publishedAt).getTime() <= clock.getTime();
              return (
                <div
                  key={e.id}
                  title={`${e.headline} — ${format(new Date(e.publishedAt), "HH:mm")}`}
                  className="absolute top-0.5 h-2 w-2 -translate-x-1/2 cursor-pointer rounded-full transition-all"
                  style={{
                    left: `${pct}%`,
                    backgroundColor: revealed
                      ? e.impactLevel === "Critical"
                        ? "#ef4444"
                        : e.impactLevel === "High"
                          ? "#f97316"
                          : e.impactLevel === "Medium"
                            ? "#eab308"
                            : "#22c55e"
                      : "rgba(255,255,255,0.15)",
                    transform: `translateX(-50%) scale(${revealed ? 1 : 0.7})`,
                  }}
                  onClick={() => seekTo(new Date(e.publishedAt))}
                />
              );
            })}
          </div>

          {/* Scrubber bar */}
          <div
            className="mb-3 h-1.5 w-full cursor-pointer rounded-full bg-bg-elevated"
            onClick={handleScrub}
            title="Drag to seek"
          >
            <div
              className="h-full rounded-full bg-impact-medium transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── Transport row ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            {/* Start label */}
            <span className="w-24 text-[10px] text-text-muted">
              {format(startTime, "MMM d HH:mm")}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={restart}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                title="Restart from beginning"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={skipBack}
                disabled={clock <= startTime}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
                title="Back 1 hour"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                disabled={isAtEnd}
                className="mx-1 rounded-xl bg-impact-medium px-5 py-2 text-white transition-colors hover:bg-impact-medium/80 disabled:opacity-50"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={skipForward}
                disabled={isAtEnd}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
                title="Forward 1 hour"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* End label */}
            <span className="w-24 text-right text-[10px] text-text-muted">
              {format(endTime, "MMM d HH:mm")}
            </span>
          </div>

          {/* ── Caught-up message ──────────────────────────────────────────── */}
          {isAtEnd && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-text-muted">
              <span>All {totalCount} events replayed —</span>
              <button
                onClick={restart}
                className="font-medium text-impact-medium underline underline-offset-2"
              >
                replay again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
