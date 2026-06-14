"use client";

import { useMemo, useState } from "react";
import { useGlobeStore } from "@/store/useGlobeStore";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Newspaper,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Panel, PanelEmpty } from "./Panel";
import { IMPACT_META, IMPACT_LEVELS, impactHex, isValidCoord } from "@/lib/constants";
import type { GlobeEvent, ImpactLevel } from "@/store/types";

// ── Single event row ──────────────────────────────────────────────────────────

function EventRow({
  event,
  onSelect,
}: {
  event: GlobeEvent;
  onSelect: (e: GlobeEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hex = impactHex(event.impactLevel);
  const fx = event.forexImpacts[0] ?? null;
  const age = formatDistanceToNow(new Date(event.publishedAt), {
    addSuffix: true,
  });

  return (
    <div
      className="border-b border-border-subtle/40 last:border-0"
      style={{ background: expanded ? `${hex}0d` : undefined }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-1 inline-flex h-2 w-2 shrink-0" style={{ color: hex }}>
            <span className="live-dot h-2 w-2" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-medium leading-snug text-text-primary">
              {event.headline}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-text-muted">{event.country}</span>
              <span className="text-[10px] text-text-muted/40">·</span>
              <span className="text-[10px] text-text-muted">{age}</span>
              <span className="text-[10px] text-text-muted/40">·</span>
              <span className="text-[10px] text-text-muted/70">{event.category}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {fx && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                style={{
                  color: fx.direction > 0 ? "var(--color-impact-medium)" : "var(--color-impact-critical)",
                  background: fx.direction > 0 ? "rgba(59,167,118,0.12)" : "rgba(240,82,79,0.12)",
                }}
              >
                {fx.pair} {fx.movePercent}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-text-muted/50" />
            ) : (
              <ChevronDown className="h-3 w-3 text-text-muted/50" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <p className="mb-2 text-[11px] leading-relaxed text-text-muted">
            {event.summary.slice(0, 200)}
            {event.summary.length > 200 ? "…" : ""}
          </p>

          {event.forexImpacts.length > 0 ? (
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Forex Impact
              </p>
              {event.forexImpacts.map((impact, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-bg-card px-2 py-1.5"
                >
                  {impact.direction > 0 ? (
                    <TrendingUp className="h-3 w-3 shrink-0 text-impact-medium" />
                  ) : (
                    <TrendingDown className="h-3 w-3 shrink-0 text-impact-critical" />
                  )}
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {impact.pair}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: impact.direction > 0 ? "var(--color-impact-medium)" : "var(--color-impact-critical)" }}
                  >
                    {impact.movePercent}
                  </span>
                  <span className="text-[10px] text-text-muted">{impact.magnitude}</span>
                  <span className="ml-auto max-w-[120px] text-right text-[10px] leading-snug text-text-muted/70">
                    {impact.reasoning}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-2 flex items-center gap-1.5 rounded-md bg-bg-card px-2 py-1.5">
              <Minus className="h-3 w-3 text-text-muted/50" />
              <span className="text-[10px] text-text-muted">Low forex sensitivity</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(event)}
              className="text-[10px] font-medium text-accent hover:underline"
            >
              View on globe →
            </button>
            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-0.5 text-[10px] text-text-muted hover:text-text-secondary"
              >
                Source <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tier section ────────────────────────────────────────────────────────────────

function TierSection({
  level,
  events,
  onSelect,
}: {
  level: ImpactLevel;
  events: GlobeEvent[];
  onSelect: (e: GlobeEvent) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = IMPACT_META[level];
  if (events.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="sticky top-0 z-10 flex w-full items-center gap-2 border-y border-border-subtle/60 bg-bg-surface/90 px-4 py-1.5 backdrop-blur-sm"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.hex }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.hex }}>
          {meta.label}
        </span>
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ background: `${meta.hex}cc` }}
        >
          {events.length}
        </span>
        <span className="ml-auto text-text-muted/50">
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </span>
      </button>
      {!collapsed && events.map((e) => <EventRow key={e.id} event={e} onSelect={onSelect} />)}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────────

export function NewsInsightPanel() {
  const allEvents = useGlobeStore((s) => s.events);
  const filters = useGlobeStore((s) => s.filters);
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent);

  const query = filters.searchQuery.trim().toLowerCase();

  const tiered = useMemo(() => {
    // Apply the active search + category + impact filters to the live events.
    const matches = allEvents.filter((e) => {
      if (!isValidCoord(e.lat, e.lon)) return false;
      if (filters.categories.length && !filters.categories.includes(e.category)) return false;
      if (filters.impactLevels.length && !filters.impactLevels.includes(e.impactLevel)) return false;
      if (query) {
        const hay = `${e.headline} ${e.country} ${e.summary} ${e.category}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // When searching, show every match per tier; otherwise top 5 per tier.
    const limit = query ? Infinity : 5;
    const pick = (level: ImpactLevel) =>
      matches
        .filter((e) => e.impactLevel === level)
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        )
        .slice(0, limit);
    return Object.fromEntries(IMPACT_LEVELS.map((l) => [l, pick(l)])) as Record<
      ImpactLevel,
      GlobeEvent[]
    >;
  }, [allEvents, filters.categories, filters.impactLevels, query]);

  const total = IMPACT_LEVELS.reduce((n, t) => n + tiered[t].length, 0);

  return (
    <Panel
      title="News Intelligence"
      icon={<Newspaper className="h-4 w-4" />}
      subtitle={
        query
          ? `${total} result${total === 1 ? "" : "s"} for “${filters.searchQuery.trim()}”`
          : "Top 5 per tier · click to expand forex insight"
      }
      actions={
        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted">
          {total}
        </span>
      }
    >
      {total === 0 ? (
        query ? (
          <PanelEmpty message="No events match your search" hint="Try a different keyword" />
        ) : (
          <PanelEmpty
            message="Fetching live events…"
            hint="Events appear within 1–2 minutes"
          />
        )
      ) : (
        IMPACT_LEVELS.map((tier) => (
          <TierSection
            key={tier}
            level={tier}
            events={tiered[tier]}
            onSelect={setSelectedEvent}
          />
        ))
      )}
    </Panel>
  );
}
