"use client";

import { useState } from "react";
import { useGlobeStore } from "@/store/useGlobeStore";
import { useForex } from "@/hooks/useForex";
import { SparklineChart } from "./SparklineChart";
import { Panel, PanelEmpty } from "./Panel";
import { TrendingUp, TrendingDown, RefreshCw, CandlestickChart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ForexPanel() {
  const events = useGlobeStore((s) => s.events);
  const { pairs, isLoading, refresh } = useForex();
  const [refreshing, setRefreshing] = useState(false);

  const top = [...pairs]
    .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
    .slice(0, 6);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  return (
    <Panel
      title="Top Movers"
      icon={<CandlestickChart className="h-4 w-4" />}
      subtitle="Most volatile pairs · last 24h"
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
          title="Refresh forex"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {isLoading && top.length === 0 ? (
        <PanelEmpty message="Loading forex data…" icon={<CandlestickChart className="h-9 w-9" />} />
      ) : top.length === 0 ? (
        <PanelEmpty
          message="No forex data available"
          hint="Set TWELVE_DATA_API_KEY to enable"
          icon={<CandlestickChart className="h-9 w-9" />}
        />
      ) : (
        <div className="divide-y divide-border-subtle/50">
          {top.map((p) => {
            const up = p.changePercent24h > 0;
            const driver = p.drivingEventId
              ? events.find((e) => e.id === p.drivingEventId)
              : null;
            const color = up ? "var(--color-impact-medium)" : "var(--color-impact-critical)";
            return (
              <div key={p.pair} className="p-4 transition-colors hover:bg-white/[0.02]">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-text-primary">{p.pair}</span>
                    {up ? (
                      <TrendingUp className="h-4 w-4 text-impact-medium" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-impact-critical" />
                    )}
                  </div>
                  <span className="text-sm font-semibold" style={{ color }}>
                    {up ? "+" : ""}
                    {p.changePercent24h.toFixed(2)}%
                  </span>
                </div>
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-text-muted">
                  <span>{p.currentPrice.toFixed(4)}</span>
                  <span>
                    {p.change24h > 0 ? "+" : ""}
                    {p.change24h.toFixed(4)}
                  </span>
                </div>
                {p.sparklineData.length > 0 && (
                  <SparklineChart
                    data={p.sparklineData}
                    width={240}
                    height={32}
                    color={up ? "#3ba776" : "#f0524f"}
                    strokeWidth={2}
                  />
                )}
                {driver && (
                  <div className="mt-2 rounded-md bg-bg-card/60 p-2 text-[11px] leading-tight text-text-muted">
                    <span className="font-medium text-text-secondary">Driven by: </span>
                    {driver.headline.slice(0, 60)}
                    {driver.headline.length > 60 ? "…" : ""}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-text-muted">
                  Updated {formatDistanceToNow(new Date(p.lastUpdated), { addSuffix: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
