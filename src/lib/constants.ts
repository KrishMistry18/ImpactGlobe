/**
 * Single source of truth for cross-cutting constants.
 *
 * Before this file the impact-colour palette was duplicated (with conflicting
 * hex values) across 4+ components, the heatmap-layer list was hardcoded in 3
 * places, and the "valid coordinate" guard was copy-pasted everywhere. Import
 * from here instead.
 */

import type {
  ImpactLevel,
  EventCategory,
  EnvLayerType,
} from '@/store/types'
import type { LucideIcon } from 'lucide-react'
import {
  Globe,
  Wind,
  Thermometer,
  Factory,
  Waves,
  Activity,
  Flame,
  Tornado,
} from 'lucide-react'

// ── Impact levels ────────────────────────────────────────────────────────────

export const IMPACT_LEVELS: ImpactLevel[] = ['Critical', 'High', 'Medium', 'Low']

export interface ImpactMeta {
  label: string
  /** Canonical hex — matches the --color-impact-* design tokens. */
  hex: string
  /** Tailwind text-colour token class. */
  textClass: string
  /** Tailwind bg token class. */
  bgClass: string
}

export const IMPACT_META: Record<ImpactLevel, ImpactMeta> = {
  Critical: { label: 'Critical', hex: '#f0524f', textClass: 'text-impact-critical', bgClass: 'bg-impact-critical' },
  High:     { label: 'High',     hex: '#f5a524', textClass: 'text-impact-high',     bgClass: 'bg-impact-high' },
  Medium:   { label: 'Medium',   hex: '#3ba776', textClass: 'text-impact-medium',   bgClass: 'bg-impact-medium' },
  Low:      { label: 'Low',      hex: '#4a90d9', textClass: 'text-impact-low',       bgClass: 'bg-impact-low' },
}

export const impactHex = (level: ImpactLevel): string => IMPACT_META[level].hex

// ── Event categories ───────────────────────────────────────────────────────────

export const CATEGORIES: EventCategory[] = [
  'Geopolitical',
  'Central Bank',
  'Macro',
  'Political',
  'Crisis',
  'Sanctions',
  'Earnings',
  'Natural Disaster',
]

// ── Time ranges ────────────────────────────────────────────────────────────────

export const TIME_RANGES = [
  { value: '1h' as const, label: '1H', hours: 1 },
  { value: '6h' as const, label: '6H', hours: 6 },
  { value: '24h' as const, label: '24H', hours: 24 },
  { value: '48h' as const, label: '48H', hours: 48 },
]

export const TIME_RANGE_HOURS: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '48h': 48,
}

// ── Environmental layers ─────────────────────────────────────────────────────────

export interface EnvLayerMeta {
  type: EnvLayerType
  label: string
  /** Icon component for the layer (chips, switcher, panel header). */
  Icon: LucideIcon
  /** Accent colour for the layer (chips, panel header). */
  accent: string
  /** Human-readable data source for the panel. */
  source: string
  /** Whether the layer renders as a continuous heatmap (vs discrete markers). */
  kind: 'none' | 'heatmap' | 'markers'
}

export const ENV_LAYER_META: Record<EnvLayerType, EnvLayerMeta> = {
  none:                { type: 'none',                label: 'None',          Icon: Globe,       accent: '#7c8aa0', source: '—',                 kind: 'none' },
  wind:                { type: 'wind',                label: 'Wind',          Icon: Wind,        accent: '#38bdf8', source: 'Open-Meteo',        kind: 'heatmap' },
  temperature_anomaly: { type: 'temperature_anomaly', label: 'Temperature',  Icon: Thermometer, accent: '#fb7185', source: 'Open-Meteo',        kind: 'heatmap' },
  aqi:                 { type: 'aqi',                 label: 'Air Quality',   Icon: Factory,     accent: '#a3e635', source: 'Open-Meteo AQ',     kind: 'heatmap' },
  sea_temp:            { type: 'sea_temp',            label: 'Sea Temp',      Icon: Waves,       accent: '#2dd4bf', source: 'Open-Meteo Marine', kind: 'heatmap' },
  earthquakes:         { type: 'earthquakes',         label: 'Earthquakes',   Icon: Activity,    accent: '#a78bfa', source: 'USGS',              kind: 'markers' },
  wildfires:           { type: 'wildfires',           label: 'Wildfires',     Icon: Flame,       accent: '#fb923c', source: 'NASA EONET',        kind: 'markers' },
  storms:              { type: 'storms',              label: 'Storms',        Icon: Tornado,     accent: '#60a5fa', source: 'NASA EONET',        kind: 'markers' },
}

/** Ordered list for the layer switcher UI. */
export const ENV_LAYER_ORDER: EnvLayerType[] = [
  'none',
  'wind',
  'temperature_anomaly',
  'aqi',
  'sea_temp',
  'earthquakes',
  'wildfires',
  'storms',
]

export const HEATMAP_LAYERS: EnvLayerType[] = [
  'wind',
  'temperature_anomaly',
  'aqi',
  'sea_temp',
]

export const isHeatmapLayer = (layer: EnvLayerType): boolean =>
  HEATMAP_LAYERS.includes(layer)

export const isMarkerLayer = (layer: EnvLayerType): boolean =>
  ENV_LAYER_META[layer]?.kind === 'markers'

// ── Geo helpers ────────────────────────────────────────────────────────────────

/**
 * Events with (0, 0) coordinates are geocoding failures that land in the Gulf
 * of Guinea. Treat anything that close to the origin as invalid.
 */
export const isValidCoord = (lat: number, lon: number): boolean =>
  !(Math.abs(lat) < 0.1 && Math.abs(lon) < 0.1)

// ── App metadata ───────────────────────────────────────────────────────────────

export const APP_NAME = 'ImpactGlobe'
