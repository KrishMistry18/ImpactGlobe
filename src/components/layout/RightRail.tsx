"use client";

import { useState } from "react";
import { useGlobeStore } from "@/store/useGlobeStore";
import { NewsInsightPanel } from "@/components/ui/NewsInsightPanel";
import { ForexPanel } from "@/components/ui/ForexPanel";
import { EnvDataPanel } from "@/components/ui/EnvDataPanel";

type Tab = "events" | "markets";

/**
 * The single right-hand rail. When an environmental layer is active it shows
 * that layer's data panel; otherwise it shows a tabbed Events / Markets view.
 */
export function RightRail() {
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const [tab, setTab] = useState<Tab>("events");

  const showEnv = activeEnvLayer !== "none";

  return (
    <aside className="panel fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-[340px] flex-col border-l border-border-subtle">
      {showEnv ? (
        <EnvDataPanel />
      ) : (
        <>
          <div className="flex shrink-0 gap-1 border-b border-border-subtle p-2">
            {(["events", "markets"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {t === "events" ? "Events" : "Markets"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "events" ? <NewsInsightPanel /> : <ForexPanel />}
          </div>
        </>
      )}
    </aside>
  );
}
