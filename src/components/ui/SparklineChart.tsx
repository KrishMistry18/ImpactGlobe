'use client'

interface SparklineChartProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
}

export function SparklineChart({
  data,
  width = 80,
  height = 24,
  color = '#1d9e75',
  strokeWidth = 1.5,
}: SparklineChartProps) {
  if (data.length < 2) {
    return <div style={{ width, height }} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
