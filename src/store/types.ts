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
}

export interface Filters {
  categories: EventCategory[];
  impactLevels: ImpactLevel[];
  timeRange: "1h" | "6h" | "24h" | "48h";
  searchQuery: string;
}

export type ScreenPosition = { x: number; y: number };
