import { cn } from "@/lib/utils"

interface ActivityCardProps {
  label: string
  value: number | string
  unit?: string
  chart: "ring" | "bar" | "line" | "none"
  color?: "violet" | "cyan" | "emerald" | "brand"
  data?: number[] // bar/line: array of values
  progress?: number // ring: 0-1
  compact?: boolean
}

const COLORS = {
  violet:  { stroke: "#818cf8", fill: "#818cf8", text: "text-indigo-400" },
  cyan:    { stroke: "#22d3ee", fill: "#22d3ee", text: "text-cyan-400" },
  emerald: { stroke: "#34d399", fill: "#34d399", text: "text-emerald-400" },
  brand:   { stroke: "#FF2222", fill: "#FF2222", text: "text-brand-500" },
}

function RingChart({ color, progress = 0, compact = false }: { color: keyof typeof COLORS; progress?: number; compact?: boolean }) {
  const c = COLORS[color]
  const size = compact ? 44 : 56
  const r = compact ? 17 : 22
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.max(0.03, Math.min(progress, 0.97))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={compact ? "h-11 w-11" : "h-14 w-14"}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={c.stroke} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </svg>
  )
}

function BarChart({ color, data, compact = false }: { color: keyof typeof COLORS; data?: number[]; compact?: boolean }) {
  // Sin datos reales, no se inventa una tendencia: mismo criterio que
  // chart="none": mejor nada que un dibujo que parece un dato.
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const height = compact ? 32 : 40
  const bars = data.map(v => Math.max(2, Math.round((v / max) * (height - 4))))
  const c = COLORS[color]
  const bw = Math.floor(54 / bars.length) - 1
  return (
    <svg viewBox={`0 0 56 ${height}`} className={compact ? "h-8 w-14" : "h-10 w-14"}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * (bw + 1) + 1} y={height - h} width={bw} height={h} rx="2"
          fill={c.fill}
          opacity={i === bars.length - 1 ? 1 : 0.35}
        />
      ))}
    </svg>
  )
}

function LineChart({ color, data, compact = false }: { color: keyof typeof COLORS; data?: number[]; compact?: boolean }) {
  // Mismo criterio que BarChart: sin datos suficientes, nada; no una curva
  // ascendente inventada que parece una tendencia real.
  if (!data || data.length < 2) return null
  const c = COLORS[color]
  const max = Math.max(...data, 1)
  const n = data.length
  const h = compact ? 28 : 32
  const pts = data.map((v, i) => ({
    x: Math.round((i / (n - 1)) * 56),
    y: Math.round((h - 2) - (v / max) * (h - 4)) + 1,
  }))
  const linePoints = pts.map(p => `${p.x},${p.y}`).join(" ")
  const areaPoints = `0,${h} ${linePoints} 56,${h}`

  return (
    <svg viewBox={`0 0 56 ${h}`} className={compact ? "h-7 w-14" : "h-8 w-14"}>
      <defs>
        <linearGradient id={`lg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.fill} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={linePoints}
        fill="none" stroke={c.stroke} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <polygon points={areaPoints} fill={`url(#lg-${color})`} />
    </svg>
  )
}

export default function ActivityCard({ label, value, unit, chart, color = "violet", data, progress, compact = false }: ActivityCardProps) {
  const c = COLORS[color]

  return (
    <div className={cn(
      "flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/60 backdrop-blur-md",
      compact ? "gap-2 p-3" : "gap-3 p-4",
    )}>
      <div className={cn("flex items-center", compact ? "justify-start" : "justify-center")}>
        {chart === "ring"
          ? <RingChart color={color} progress={progress} compact={compact} />
          : chart === "bar"
          ? <BarChart color={color} data={data} compact={compact} />
          : chart === "line"
          ? <LineChart color={color} data={data} compact={compact} />
          : null}
      </div>

      <div>
        <p className={cn(compact ? "text-lg" : "text-xl", "font-black leading-none", c.text)}>
          {typeof value === "number" ? value.toLocaleString("es-AR") : value}
          {unit && <span className="ml-0.5 text-xs font-medium text-zinc-500">{unit}</span>}
        </p>
        <p className="mt-0.5 text-xs font-medium text-zinc-500 leading-tight">{label}</p>
      </div>
    </div>
  )
}
