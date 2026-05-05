import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { ImpactLevel, EventCategory } from '@/store/types'

/** Format ISO date string to readable format like "Apr 27, 2026 4:30 PM" */
export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy h:mm a')
}

/** Format ISO date string to relative time like "2 minutes ago", "3 hours ago" */
export function formatTimeAgo(isoString: string): string {
  return formatDistanceToNow(parseISO(isoString), { addSuffix: true })
}

// Alias for backward compatibility
export const formatRelative = formatTimeAgo

/** Format a number with sign like +2.8% or -1.3% */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** Format large numbers with K/M suffixes */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

/** Format price with proper decimal places based on pair type */
export function formatPrice(price: number, pair?: string): string {
  const isJPY = pair?.includes('JPY')
  return price.toFixed(isJPY ? 3 : 5)
}

/** Return Tailwind color class for impact level */
export function impactColor(level: string): string {
  switch (level) {
    case 'Critical': return 'text-impact-critical'
    case 'High': return 'text-impact-high'
    case 'Medium': return 'text-impact-medium'
    case 'Low': return 'text-impact-low'
    default: return 'text-text-secondary'
  }
}

/** Return hex color for impact level */
export function formatImpactColor(level: ImpactLevel): string {
  switch (level) {
    case 'Critical': return '#e24b4a'
    case 'High': return '#ef9f27'
    case 'Medium': return '#1d9e75'
    case 'Low': return '#378add'
  }
}

// Alias for backward compatibility
export const impactHex = (level: string) =>
  formatImpactColor(level as ImpactLevel)

/** Return hex color for event category */
export function formatCategoryColor(cat: EventCategory): string {
  switch (cat) {
    case 'Geopolitical': return '#e24b4a'
    case 'Central Bank': return '#ef9f27'
    case 'Macro': return '#378add'
    case 'Political': return '#a29bfe'
    case 'Crisis': return '#ff4757'
    case 'Sanctions': return '#ffa502'
    case 'Earnings': return '#2ed573'
    case 'Natural Disaster': return '#ff6b35'
  }
}

/** Truncate a string to maxLen characters with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1).trimEnd() + '…'
}
