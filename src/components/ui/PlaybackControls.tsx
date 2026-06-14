"use client";

/**
 * PlaybackControls — 48-hour event replay
 *
 * Replays events ordered by their REAL recency (publishedAt). The clock runs
 * from just before the oldest event to "now" and reveals each event as its
 * publish time is crossed. The whole window is traversed in a fixed real-time
 * duration (REPLAY_DURATION_MS) — no speed multipliers to fiddle with.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, X, Radio } from "lucide-react";
import { format, subMinutes } from "date-fns";
import { useGlobeStore } from "@/store/useGlobeStore";
import { ImpactBadge } from "./ImpactBadge";
import { convertQuakeToEvent } from "@/lib/utils/events";
import { impactHex } from "@/lib/constants";
import type { GlobeEvent, EarthquakeEvent } from "@/store/types";

const TICK_MS = 100;
/** Real-time duration to traverse the entire window, regardless of its length. */
const REPLAY_DURATION_MS = 30_000;
const TOAST_DURATION_MS = 3_500;

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

  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clock, setClock] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<GlobeEvent | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [allEventsSnap, setAllEventsSnap] = useState<GlobeEvent[]>([]);

  const allEventsRef = useRef<GlobeEvent[]>([]);
  const liveRef = useRef<GlobeEvent[]>([]);
  const clockRef = useRef<Date>(new Date());
  const startRef = useRef<Date>(new Date());
  const nowRef = useRef<Date>(new Date());
  const windowMsRef = useRef<number>(1);
  const prevCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMs = endTime.getTime() - startTime.getTime();
  const elapsedMs = clock.getTime() - startTime.getTime();
  const progress = isOpen && totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const isAtEnd = endTime.getTime() > 0 && clock >= endTime;

  const eventsUpTo = useCallback(
    (t: Date): GlobeEvent[] =>
      allEventsRef.current.filter(
        (e) => new Date(e.publishedAt).getTime() <= t.getTime(),
      ),
    [],
  );

  const showToast = useCallback((event: GlobeEvent) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(event);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const tick = useCallback(() => {
    const advanceMs = windowMsRef.current * (TICK_MS / REPLAY_DURATION_MS);
    const next = new Date(clockRef.current.getTime() + advanceMs);
    const capped = next >= nowRef.current ? nowRef.current : next;

    clockRef.current = capped;
    setClock(capped);

    const visible = eventsUpTo(capped);
    setEvents(visible);
    setVisibleCount(visible.length);

    if (visible.length > prevCountRef.current) {
      showToast(visible[visible.length - 1]);
      prevCountRef.current = visible.length;
    }
    if (capped >= nowRef.current) setIsPlaying(false);
  }, [eventsUpTo, setEvents, showToast]);

  const enterPlayback = useCallback(async () => {
    setIsLoading(true);
    liveRef.current = liveEvents;

    const now = new Date();
    nowRef.current = now;

    let fetched: GlobeEvent[] = [];

    if (activeEnvLayer === "earthquakes") {
      const quakes = envLayerData?.earthquakes ?? [];
      if (quakes.length === 0) {
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
      try {
        const res = await fetch("/api/events?include_expired=true&timeRange=24h");
        const data = await res.json();
        fetched = (Array.isArray(data) ? data : (data.events ?? [])).filter(
          (e: GlobeEvent) => e.publishedAt,
        );
      } catch {
        /* fall through */
      }
      if (fetched.length === 0) fetched = liveEvents.filter((e) => e.publishedAt);
    }

    if (fetched.length === 0) {
      setIsLoading(false);
      alert(
        activeEnvLayer === "earthquakes"
          ? "No earthquake data available to replay. Enable the Earthquakes layer first."
          : "No events found in the last 24 hours to replay.",
      );
      return;
    }

    const sorted = [...fetched].sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
    );
    allEventsRef.current = sorted;

    const oldest = new Date(sorted[0].publishedAt);
    const start = subMinutes(oldest, 5);
    startRef.current = start;
    clockRef.current = start;
    windowMsRef.current = Math.max(1, now.getTime() - start.getTime());
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
  }, [liveEvents, setEvents, activeEnvLayer, envLayerData]);

  const exitPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setIsPlaying(false);
    setIsOpen(false);
    setToast(null);
    setTotalCount(0);
    setAllEventsSnap([]);
    allEventsRef.current = [];
    setEvents(liveRef.current);
  }, [setEvents]);

  useEffect(() => {
    if (!isOpen) return;
    if (isPlaying && !isAtEnd) {
      intervalRef.current = setInterval(tick, TICK_MS);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, isOpen, isAtEnd, tick]);

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

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(new Date(startTime.getTime() + pct * (endTime.getTime() - startTime.getTime())));
  };

  // Hide on incompatible layers
  const hiddenLayer = (PLAYBACK_HIDDEN_LAYERS as readonly string[]).includes(activeEnvLayer);
  useEffect(() => {
    if (hiddenLayer && isOpen) {
      const t = setTimeout(() => exitPlayback(), 0);
      return () => clearTimeout(t);
    }
  }, [hiddenLayer, isOpen, exitPlayback]);
  if (hiddenLayer) return null;

  // ── Collapsed button ──────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="fixed bottom-14 left-1/2 z-30 -translate-x-1/2">
        <button
          onClick={enterPlayback}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface/90 px-5 py-2 text-sm font-medium text-text-primary shadow-xl backdrop-blur-sm transition-all hover:bg-bg-elevated disabled:opacity-60"
        >
          <RotateCcw className={`h-4 w-4 text-accent ${isLoading ? "animate-spin" : ""}`} />
          {isLoading
            ? "Loading…"
            : activeEnvLayer === "earthquakes"
              ? "Replay Earthquakes"
              : "Replay Last 24 Hours"}
        </button>
      </div>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────────────
  return (
    <>
      {toast && (
        <div key={toast.id} className="fixed bottom-24 left-4 z-50 animate-fade-in">
          <div className="flex max-w-xs items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/95 p-3 shadow-2xl backdrop-blur-md">
            <span className="mt-0.5 inline-flex h-3 w-3 text-impact-critical">
              <span className="live-dot h-3 w-3" />
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-impact-critical">
                  New Event
                </span>
                <ImpactBadge level={toast.impactLevel} size="sm" />
              </div>
              <p className="truncate text-xs font-medium text-text-primary">{toast.headline}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {toast.country} · {format(new Date(toast.publishedAt), "MMM d, HH:mm")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-14 left-1/2 z-30 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-accent" />
              <span className="font-mono text-sm font-semibold text-text-primary">
                {format(clock, "MMM d, HH:mm")}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-3 py-1">
              <span className="text-xs font-medium text-text-primary">{visibleCount}</span>
              <span className="text-xs text-text-muted">/ {totalCount} events</span>
            </div>

            <button
              onClick={exitPlayback}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Exit playback"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Event markers */}
          <div className="relative mb-1 h-3">
            {allEventsSnap.map((e) => {
              const range = endTime.getTime() - startTime.getTime();
              if (range <= 0) return null;
              const pct =
                ((new Date(e.publishedAt).getTime() - startTime.getTime()) / range) * 100;
              if (pct < 0 || pct > 100) return null;
              const revealed = new Date(e.publishedAt).getTime() <= clock.getTime();
              return (
                <div
                  key={e.id}
                  title={`${e.headline} — ${format(new Date(e.publishedAt), "MMM d HH:mm")}`}
                  className="absolute top-0.5 h-2 w-2 cursor-pointer rounded-full transition-all"
                  style={{
                    left: `${pct}%`,
                    backgroundColor: revealed ? impactHex(e.impactLevel) : "rgba(255,255,255,0.15)",
                    transform: `translateX(-50%) scale(${revealed ? 1 : 0.7})`,
                  }}
                  onClick={() => seekTo(new Date(e.publishedAt))}
                />
              );
            })}
          </div>

          {/* Scrubber */}
          <div
            className="mb-3 h-1.5 w-full cursor-pointer rounded-full bg-bg-elevated"
            onClick={handleScrub}
            title="Drag to seek"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between">
            <span className="w-24 text-[10px] text-text-muted">
              {format(startTime, "MMM d HH:mm")}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={restart}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                title="Restart"
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
                onClick={() => (isAtEnd ? restart() : setIsPlaying((p) => !p))}
                className="mx-1 rounded-xl bg-accent px-5 py-2 text-bg-primary transition-colors hover:bg-accent-strong"
                title={isAtEnd ? "Replay" : isPlaying ? "Pause" : "Play"}
              >
                {isAtEnd ? (
                  <RotateCcw className="h-4 w-4" />
                ) : isPlaying ? (
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

            <span className="w-24 text-right text-[10px] text-text-muted">
              {format(endTime, "MMM d HH:mm")}
            </span>
          </div>

          {isAtEnd && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-text-muted">
              <span>All {totalCount} events replayed —</span>
              <button onClick={restart} className="font-medium text-accent underline underline-offset-2">
                replay again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
