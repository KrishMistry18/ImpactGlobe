import type { ImpactLevel } from '@/store/types'

/** Impact level → hex color mapping */
export const IMPACT_COLORS: Record<ImpactLevel, string> = {
  Critical: '#e24b4a',
  High: '#ef9f27',
  Medium: '#1d9e75',
  Low: '#378add',
}

/** Ripple animation configuration per impact level */
export const RIPPLE_CONFIG: Record<ImpactLevel, {
  maxScale: number
  duration: number   // ms for one full ring expansion
  ringCount: number
  coreRadius: number
}> = {
  Critical: { maxScale: 1.6, duration: 1000, ringCount: 3, coreRadius: 0.014 },
  High:     { maxScale: 1.3, duration: 1400, ringCount: 3, coreRadius: 0.012 },
  Medium:   { maxScale: 1.0, duration: 2000, ringCount: 3, coreRadius: 0.010 },
  Low:      { maxScale: 0.8, duration: 2800, ringCount: 3, coreRadius: 0.009 },
}

/** Convert hex color to normalized RGB tuple [0-1, 0-1, 0-1] */
export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

/** Smooth ease-in-out interpolation (quadratic) */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
