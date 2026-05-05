'use client'

import { useGlobeStore } from '@/store/useGlobeStore'
import { useForex } from '@/hooks/useForex'
import { SparklineChart } from './SparklineChart'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

export function ForexPanel() {
  const events = useGlobeStore((s) => s.events)
  const { pairs: forexPairs, isLoading, refresh } = useForex()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get top 5 pairs by absolute change
  const topPairs = [...forexPairs]
    .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
    .slice(0, 5)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }

  return (
    <div className="fixed right-0 top-16 z-30 h-[calc(100vh-64px)] w-80 border-l border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
            Top Movers
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-primary disabled:opacity-50"
            title="Refresh forex data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="mt-1 text-xs text-text-muted">Most volatile pairs (24h)</p>
      </div>

      {/* Forex pairs list */}
      <div className="overflow-y-auto" style={{ height: 'calc(100% - 73px)' }}>
        {isLoading && topPairs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mb-2 text-4xl opacity-20 animate-pulse">📊</div>
              <p className="text-sm text-text-muted">Loading forex data...</p>
            </div>
          </div>
        ) : topPairs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mb-2 text-4xl opacity-20">📊</div>
              <p className="text-sm text-text-muted">No forex data available</p>
              <p className="mt-1 text-xs text-text-muted">Configure TWELVE_DATA_API_KEY to enable</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {topPairs.map((pair) => {
              const isPositive = pair.changePercent24h > 0
              const drivingEvent = pair.drivingEventId
                ? events.find((e) => e.id === pair.drivingEventId)
                : null

              return (
                <div key={pair.pair} className="p-4 transition-colors hover:bg-bg-elevated">
                  {/* Pair name and change */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-text-primary">
                        {pair.pair}
                      </span>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-impact-medium" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-impact-critical" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        isPositive ? 'text-impact-medium' : 'text-impact-critical'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {pair.changePercent24h.toFixed(2)}%
                    </span>
                  </div>

                  {/* Current price */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-text-muted">
                      {pair.currentPrice.toFixed(4)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {pair.change24h > 0 ? '+' : ''}
                      {pair.change24h.toFixed(4)}
                    </span>
                  </div>

                  {/* Sparkline */}
                  {pair.sparklineData.length > 0 && (
                    <div className="mb-2">
                      <SparklineChart
                        data={pair.sparklineData}
                        width={240}
                        height={32}
                        color={isPositive ? '#1d9e75' : '#e24b4a'}
                        strokeWidth={2}
                      />
                    </div>
                  )}

                  {/* Driving event */}
                  {drivingEvent && (
                    <div className="mt-2 rounded-md bg-bg-card p-2">
                      <p className="text-xs leading-tight text-text-muted">
                        <span className="font-medium text-text-secondary">Driven by:</span>{' '}
                        {drivingEvent.headline.slice(0, 60)}
                        {drivingEvent.headline.length > 60 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {/* Last updated */}
                  <div className="mt-2 text-xs text-text-muted">
                    Updated {formatDistanceToNow(new Date(pair.lastUpdated), { addSuffix: true })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
