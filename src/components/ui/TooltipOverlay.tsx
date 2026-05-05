"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { ImpactBadge } from "./ImpactBadge";
import { CategoryBadge } from "./CategoryBadge";
import { formatDistanceToNow } from "date-fns";
import type { HoveredEnvPoint } from "@/store/useGlobeStore";

// ── Wind direction label ─────────────────────────────────────────────────────
function windDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ── AQI colour ───────────────────────────────────────────────────────────────
function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

// ── Env point tooltip ────────────────────────────────────────────────────────
function EnvTooltip({
  point,
  pos,
}: {
  point: HoveredEnvPoint;
  pos: { x: number; y: number };
}) {
  const latStr = `${Math.abs(point.lat).toFixed(1)}°${point.lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(point.lon).toFixed(1)}°${point.lon >= 0 ? "E" : "W"}`;

  return (
    <div
      className="pointer-events-none fixed z-50 animate-fade-in"
      style={{ left: pos.x + 16, top: pos.y + 16 }}
    >
      <div className="min-w-[180px] rounded-lg border border-border-default bg-bg-card/95 p-3 shadow-2xl backdrop-blur-sm">
        {/* Coordinates */}
        <div className="mb-2 text-xs font-mono text-text-muted">
          📍 {latStr}, {lonStr}
        </div>

        {point.type === "wind" && (
          <>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-xl font-bold text-cyan-400">
                {point.speed.toFixed(1)}
              </span>
              <span className="text-xs text-text-muted">m/s</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              Direction: {point.direction.toFixed(0)}°{" "}
              {windDir(point.direction)}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {point.speed < 3
                ? "Calm"
                : point.speed < 8
                  ? "Light breeze"
                  : point.speed < 14
                    ? "Moderate wind"
                    : point.speed < 20
                      ? "Fresh wind"
                      : point.speed < 28
                        ? "Strong wind"
                        : point.speed < 33
                          ? "Storm"
                          : "Hurricane-force"}
            </div>
          </>
        )}

        {point.type === "temperature" && (
          <>
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-xl font-bold"
                style={{
                  color:
                    point.tempC < 0
                      ? "#60a5fa"
                      : point.tempC < 10
                        ? "#93c5fd"
                        : point.tempC < 20
                          ? "#fde68a"
                          : point.tempC < 30
                            ? "#fb923c"
                            : "#ef4444",
                }}
              >
                {point.tempC > 0 ? "+" : ""}
                {point.tempC.toFixed(1)}
              </span>
              <span className="text-xs text-text-muted">°C</span>
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Air temperature (2m)
            </div>
          </>
        )}

        {point.type === "aqi" && (
          <>
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-xl font-bold"
                style={{ color: aqiColor(point.aqi) }}
              >
                {point.aqi}
              </span>
              <span className="text-xs text-text-muted">AQI</span>
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: aqiColor(point.aqi) }}
            >
              {point.category}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              PM2.5: {point.pm25.toFixed(1)} µg/m³
            </div>
          </>
        )}

        {point.type === "sea_temp" && (
          <>
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-xl font-bold"
                style={{
                  color:
                    point.tempC < 5
                      ? "#93c5fd"
                      : point.tempC < 15
                        ? "#22d3ee"
                        : point.tempC < 25
                          ? "#34d399"
                          : point.tempC < 30
                            ? "#fbbf24"
                            : "#ef4444",
                }}
              >
                {point.tempC.toFixed(1)}
              </span>
              <span className="text-xs text-text-muted">°C</span>
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Sea surface temperature
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TooltipOverlay() {
  const hoveredEventId = useGlobeStore((s) => s.hoveredEventId);
  const tooltipPosition = useGlobeStore((s) => s.tooltipPosition);
  const events = useGlobeStore((s) => s.events);
  const hoveredEnvPoint = useGlobeStore((s) => s.hoveredEnvPoint);
  const hoveredEnvScreenPos = useGlobeStore((s) => s.hoveredEnvScreenPos);

  // Env point tooltip takes priority when a heatmap layer is active
  if (hoveredEnvPoint && hoveredEnvScreenPos) {
    return <EnvTooltip point={hoveredEnvPoint} pos={hoveredEnvScreenPos} />;
  }

  const event = events.find((e) => e.id === hoveredEventId);
  if (!event || !tooltipPosition) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 animate-fade-in"
      style={{
        left: tooltipPosition.x + 16,
        top: tooltipPosition.y + 16,
      }}
    >
      <div className="max-w-sm rounded-lg border border-border-default bg-bg-card/95 p-4 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="font-display text-sm font-semibold leading-tight text-text-primary">
            {event.headline}
          </h3>
          <ImpactBadge level={event.impactLevel} size="sm" />
        </div>

        {/* Metadata */}
        <div className="mb-3 flex items-center gap-2">
          <CategoryBadge category={event.category} size="sm" />
          <span className="text-xs text-text-muted">
            {formatDistanceToNow(new Date(event.publishedAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Summary */}
        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          {event.summary.slice(0, 150)}
          {event.summary.length > 150 ? "..." : ""}
        </p>

        {/* Country */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-medium">📍</span>
          <span>{event.country}</span>
        </div>

        {/* Click hint */}
        <div className="mt-3 border-t border-border-subtle pt-2 text-xs text-text-muted">
          Click for full analysis
        </div>
      </div>
    </div>
  );
}
