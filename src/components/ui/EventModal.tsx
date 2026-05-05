"use client";

import { useGlobeStore } from "@/store/useGlobeStore";
import { ImpactBadge } from "./ImpactBadge";
import { CategoryBadge } from "./CategoryBadge";

import { formatDistanceToNow } from "date-fns";
import { X, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";

export function EventModal() {
  const selectedEvent = useGlobeStore((s) => s.selectedEvent);
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent);

  if (!selectedEvent) return null;

  const handleClose = () => setSelectedEvent(null);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 animate-slide-in">
        <div className="mx-4 max-h-[90vh] overflow-y-auto rounded-xl border border-border-default bg-bg-surface shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-surface/95 p-6 backdrop-blur-sm">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-3">
                <ImpactBadge level={selectedEvent.impactLevel} size="md" />
                <CategoryBadge category={selectedEvent.category} size="md" />
                {selectedEvent.isMarketMoving && (
                  <span className="rounded-full bg-impact-critical/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-impact-critical">
                    Market Moving
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight text-text-primary">
                {selectedEvent.headline}
              </h2>
              <div className="mt-2 flex items-center gap-4 text-sm text-text-muted">
                <span>📍 {selectedEvent.country}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(selectedEvent.publishedAt), {
                    addSuffix: true,
                  })}
                </span>
                <span>•</span>
                <span>
                  Confidence: {Math.round(selectedEvent.confidenceScore * 100)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Summary */}
            <section className="mb-6">
              <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
                Summary
              </h3>
              <p className="leading-relaxed text-text-secondary">
                {selectedEvent.summary}
              </p>
            </section>

            {/* Sentiment */}
            <section className="mb-6">
              <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
                Market Sentiment
              </h3>
              <p className="leading-relaxed text-text-secondary">
                {selectedEvent.sentiment}
              </p>
            </section>

            {/* Forex Impacts */}
            {selectedEvent.forexImpacts.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Forex Impact Analysis
                </h3>
                <div className="space-y-3">
                  {selectedEvent.forexImpacts.map((impact, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border-subtle bg-bg-card p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-text-primary">
                            {impact.pair}
                          </span>
                          {impact.direction === 1 ? (
                            <TrendingUp className="h-5 w-5 text-impact-medium" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-impact-critical" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              impact.direction === 1
                                ? "text-impact-medium"
                                : "text-impact-critical"
                            }`}
                          >
                            {impact.movePercent}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            impact.magnitude === "Large"
                              ? "bg-impact-critical/10 text-impact-critical"
                              : impact.magnitude === "Medium"
                                ? "bg-impact-high/10 text-impact-high"
                                : "bg-impact-low/10 text-impact-low"
                          }`}
                        >
                          {impact.magnitude}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {impact.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Source link */}
            {selectedEvent.sourceUrl && (
              <section>
                <a
                  href={selectedEvent.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-impact-medium transition-colors hover:text-impact-medium/80"
                >
                  <ExternalLink className="h-4 w-4" />
                  View original source
                </a>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
