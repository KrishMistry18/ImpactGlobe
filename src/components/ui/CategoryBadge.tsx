import type { EventCategory } from '@/store/types'

interface CategoryBadgeProps {
  category: EventCategory
  size?: 'sm' | 'md'
}

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
}

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-border-default bg-bg-elevated font-medium text-text-secondary ${SIZE_STYLES[size]}`}
    >
      {category}
    </span>
  )
}
