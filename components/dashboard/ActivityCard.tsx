import { cn } from "@/lib/utils"

interface ActivityCardProps {
  label: string
  value: number | string
  unit?: string
  chart: "ring" | "bar" | "line"
  color?: "violet" | "cyan" | "emerald" | "brand"
  data?: number[]    // bar/line: array of values
  progress?: number  // ring: 0–1
}

const COLORS = {
  violet:  { stroke: "#818cf8", fill: "#818cf8", text: "text-indigo-400" },
  cyan:    { stroke: "#22d3ee", fill: "#22d3ee", text: "text-cyan-400" },
  emerald: { stroke: "#34d399", fill: "#34d399", text: "text-emerald-400" },
  brand:   { stroke: "#FF2222", fill: "#FF2222", text: "text-brand-500" },
}

function RingChart({ color, progress = 0 }: { color: keyof typeof COLORS; progress?: number }) {
  const c = COLORS[color]
  const r = 22, cx = 28, cy = 28
  const circ = 2 * Math.PI * r
  const dash = circ * Math.max(0.03, Math.min(progress, 0.97))
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14">
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

function BarChart({ color, data }: { color: keyof typeof COLORS; data?: number[] }) {
  const raw = data && data.length > 0 ? data : [3, 5, 4, 7, 5, 6, 6]
  const max = Math.max(...raw, 1)
  const bars = raw.map(v => Math.max(2, Math.round((v / max) * 36)))
  const c = COLORS[color]
  const bw = Math.floor(54 / bars.length) - 1
  return (
    <svg viewBox="0 0 56 40" className="h-10 w-14">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * (bw + 1) + 1} y={40 - h} width={bw} height={h} rx="2"
          fill={c.fill}
          opacity={i === bars.length - 1 ? 1 : 0.35}
        />
      ))}
    </svg>
  )
}

function LineChart({ color, data }: { color: keyof typeof COLORS; data?: number[] }) {
  const c = COLORS[color]
  const raw = data && data.length >= 2 ? data : null

  let linePoints: string
  let areaPoints: string

  if (raw) {
    const max = Math.max(...raw, 1)
    const n = raw.length
    const pts = raw.map((v, i) => ({
      x: Math.round((i / (n - 1)) * 56),
      y: Math.round(30 - (v / max) * 28) + 1,
    }))
    linePoints = pts.map(p => `${p.x},${p.y}`).join(" ")
    areaPoints = `0,32 ${linePoints} 56,32`
  } else {
    linePoints = "0,28 9,26 18,22 27,18 36,14 45,10 56,6"
    areaPoints = "0,32 0,28 9,26 18,22 27,18 36,14 45,10 56,6 56,32"
  }

  return (
    <svg viewBox="0 0 56 32" className="h-8 w-14">
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
      <polygon
        points={areaPoints}
        fill={`url(#lg-${color})`}
      />
    </svg>
  )
}

export default function ActivityCard({ label, value, unit, chart, color = "violet", data, progress }: ActivityCardProps) {
  const c = COLORS[color]

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-center">
        {chart === "ring"
          ? <RingChart color={color} progress={progress} />
          : chart === "bar"
          ? <BarChart color={color} data={data} />
          : <LineChart color={color} data={data} />
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
