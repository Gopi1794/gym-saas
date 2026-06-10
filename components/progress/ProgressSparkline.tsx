"use client"

interface SparklineProps {
  exerciseId: string
  points: { value: number }[]
  className?: string
  height?: number
}

export function ProgressSparkline({ exerciseId, points, className, height = 80 }: SparklineProps) {
  if (points.length < 2) return null

  const W = 300, H = height
  const values = points.map(p => p.value)
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const range = max - min || 1
  const n = points.length

  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * W
    const y = H - ((v - min) / range) * (H - 8) - 4
    return `${x},${y}`
  }).join(" ")

  const areaPath = `0,${H} ${pts} ${W},${H}`
  const gradId = `grad-${exerciseId}`
  const lastX = (W).toString()
  const lastY = (H - ((values[n - 1] - min) / range) * (H - 8) - 4).toString()

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? "w-full"} style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fafafa" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#fafafa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPath} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="#fb7185" />
    </svg>
  )
}
