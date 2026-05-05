"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { EventCategory, ImpactLevel } from "@/store/types";
import type { EnvLayerType } from "@/store/types";
import { Search, X, Layers, ChevronDown, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEnvLayer } from "@/hooks/useEnvLayer";

// ─── Layer definitions ────────────────────────────────────────────────────────

const ENV_LAYERS: {
  type: EnvLayerType;
  icon: string;
  label: string;
  accent: string;
  legend: React.ReactNode;
}[] = [
  {
    type: "none",
    icon: "🌐",
    label: "None",
    accent: "#6b7280",
    legend: null,
  },
  {
    type: "wind",
    icon: "💨",
    label: "Wind",
    accent: "#00d4ff",
    legend: (
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        <span style={{ color: "#3572ff" }}>▬</span> Calm
        <span style={{ color: "#00c8ff" }}>▬</span> Breeze
        <span style={{ color: "#00e676" }}>▬</span> Moderate
        <span style={{ color: "#ffeb3b" }}>▬</span> Fresh
        <span style={{ color: "#ff9800" }}>▬</span> Strong
        <span style={{ color: "#f44336" }}>▬</span> Storm
      </div>
    ),
  },
  {
    type: "aqi",
    icon: "😷",
    label: "Air Quality",
    accent: "#00e400",
    legend: (
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        <span style={{ color: "#00e400" }}>▬</span> Good
        <span style={{ color: "#ffff00" }}>▬</span> Moderate
        <span style={{ color: "#ff7e00" }}>▬</span> Unhealthy
        <span style={{ color: "#ff0000" }}>▬</span> Very
        <span style={{ color: "#8f3f97" }}>▬</span> Hazardous
      </div>
    ),
  },
  {
    type: "temperature_anomaly",
    icon: "🌡️",
    label: "Temperature",
    accent: "#ff6420",
    legend: (
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        <span style={{ color: "#8216b3" }}>▬</span> -40°
        <span style={{ color: "#0064ff" }}>▬</span> 0°
        <span style={{ color: "#c8eb ff" }}>▬</span> 10°
        <span style={{ color: "#ffeb3b" }}>▬</span> 20°
        <span style={{ color: "#ff6414" }}>▬</span> 30°
        <span style={{ color: "#c80000" }}>▬</span> 40°+
      </div>
    ),
  },
  {
    type: "sea_temp",
    icon: "🌊",
    label: "Sea Temp",
    accent: "#00dcd4",
    legend: (
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        <span style={{ color: "#a0dcff" }}>▬</span> -2°
        <span style={{ color: "#0050c8" }}>▬</span> 8°
        <span style={{ color: "#00dcd2" }}>▬</span> 18°
        <span style={{ color: "#50dc00" }}>▬</span> 24°
        <span style={{ color: "#ff8c00" }}>▬</span> 29°
        <span style={{ color: "#dc1414" }}>▬</span> 32°+
      </div>
    ),
  },
  {
    type: "earthquakes",
    icon: "⚡",
    label: "Earthquakes",
    accent: "#a29bfe",
    legend: (
      <div className="mt-1 text-[10px] text-gray-400">
        Ripple size = magnitude · M2.5+
      </div>
    ),
  },
  {
    type: "wildfires",
    icon: "🔥",
    label: "Wildfires",
    accent: "#ff7043",
    legend: (
      <div className="mt-1 text-[10px] text-gray-400">
        NASA EONET · active fires
      </div>
    ),
  },
  {
    type: "storms",
    icon: "🌀",
    label: "Storms",
    accent: "#74b9ff",
    legend: (
      <div className="mt-1 text-[10px] text-gray-400">
        Tropical storms &amp; hurricanes
      </div>
    ),
  },
];

// ─── Filters ──────────────────────────────────────────────────────────────────

const CATEGORIES: EventCategory[] = [
  "Geopolitical",
  "Central Bank",
  "Macro",
  "Political",
  "Crisis",
  "Sanctions",
  "Earnings",
  "Natural Disaster",
];

const IMPACT_LEVELS: ImpactLevel[] = ["Critical", "High", "Medium", "Low"];

