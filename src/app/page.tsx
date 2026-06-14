"use client";

import { useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { ViewToggle, type ViewMode } from "@/components/layout/ViewToggle";
import { RightRail } from "@/components/layout/RightRail";
import GlobeWrapper from "@/components/globe/GlobeWrapper";
import { EventModal } from "@/components/ui/EventModal";
import { TooltipOverlay } from "@/components/ui/TooltipOverlay";
import { NewsTicker } from "@/components/ui/NewsTicker";
import { PlaybackControls } from "@/components/ui/PlaybackControls";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { useEnvLayer } from "@/hooks/useEnvLayer";
import { useDisplayEvents } from "@/hooks/useDisplayEvents";
import { useHeartbeat, useInitialEventSeed } from "@/hooks/useHeartbeat";
import { useGlobeStore } from "@/store/useGlobeStore";
import type { GlobeRef } from "@/components/globe/GlobeRenderer";
import type { GlobeEvent, HoveredEnvPoint } from "@/store/types";

const MapView2D = dynamic(() => import("@/components/map/MapView2D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-bg-primary text-sm text-text-muted">
      Loading 2D map…
    </div>
  ),
});

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("globe");
  const globeRef = useRef<GlobeRef>(null);

  const events = useGlobeStore((s) => s.events);
  const activeEnvLayer = useGlobeStore((s) => s.activeEnvLayer);
  const envLayerData = useGlobeStore((s) => s.envLayerData);
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent);
  const setHoveredEvent = useGlobeStore((s) => s.setHoveredEvent);
  const setHoveredEnvPoint = useGlobeStore((s) => s.setHoveredEnvPoint);

  // Data wiring
  useRealtimeEvents();
  useEnvLayer(activeEnvLayer);
  useHeartbeat();
  useInitialEventSeed(events.length > 0);

  // Derived markers for the active layer
  const displayEvents = useDisplayEvents();

  const handleEventClick = useCallback(
    (event: GlobeEvent) => {
      setSelectedEvent(event);
      globeRef.current?.flyTo(event.lat, event.lon);
    },
    [setSelectedEvent],
  );

  const handleEventHover = useCallback(
    (event: GlobeEvent | null) => {
      setHoveredEvent(event ? event.id : null, { x: 0, y: 0 });
    },
    [setHoveredEvent],
  );

  const handleEnvHover = useCallback(
    (point: HoveredEnvPoint | null, pos?: { x: number; y: number }) => {
      setHoveredEnvPoint(point, pos);
    },
    [setHoveredEnvPoint],
  );

  return (
    <AppShell>
      <ViewToggle value={viewMode} onChange={setViewMode} />

      {viewMode === "globe" ? (
        <GlobeWrapper
          ref={globeRef}
          events={displayEvents}
          onEventClick={handleEventClick}
          onEventHover={handleEventHover}
          onEnvHover={handleEnvHover}
          activeEnvLayer={activeEnvLayer}
          envLayerData={envLayerData}
        />
      ) : (
        <div className="absolute inset-0 z-0">
          <MapView2D
            events={displayEvents}
            activeEnvLayer={activeEnvLayer}
            envLayerData={envLayerData}
            onEventClick={handleEventClick}
          />
        </div>
      )}

      {/* Depth vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(6,9,16,0.72) 100%)",
        }}
      />

      <RightRail />
      <PlaybackControls />
      <NewsTicker />
      <TooltipOverlay />
      <EventModal />
    </AppShell>
  );
}
