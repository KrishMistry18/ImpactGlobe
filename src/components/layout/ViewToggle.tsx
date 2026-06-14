"use client";

import { Globe2, Map } from "lucide-react";

export type ViewMode = "globe" | "map";

const MODES: { mode: ViewMode; label: string; Icon: typeof Globe2 }[] = [
  { mode: "globe", label: "Globe", Icon: Globe2 },
  { mode: "map", label: "Map", Icon: Map },
];

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="glass absolute left-4 top-4 z-40 flex overflow-hidden rounded-xl border border-border-default shadow-xl">
      {MODES.map(({ mode, label, Icon }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              active
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
