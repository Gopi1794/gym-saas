import { cn } from "@/lib/utils"

interface ActivityCardProps {
  label: string
  value: number | string
  unit?: string
  chart: "ring" | "bar" | "line"
  color?: "violet" | "cyan" | "emerald" | "brand"
}

const COLORS = {
  violet:  { stroke: "#818cf8", fill: "#818cf8", text: "text-indigo-400" },
  cyan:    { stroke: "#22d3ee", fill: "#22d3ee", text: "text-cyan-400" },
  emerald: { stroke: "#34d399", fill: "#34d399", text: "text-emerald-400" },
  brand:   { stroke: "#FF2222", fill: "#FF2222", text: "text-brand-500" },
}

function RingChart({ color }: { color: keyof typeof COLORS }) {
  const c = COLORS[color]
  const r = 22, cx = 28, cy = 28
  const circ = 2 * Math.PI * r
  const progress = circ * 0.65
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={c.stroke} strokeWidth="5"
        strokeDasharray={`${progress} ${circ - progress}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </svg>
  )
}

function BarChart({ color }: { color: keyof typeof COLORS }) {
  const bars = [12, 22, 16, 30, 20, 28, 24]
  const c = COLORS[color]
  return (
    <svg viewBox="0 0 56 40" className="h-10 w-14">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 8 + 1} y={40 - h} width="6" height={h} rx="2"
          fill={c.fill}
          opacity={i === bars.length - 1 ? 1 : 0.35}
        />
      ))}
    </svg>
  )
}

function LineChart({ color }: { color: keyof typeof COLORS }) {
  const c = COLORS[color]
  return (
    <svg viewBox="0 0 56 32" className="h-8 w-14">
      <defs>
        <linearGradient id={`lg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.fill} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,24 9,20 18,14 27,10 36,6 45,4 56,2"
        fill="none" stroke={c.stroke} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <polygon
        points="0,24 9,20 18,14 27,10 36,6 45,4 56,2 56,32 0,32"
        fill={`url(#lg-${color})`}
      />
    </svg>
  )
}

export default function ActivityCard({ label, value, unit, chart, color = "violet" }: ActivityCardProps) {
  const c = COLORS[color]

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-center">
        {chart === "ring"
          ? <RingChart color={color} />
          : chart === "bar"
          ? <BarChart color={color} />
          : <LineChart color={color} />
        }
      </div>

      <div>
        <p className={cn("text-xl font-black leading-none", c.text)}>
          {typeof value === "number" ? value.toLocaleString("es-AR") : value}
          {unit && <span className="ml-0.5 text-xs font-medium text-zinc-500">{unit}</span>}
        </p>
        <p className="mt-0.5 text-xs font-medium text-zinc-500 leading-tight">{label}</p>
      </div>
    </div>
  )
}
