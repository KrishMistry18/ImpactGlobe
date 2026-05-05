"use client";

import dynamic from "next/dynamic";
import { forwardRef, useRef } from "react";
import type { GlobeRef } from "./GlobeRenderer";
import type {
  GlobeEvent,
  ScreenPosition,
  EnvLayerType,
  EnvLayerData,
} from "@/store/types";

// Props passed through to GlobeRenderer
interface GlobeWrapperProps {
  events: GlobeEvent[];
  onEventClick: (event: GlobeEvent) => void;
  onEventHover: (event: GlobeEvent | null) => void;
  onEnvHover: (
    point: import("@/store/useGlobeStore").HoveredEnvPoint | null,
    pos?: { x: number; y: number },
  ) => void;
  activeEnvLayer: EnvLayerType;
  envLayerData: EnvLayerData | null;
}

// Dynamically import GlobeRenderer with no SSR — Three.js requires browser APIs
const GlobeRendererDynamic = dynamic(() => import("./GlobeRenderer"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#050a14" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Pulsing dark circle */}
          <div
            className="w-20 h-20 rounded-full"
            style={{
              background: "radial-gradient(circle, #0f1628 0%, #050a14 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          {/* Subtle spinner overlay */}
          <div
            className="absolute inset-1 rounded-full"
            style={{
              border: "2px solid transparent",
              borderTopColor: "#378add",
              animation: "spin 1.5s linear infinite",
            }}
          />
        </div>
        <span
          className="text-xs tracking-wider"
          style={{ color: "#6b6a63", fontFamily: "monospace" }}
        >
          INITIALIZING GLOBE...
        </span>
      </div>
    </div>
  ),
});

const GlobeWrapper = forwardRef<GlobeRef, GlobeWrapperProps>(
  function GlobeWrapper(
    {
      events,
      onEventClick,
      onEventHover,
      onEnvHover,
      activeEnvLayer,
      envLayerData,
    },
    ref,
  ) {
    // Screen positions ref for tooltip placement
    const hoveredEventScreenPos = useRef<Map<string, ScreenPosition>>(
      new Map(),
    );

    return (
      <div className="absolute inset-0 z-0">
        <GlobeRendererDynamic
          ref={ref}
          events={events}
          onEventClick={onEventClick}
          onEventHover={onEventHover}
          onEnvHover={onEnvHover}
          hoveredEventScreenPos={hoveredEventScreenPos}
          activeEnvLayer={activeEnvLayer}
          envLayerData={envLayerData}
        />
      </div>
    );
  },
);

export default GlobeWrapper;
