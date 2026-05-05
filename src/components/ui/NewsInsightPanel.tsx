'use client'

import { useMemo, useState } from 'react'
import { useGlobeStore } from '@/store/useGlobeStore'
import { TrendingUp, TrendingDown, Minus, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { GlobeEvent, ImpactLevel } from '@/store/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; dot: string; ring: string; bg: string }> = {
  Critical: { label: 'CRITICAL', dot: '#ef4444', ring: 'rgba(239,68,68,0.2)', bg: 'rgba(239,68,68,0.06)' },
  High:     { label: 'HIGH',     dot: '#f97316', ring: 'rgba(249,115,22,0.2)', bg: 'rgba(249,115,22,0.06)' },
  Medium:   { label: 'MEDIUM',   dot: '#eab308', ring: 'rgba(234,179,8,0.2)',  bg: 'rgba(234,179,8,0.06)'  },
  Low:      { label: 'LOW',      dot: '#22c55e', ring: 'rgba(34,197,94,0.2)',  bg: 'rgba(34,197,94,0.06)'  },
}

const TIERS: ImpactLevel[] = ['Critical', 'High', 'Medium', 'Low']

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({ event, onSelect }: { event: GlobeEvent; onSelect: (e: GlobeEvent) => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = IMPACT_CONFIG[event.impactLevel]
  const fx = event.forexImpacts[0] ?? null
  const age = formatDistanceToNow(new Date(event.publishedAt), { addSuffix: true })

  return (
    <div
      className="border-b border-border-subtle/40 last:border-0"
      style={{ background: expanded ? cfg.bg : undefined }}
    >
      {/* ── Main row ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-start gap-2.5">
          {/* Pulsing dot */}
          <span className="relative mt-1 flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ backgroundColor: cfg.dot }} />
            <span className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: cfg.dot }} />
          </span>

          {/* Headline + meta */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-snug text-text-primary line-clamp-2">
              {event.headline}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-text-muted">{event.country}</span>
              <span className="text-[10px] text-text-muted/40">·</span>
              <span className="text-[10px] text-text-muted">{age}</span>
              <span className="text-[10px] text-text-muted/40">·</span>
              <span className="text-[10px] text-text-muted/70">{event.category}</span>
            </div>
          </div>

          {/* Forex badge + chevron */}
          <div className="flex shrink-0 items-center gap-1.5">
            {fx && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                style={{
                  color: fx.direction > 0 ? '#1d9e75' : '#e24b4a',
                  background: fx.direction > 0 ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)',
                }}
              >
                {fx.pair} {fx.movePercent}
              </span>
            )}
            {expanded
              ? <ChevronUp className="h-3 w-3 text-text-muted/50" />
              : <ChevronDown className="h-3 w-3 text-text-muted/50" />
            }
          </div>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-3 pb-3">
          {/* Summary */}
          <p className="text-[11px] leading-relaxed text-text-muted mb-2">
            {event.summary.slice(0, 200)}{event.summary.length > 200 ? '…' : ''}
          </p>

          {/* All forex impacts */}
          {event.forexImpacts.length > 0 && (
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Forex Impact
              </p>
              {event.forexImpacts.map((fx, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md bg-bg-card px-2 py-1.5">
                  {fx.direction > 0
                    ? <TrendingUp className="h-3 w-3 shrink-0 text-[#1d9e75]" />
                    : <TrendingDown className="h-3 w-3 shrink-0 text-[#e24b4a]" />
                  }
                  <span className="font-mono text-xs font-bold text-text-primary">{fx.pair}</span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: fx.direction > 0 ? '#1d9e75' : '#e24b4a' }}
                  >
                    {fx.movePercent}
                  </span>
                  <span className="text-[10px] text-text-muted">{fx.magnitude}</span>
                  <span className="ml-auto text-[10px] text-text-muted/70 leading-snug max-w-[120px] text-right">
                    {fx.reasoning}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No forex impact */}
          {event.forexImpacts.length === 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-md bg-bg-card px-2 py-1.5">
              <Minus className="h-3 w-3 text-text-muted/50" />
              <span className="text-[10px] text-text-muted">Low forex sensitivity</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(event)}
              className="text-[10px] font-medium text-impact-medium hover:underline"
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
  )
}

// ─── Tier section ─────────────────────────────────────────────────────────────

function TierSection({
  level,
  events,
  onSelect,
}: {
  level: ImpactLevel
  events: GlobeEvent[]
  onSelect: (e: GlobeEvent) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const cfg = IMPACT_CONFIG[level]

  if (events.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-t border-border-subtle/60 bg-bg-surface/90 px-3 py-1.5 backdrop-blur-sm"
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.dot }}>
          {cfg.label}
        </span>
        <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ backgroundColor: cfg.dot + 'cc' }}>
          {events.length}
        </span>
        <span className="ml-auto text-text-muted/50">
          {collapsed
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronUp className="h-3 w-3" />
          }
        </span>
      </button>

      {!collapsed && (
        <div>
          {events.map(event => (
            <EventRow key={event.id} event={event} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function NewsInsightPanel() {
  const allEvents = useGlobeStore(s => s.events)
  const setSelectedEvent = useGlobeStore(s => s.setSelectedEvent)

  // Pick top 5 per tier by publishedAt (newest first)
  const tieredEvents = useMemo(() => {
    const validEvents = allEvents.filter(
      e => !(Math.abs(e.lat) < 0.1 && Math.abs(e.lon) < 0.1)
    )
    const pick = (level: ImpactLevel) =>
      validEvents
        .filter(e => e.impactLevel === level)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 5)

    return {
      Critical: pick('Critical'),
      High:     pick('High'),
      Medium:   pick('Medium'),
      Low:      pick('Low'),
    }
  }, [allEvents])

  const totalShown = TIERS.reduce((acc, t) => acc + tieredEvents[t].length, 0)

  const handleSelect = (event: GlobeEvent) => {
    setSelectedEvent(event)
  }

  return (
    <div className="fixed right-0 top-16 z-30 flex h-[calc(100vh-64px)] w-80 flex-col border-l border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
            News Intelligence
          </h2>
          <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {totalShown} events
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-text-muted">
          Top 5 per tier · click to expand forex insight
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {totalShown === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mb-3 text-4xl opacity-20 animate-pulse">📡</div>
              <p className="text-sm text-text-muted">Fetching live events…</p>
              <p className="mt-1 text-[10px] text-text-muted">Events appear within 1-2 minutes</p>
            </div>
          </div>
        ) : (
          TIERS.map(tier => (
            <TierSection
              key={tier}
              level={tier}
              events={tieredEvents[tier]}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