const TIME_RANGES = [
  { value: "1h" as const, label: "1H" },
  { value: "6h" as const, label: "6H" },
  { value: "24h" as const, label: "24H" },
  { value: "48h" as const, label: "48H" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useGlobeStore((s) => s.filters);
  const setFilters = useGlobeStore((s) => s.setFilters);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const setActiveEnvLayer = useGlobeStore((s) => s.setActiveEnvLayer);

  const [searchInput, setSearchInput] = useState(() => {
    // initialise from URL param if available on first render
    if (typeof window !== "undefined") {
      return (
        new URLSearchParams(window.location.search).get("q") ||
        filters.searchQuery
      );
    }
    return filters.searchQuery;
  });
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);

  const layersRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) {
        setShowLayersMenu(false);
      }
      if (
        filtersRef.current &&
        !filtersRef.current.contains(e.target as Node)
      ) {
        setShowFiltersMenu(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Init filters from URL
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const impactParam = searchParams.get("impact");
    const timeRangeParam = searchParams.get("timeRange");
    const searchParam = searchParams.get("q");
    setFilters({
      categories: categoryParam
        ? (categoryParam.split(",") as EventCategory[])
        : [],
      impactLevels: impactParam
        ? (impactParam.split(",") as ImpactLevel[])
        : [],
      timeRange: (timeRangeParam as "1h" | "6h" | "24h" | "48h") || "48h",
      searchQuery: searchParam || "",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.categories.length > 0)
      params.set("category", filters.categories.join(","));
    if (filters.impactLevels.length > 0)
      params.set("impact", filters.impactLevels.join(","));
    if (filters.timeRange !== "48h") params.set("timeRange", filters.timeRange);
    if (filters.searchQuery) params.set("q", filters.searchQuery);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [filters, router]);

  const toggleCategory = (c: EventCategory) =>
    setFilters({
      ...filters,
      categories: filters.categories.includes(c)
        ? filters.categories.filter((x) => x !== c)
        : [...filters.categories, c],
    });

  const toggleImpactLevel = (l: ImpactLevel) =>
    setFilters({
      ...filters,
      impactLevels: filters.impactLevels.includes(l)
        ? filters.impactLevels.filter((x) => x !== l)
        : [...filters.impactLevels, l],
    });

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      impactLevels: [],
      timeRange: "48h",
      searchQuery: "",
    });
    setSearchInput("");
  };

  const activeFilterCount =
    filters.categories.length +
    filters.impactLevels.length +
    (filters.searchQuery ? 1 : 0);

  const activeLayerMeta = ENV_LAYERS.find((l) => l.type === activeEnvLayer);
  const { isLoading: layerLoading } = useEnvLayer(activeEnvLayer);

  return (
    <div className="flex items-center gap-3">
      {/* ── Search ── */}
      <div className="relative w-52">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setFilters({ ...filters, searchQuery: e.target.value });
          }}
          placeholder="Search events..."
          className="w-full rounded-lg border border-border-subtle bg-bg-card py-2 pl-10 pr-8 text-sm text-text-primary placeholder:text-text-muted focus:border-border-default focus:outline-none"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput("");
              setFilters({ ...filters, searchQuery: "" });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Time range ── */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-card p-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setFilters({ ...filters, timeRange: r.value })}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              filters.timeRange === r.value
                ? "bg-impact-medium text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Layers dropdown ── */}
      <div className="relative" ref={layersRef}>
        <button
          onClick={() => {
            setShowLayersMenu((v) => !v);
            setShowFiltersMenu(false);
          }}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            activeEnvLayer !== "none"
              ? "border-transparent bg-bg-elevated text-text-primary ring-1"
              : "border-border-subtle bg-bg-card text-text-primary hover:bg-bg-elevated"
          }`}
          style={
            activeEnvLayer !== "none"
              ? {
                  color: activeLayerMeta?.accent,
                  outlineColor: activeLayerMeta?.accent,
                }
              : {}
          }
        >
          <Layers className="h-4 w-4" />
          <span>
            {activeEnvLayer === "none" ? "Layers" : activeLayerMeta?.label}
          </span>
          {activeEnvLayer !== "none" && layerLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : activeEnvLayer !== "none" ? (
            <span className="text-base leading-none">
              {activeLayerMeta?.icon}
            </span>
          ) : null}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showLayersMenu ? "rotate-180" : ""}`}
          />
        </button>

        {showLayersMenu && (
          <div className="absolute top-full left-0 z-50 mt-2 w-72 animate-fade-in rounded-xl border border-border-subtle bg-bg-surface shadow-2xl backdrop-blur-sm">
            <div className="p-3 border-b border-border-subtle">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Globe Overlay
              </p>
            </div>
            <div className="p-2 space-y-0.5 max-h-80 overflow-y-auto">
              {ENV_LAYERS.map((layer) => {
                const isActive = activeEnvLayer === layer.type;
                return (
                  <button
                    key={layer.type}
                    onClick={() => {
                      setActiveEnvLayer(layer.type);
                      setShowLayersMenu(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-all ${
                      isActive ? "bg-bg-elevated" : "hover:bg-bg-elevated/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-base ${
                          isActive ? "ring-1" : "bg-bg-card"
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: `${layer.accent}22`,
                                outline: `1px solid ${layer.accent}66`,
                              }
                            : {}
                        }
                      >
                        {layer.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium"
                          style={{ color: isActive ? layer.accent : undefined }}
                        >
                          {layer.label}
                        </div>
                        {isActive && layer.legend && (
                          <div className="text-text-muted">{layer.legend}</div>
                        )}
                      </div>
                      {isActive && (
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: layer.accent }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Filters dropdown ── */}
      <div className="relative" ref={filtersRef}>
        <button
          onClick={() => {
            setShowFiltersMenu((v) => !v);
            setShowLayersMenu(false);
          }}
          className="relative flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-impact-critical text-xs text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showFiltersMenu ? "rotate-180" : ""}`}
          />
        </button>

        {showFiltersMenu && (
          <div className="absolute top-full left-0 z-50 mt-2 w-80 animate-fade-in rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-2xl backdrop-blur-sm">
            {/* Categories */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filters.categories.includes(cat)
                        ? "bg-impact-medium text-white"
                        : "bg-bg-elevated text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact levels */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Impact Level
              </p>
              <div className="flex gap-1.5">
                {IMPACT_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => toggleImpactLevel(lvl)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      filters.impactLevels.includes(lvl)
                        ? lvl === "Critical"
                          ? "bg-impact-critical text-white"
                          : lvl === "High"
                            ? "bg-impact-high text-white"
                            : lvl === "Medium"
                              ? "bg-impact-medium text-white"
                              : "bg-impact-low text-white"
                        : "bg-bg-elevated text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border-subtle pt-3">
              {activeFilterCount > 0 ? (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              ) : (
                <span className="text-xs text-text-muted">
                  No active filters
                </span>
              )}
              <span className="text-xs text-text-muted">
                {activeFilterCount} active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
