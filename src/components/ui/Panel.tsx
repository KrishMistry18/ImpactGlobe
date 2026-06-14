"use client";

import type { ReactNode } from "react";
import { Satellite } from "lucide-react";

interface PanelProps {
  title: string;
  icon?: ReactNode;
  accent?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared right-rail panel chrome: a frosted surface with a header (icon, title,
 * subtitle, optional actions) and a scrollable body. Keeps every panel visually
 * consistent.
 */
export function Panel({
  title,
  icon,
  accent,
  subtitle,
  actions,
  children,
}: PanelProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon && (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md text-sm"
                style={
                  accent
                    ? { background: `${accent}1f`, color: accent }
                    : undefined
                }
              >
                {icon}
              </span>
            )}
            <h2 className="truncate font-display text-[13px] font-semibold uppercase tracking-wider text-text-primary">
              {title}
            </h2>
          </div>
          {actions}
        </div>
        {subtitle && (
          <p className="mt-1 text-[11px] text-text-muted">{subtitle}</p>
        )}
      </header>
      <div className="scroll-slim flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** Compact labelled stat card. */
export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div
        className="mt-1 font-display text-2xl font-bold"
        style={{ color: accent ?? "var(--color-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Centered empty / loading state. */
export function PanelEmpty({
  message,
  hint,
  icon,
}: {
  message: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-3 animate-pulse text-text-muted/40">
          {icon ?? <Satellite className="h-9 w-9" />}
        </div>
        <p className="text-sm text-text-secondary">{message}</p>
        {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
      </div>
    </div>
  );
}
