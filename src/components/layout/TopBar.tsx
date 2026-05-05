"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { FilterBar } from "@/components/ui/FilterBar";

export default function TopBar() {
  const events = useGlobeStore((s) => s.events);

  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-border-subtle bg-bg-surface/80 px-6 backdrop-blur-sm">
      {/* Logo + live indicator */}
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="font-display text-xl font-bold text-text-primary">
          Impact<span className="text-impact-critical">Globe</span>
        </h1>
        <div className="flex items-center gap-2 rounded-full bg-impact-critical/10 px-3 py-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-impact-critical" />
          <span className="text-xs font-medium uppercase tracking-wide text-impact-critical">
            Live
          </span>
        </div>
      </div>

      {/* Filter bar — centre */}
      <div className="flex-1 px-8">
        <FilterBar />
      </div>

      {/* Event counter — total tracked vs displayed on globe */}
      <div className="flex items-center gap-2 rounded-lg bg-bg-card px-4 py-2 shrink-0">
        <div className="h-2 w-2 rounded-full bg-env-wind" />
        <span className="text-sm font-medium text-text-secondary">
          {events.filter(e => !(Math.abs(e.lat) < 0.1 && Math.abs(e.lon) < 0.1)).length} EVENTS TRACKED
        </span>
      </div>
    </header>
  );
}
