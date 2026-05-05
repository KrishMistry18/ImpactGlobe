'use client'

import { useEffect, useRef } from 'react'
import { useGlobeStore } from '@/store/useGlobeStore'
import { ImpactBadge } from './ImpactBadge'

export function NewsTicker() {
  const events = useGlobeStore((s) => s.events)
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent)
  const tickerRef = useRef<HTMLDivElement>(null)

  // Sort by publishedAt descending (most recent first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  // Duplicate events for seamless infinite loop
  const tickerEvents = [...sortedEvents, ...sortedEvents]

  // Pause animation on hover
  const handleMouseEnter = () => {
    if (tickerRef.current) {
      tickerRef.current.style.animationPlayState = 'paused'
    }
  }
  const handleMouseLeave = () => {
    if (tickerRef.current) {
      tickerRef.current.style.animationPlayState = 'running'
    }
  }

  if (events.length === 0) return null

  // Adjust ticker speed based on number of events (more events = faster scroll)
  const duration = Math.max(30, sortedEvents.length * 6)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-subtle bg-bg-surface/95 backdrop-blur-sm">
      {/* Live indicator bar */}
      <div className="flex items-center gap-2 border-b border-border-subtle/50 px-3 py-0.5">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-impact-critical opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-impact-critical" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-impact-critical">
            Live
          </span>
        </span>
        <span className="text-[10px] text-text-muted">
          {sortedEvents.length} events tracked
        </span>
        <span className="ml-auto text-[10px] text-text-muted">
          Hover to pause
        </span>
      </div>

      {/* Scrolling ticker */}
      <div
        className="relative h-10 overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={tickerRef}
          className="absolute flex h-full items-center gap-8 whitespace-nowrap"
          style={{
            animation: `ticker ${duration}s linear infinite`,
          }}
        >
          {tickerEvents.map((event, index) => (
            <button
              key={`${event.id}-${index}`}
              onClick={() => setSelectedEvent(event)}
              className="flex cursor-pointer items-center gap-3 whitespace-nowrap transition-opacity hover:opacity-80"
            >
              <ImpactBadge level={event.impactLevel} size="sm" />
              <span className="text-sm font-medium text-text-primary">
                {event.headline}
              </span>
              <span className="text-xs text-text-muted">•</span>
              <span className="text-xs text-text-secondary">{event.country}</span>
              <span className="text-xs text-text-muted">
                {formatAge(event.publishedAt)}
              </span>
              {/* Separator */}
              <span className="inline-block w-12 border-l border-border-subtle/40" />
            </button>
          ))}
        </div>

        {/* Gradient fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-bg-surface/95 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-bg-surface/95 to-transparent" />
      </div>
    </div>
  )
}

/** Format how long ago an event was published */
function formatAge(publishedAt: string): string {
  const diff = Date.now() - new Date(publishedAt).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
