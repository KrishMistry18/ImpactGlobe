"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import type { EventCategory, ImpactLevel } from "@/store/types";
import { Search, X, Layers, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ENV_LAYER_ORDER,
  ENV_LAYER_META,
  CATEGORIES,
  IMPACT_LEVELS,
  IMPACT_META,
} from "@/lib/constants";

/** Closes a popover when clicking outside its ref. */
function useOutsideClose(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, close]);
}

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useGlobeStore((s) => s.filters);
  const setFilters = useGlobeStore((s) => s.setFilters);
  const toggleCategory = useGlobeStore((s) => s.toggleCategory);
  const toggleImpactLevel = useGlobeStore((s) => s.toggleImpactLevel);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const setActiveEnvLayer = useGlobeStore((s) => s.setActiveEnvLayer);

  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  useOutsideClose(layersRef, () => setLayersOpen(false));
  useOutsideClose(filtersRef, () => setFiltersOpen(false));

  // Init filters from URL once.
  useEffect(() => {
    setFilters({
      categories: (searchParams.get("category")?.split(",") as EventCategory[]) ?? [],
      impactLevels: (searchParams.get("impact")?.split(",") as ImpactLevel[]) ?? [],
      timeRange: (searchParams.get("timeRange") as Filters_TimeRange) || "24h",
      searchQuery: searchParams.get("q") || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters → URL.
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.categories.length) p.set("category", filters.categories.join(","));
    if (filters.impactLevels.length) p.set("impact", filters.impactLevels.join(","));
    if (filters.timeRange !== "24h") p.set("timeRange", filters.timeRange);
    if (filters.searchQuery) p.set("q", filters.searchQuery);
    const qs = p.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [filters, router]);

  const activeCount =
    filters.categories.length +
    filters.impactLevels.length +
    (filters.searchQuery ? 1 : 0);
  const layerMeta = ENV_LAYER_META[activeEnvLayer];

  return (
    <div className="flex items-center gap-2.5">
      {/* Search */}
      <div className="relative w-44 lg:w-56">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          placeholder="Search events…"
          className="w-full rounded-lg border border-border-subtle bg-bg-card/70 py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none"
        />
        {filters.searchQuery && (
          <button
            onClick={() => setFilters({ searchQuery: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Layers */}
      <div className="relative" ref={layersRef}>
        <button
          onClick={() => {
            setLayersOpen((v) => !v);
            setFiltersOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card/70 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated"
          style={
            activeEnvLayer !== "none"
              ? { color: layerMeta.accent, borderColor: `${layerMeta.accent}66` }
              : undefined
          }
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">
            {activeEnvLayer === "none" ? "Layers" : layerMeta.label}
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${layersOpen ? "rotate-180" : ""}`} />
        </button>

        {layersOpen && (
          <div className="panel absolute left-0 top-full z-50 mt-2 w-64 animate-fade-in overflow-hidden rounded-xl shadow-2xl">
            <div className="border-b border-border-subtle px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Globe Overlay
              </p>
            </div>
            <div className="max-h-80 space-y-0.5 overflow-y-auto p-2">
              {ENV_LAYER_ORDER.map((type) => {
                const meta = ENV_LAYER_META[type];
                const active = activeEnvLayer === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setActiveEnvLayer(type);
                      setLayersOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active ? "bg-bg-elevated" : "hover:bg-bg-elevated/60"
                    }`}
                  >
                    <span
                      className="grid h-7 w-7 place-items-center rounded-md"
                      style={active ? { background: `${meta.accent}22`, color: meta.accent } : undefined}
                    >
                      <meta.Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="flex-1 text-sm font-medium"
                      style={{ color: active ? meta.accent : undefined }}
                    >
                      {meta.label}
                    </span>
                    {active && (
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="relative" ref={filtersRef}>
        <button
          onClick={() => {
            setFiltersOpen((v) => !v);
            setLayersOpen(false);
          }}
          className="relative flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card/70 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-bg-primary">
              {activeCount}
            </span>
          )}
        </button>

        {filtersOpen && (
          <div className="panel absolute right-0 top-full z-50 mt-2 w-80 animate-fade-in rounded-xl p-4 shadow-2xl">
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filters.categories.includes(cat)
                        ? "bg-accent text-bg-primary"
                        : "bg-bg-elevated text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Impact Level
              </p>
              <div className="flex gap-1.5">
                {IMPACT_LEVELS.map((lvl) => {
                  const on = filters.impactLevels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      onClick={() => toggleImpactLevel(lvl)}
                      className="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors"
                      style={
                        on
                          ? { background: IMPACT_META[lvl].hex, color: "#fff" }
                          : { background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }
                      }
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle pt-3">
              {activeCount > 0 ? (
                <button
                  onClick={() =>
                    setFilters({ categories: [], impactLevels: [], searchQuery: "" })
                  }
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
                >
                  <X className="h-3 w-3" /> Clear all
                </button>
              ) : (
                <span className="text-xs text-text-muted">No active filters</span>
              )}
              <span className="text-xs text-text-muted">{activeCount} active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Filters_TimeRange = "1h" | "6h" | "24h" | "48h";
