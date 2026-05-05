import type { ImpactLevel } from '@/store/types'

interface ImpactBadgeProps {
  level: ImpactLevel
  size?: 'sm' | 'md' | 'lg'
}

const IMPACT_STYLES: Record<ImpactLevel, { bg: string; text: string; border: string }> = {
  Critical: {
    bg: 'bg-impact-critical/10',
    text: 'text-impact-critical',
    border: 'border-impact-critical/30',
  },
  High: {
    bg: 'bg-impact-high/10',
    text: 'text-impact-high',
    border: 'border-impact-high/30',
  },
  Medium: {
    bg: 'bg-impact-medium/10',
    text: 'text-impact-medium',
    border: 'border-impact-medium/30',
  },
  Low: {
    bg: 'bg-impact-low/10',
    text: 'text-impact-low',
    border: 'border-impact-low/30',
  },
}

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
}

export function ImpactBadge({ level, size = 'md' }: ImpactBadgeProps) {
  const styles = IMPACT_STYLES[level]

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium uppercase tracking-wide ${styles.bg} ${styles.text} ${styles.border} ${SIZE_STYLES[size]}`}
    >
      {level}
    </span>
  )
}
