import { create } from "zustand";
import type {
  GlobeEvent,
  ForexPair,
  Filters,
  ImpactLevel,
  EventCategory,
  EnvLayerType,
  EnvLayerData,
  ScreenPosition,
  HoveredEnvPoint,
} from "./types";

// Re-export so existing imports from "@/store/useGlobeStore" keep working
// (the globe renderer/wrapper import HoveredEnvPoint from here).
export type { HoveredEnvPoint } from "./types";

interface GlobeState {
  // Events
  events: GlobeEvent[];
  selectedEvent: GlobeEvent | null;
  hoveredEventId: string | null;
  tooltipPosition: ScreenPosition | null;

  // Forex
  forexPairs: ForexPair[];

  // Environmental layers
  activeEnvLayer: EnvLayerType;
  envLayerData: EnvLayerData | null;
  hoveredEnvPoint: HoveredEnvPoint | null;
  hoveredEnvScreenPos: { x: number; y: number } | null;

  // Filters
  filters: Filters;

  // Actions — Events
  setEvents: (events: GlobeEvent[]) => void;
  addEvent: (event: GlobeEvent) => void;
  setSelectedEvent: (event: GlobeEvent | null) => void;
  setHoveredEvent: (id: string | null, position?: ScreenPosition) => void;

  // Actions — Forex
  setForexPairs: (pairs: ForexPair[]) => void;

  // Actions — Environmental layers
  setActiveEnvLayer: (layer: EnvLayerType) => void;
  setEnvLayerData: (data: EnvLayerData) => void;
  setHoveredEnvPoint: (
    point: HoveredEnvPoint | null,
    pos?: { x: number; y: number },
  ) => void;

  // Actions — Filters
  setFilters: (filters: Partial<Filters>) => void;
  toggleCategory: (category: EventCategory) => void;
  toggleImpactLevel: (level: ImpactLevel) => void;
}

const defaultFilters: Filters = {
  categories: [],
  impactLevels: [],
  timeRange: "24h",
  searchQuery: "",
};

export const useGlobeStore = create<GlobeState>((set) => ({
  events: [],
  selectedEvent: null,
  hoveredEventId: null,
  tooltipPosition: null,
  forexPairs: [],
  activeEnvLayer: "none",
  envLayerData: null,
  hoveredEnvPoint: null,
  hoveredEnvScreenPos: null,
  filters: defaultFilters,

  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events.filter((e) => e.id !== event.id)],
    })),
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  setHoveredEvent: (id, position) =>
    set({ hoveredEventId: id, tooltipPosition: position ?? null }),

  setForexPairs: (pairs) => set({ forexPairs: pairs }),

  setActiveEnvLayer: (layer) => set({ activeEnvLayer: layer }),
  setEnvLayerData: (data) => set({ envLayerData: data }),
  setHoveredEnvPoint: (point, pos) =>
    set({ hoveredEnvPoint: point, hoveredEnvScreenPos: pos ?? null }),

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  toggleCategory: (category) =>
    set((state) => ({
      filters: {
        ...state.filters,
        categories: state.filters.categories.includes(category)
          ? state.filters.categories.filter((c) => c !== category)
          : [...state.filters.categories, category],
      },
    })),
  toggleImpactLevel: (level) =>
    set((state) => ({
      filters: {
        ...state.filters,
        impactLevels: state.filters.impactLevels.includes(level)
          ? state.filters.impactLevels.filter((l) => l !== level)
          : [...state.filters.impactLevels, level],
      },
    })),
}));
