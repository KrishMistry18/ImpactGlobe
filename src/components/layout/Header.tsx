"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { FilterBar } from "@/components/ui/FilterBar";
import { isValidCoord, ENV_LAYER_META } from "@/lib/constants";
import { Globe } from "lucide-react";

export function Header() {
  const events = useGlobeStore((s) => s.events);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const tracked = events.filter((e) => isValidCoord(e.lat, e.lon)).length;
  const layer = ENV_LAYER_META[activeEnvLayer];

  return (
    <header className="panel fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border-subtle px-5">
      {/* Brand + live */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">
            <Globe className="h-4 w-4" />
          </span>
          <h1 className="font-display text-lg font-bold tracking-tight text-text-primary">
            Impact<span className="text-accent">Globe</span>
          </h1>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-impact-critical/10 px-2.5 py-1 text-impact-critical sm:flex">
          <span className="live-dot h-2 w-2" />
          <span className="text-[10px] font-semibold uppercase tracking-widest">Live</span>
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-1 justify-center px-2">
        <FilterBar />
      </div>

      {/* Status */}
      <div className="hidden shrink-0 items-center gap-3 md:flex">
        {activeEnvLayer !== "none" && (
          <span
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ background: `${layer.accent}1a`, color: layer.accent }}
          >
            <layer.Icon className="h-3.5 w-3.5" />
            {layer.label}
          </span>
        )}
        <div className="flex items-center gap-2 rounded-lg bg-bg-card/70 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-xs font-medium text-text-secondary">
            {tracked} <span className="text-text-muted">tracked</span>
          </span>
        </div>
      </div>
    </header>
  );
}
