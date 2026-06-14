export type ImpactLevel = "Critical" | "High" | "Medium" | "Low";

export type EventCategory =
  | "Geopolitical"
  | "Central Bank"
  | "Macro"
  | "Political"
  | "Crisis"
  | "Sanctions"
  | "Earnings"
  | "Natural Disaster";

// Environmental layer types
export type EnvLayerType =
  | "none"
  | "wind"
  | "aqi"
  | "temperature_anomaly"
  | "earthquakes"
  | "wildfires"
  | "storms"
  | "sea_temp";

export interface ForexImpact {
  pair: string;
  direction: 1 | -1;
  magnitude: "Large" | "Medium" | "Small";
  movePercent: string;
  reasoning: string;
}

export interface GlobeEvent {
  id: string;
  headline: string;
  country: string;
  lat: number;
  lon: number;
  impactLevel: ImpactLevel;
  category: EventCategory;
  summary: string;
  sentiment: string;
  forexImpacts: ForexImpact[];
  confidenceScore: number;
  isMarketMoving: boolean;
  publishedAt: string;
  expiresAt: string;
  sourceUrl?: string;
  createdBy: "ai-auto" | "ai-confirmed" | "manual";
}

export interface ForexPair {
  pair: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  sparklineData: number[];
  drivingEventId?: string;
  drivingEventHeadline?: string;
  lastUpdated: string;
}

// Environmental data types
export interface WindPoint {
  lat: number;
  lon: number;
  speed: number; // m/s
  direction: number; // degrees 0-360
}

export interface AQIPoint {
  lat: number;
  lon: number;
  city: string;
  country: string;
  aqi: number; // 0-500 AQI scale
  pm25: number; // µg/m³
  category:
    | "Good"
    | "Moderate"
    | "Unhealthy for Sensitive"
    | "Unhealthy"
    | "Very Unhealthy"
    | "Hazardous";
}

export interface EarthquakeEvent {
  id: string;
  lat: number;
  lon: number;
  magnitude: number;
  depth: number; // km
  location: string;
  time: string; // ISO
  url: string;
}

export interface WildfireEvent {
  id: string;
  lat: number;
  lon: number;
  title: string;
  date: string;
  source: string;
}

export interface StormEvent {
  id: string;
  lat: number;
  lon: number;
  title: string;
  category?: string; // e.g. "Category 3"
  date: string;
}

export interface TempAnomalyPoint {
  lat: number;
  lon: number;
  anomalyC: number; // degrees C above/below baseline
}

export interface SeaTempPoint {
  lat: number;
  lon: number;
  tempC: number; // Sea surface temperature in Celsius
}

/** Pre-interpolated dense grid from server-side IDW */
export interface EnvGrid {
  /** Row-major flat array: grid[row * width + col]. null = no data. */
  values: (number | null)[];
  width: number;   // 360
  height: number;  // 181
  latMin: number;  // -90
  latMax: number;  // +90
  lonMin: number;  // -180
  lonMax: number;  // +179
}

export interface EnvLayerData {
  type: EnvLayerType;
  updatedAt: string;
  wind?: WindPoint[];
  aqi?: AQIPoint[];
  earthquakes?: EarthquakeEvent[];
  wildfires?: WildfireEvent[];
  storms?: StormEvent[];
  tempAnomalies?: TempAnomalyPoint[];
  seaTemp?: SeaTempPoint[];
  // Pre-interpolated grids (server-side IDW) — used for rendering
  windGrid?: EnvGrid;
  tempGrid?: EnvGrid;
  aqiGrid?: EnvGrid;
  seaTempGrid?: EnvGrid;
}

export interface Filters {
  categories: EventCategory[];
  impactLevels: ImpactLevel[];
  timeRange: "1h" | "6h" | "24h" | "48h";
  searchQuery: string;
}

export type ScreenPosition = { x: number; y: number };

/**
 * A point on an environmental heatmap that the cursor is currently over.
 * Lives here (rather than in the store) because it's a domain type consumed
 * across the globe renderer, tooltip, and store.
 */
export type HoveredEnvPoint =
  | { type: "wind"; lat: number; lon: number; speed: number; direction: number }
  | { type: "temperature"; lat: number; lon: number; tempC: number }
  | {
      type: "aqi";
      lat: number;
      lon: number;
      aqi: number;
      pm25: number;
      category: string;
    }
  | { type: "sea_temp"; lat: number; lon: number; tempC: number };
