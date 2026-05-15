import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  trend: string
  trendUp: boolean
  chart?: "line" | "bar" | "donut"
}

function LineChart({ up }: { up: boolean }) {
  const color = up ? "#34d399" : "#f87171"
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`lg-${up}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={up ? "0,32 24,28 48,22 72,18 96,10 120,5" : "0,8 24,14 48,12 72,22 96,28 120,34"}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={up ? "0,32 24,28 48,22 72,18 96,10 120,5 120,40 0,40" : "0,8 24,14 48,12 72,22 96,28 120,34 120,40 0,40"}
        fill={`url(#lg-${up})`}
      />
    </svg>
  )
}

function BarChart() {
  const bars = [18, 28, 22, 35, 25, 32, 28]
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-full" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 17 + 2}
          y={40 - h}
          width="13"
          height={h}
          rx="2"
          fill="#818cf8"
          opacity={i === bars.length - 1 ? 1 : 0.5}
        />
      ))}
    </svg>
  )
}

function DonutChart() {
  const r = 16, cx = 20, cy = 20
  const circumference = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3f3f46" strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#818cf8" strokeWidth="5"
        strokeDasharray={`${circumference * 0.65} ${circumference * 0.35}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f87171" strokeWidth="5"
        strokeDasharray={`${circumference * 0.35} ${circumference * 0.65}`}
        strokeDashoffset={circumference * -0.4}
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function StatsCard({ label, value, icon: Icon, trend, trendUp, chart = "line" }: StatsCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-md">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/15">
            <Icon className="h-4.5 w-4.5 text-brand-500" />
          </div>
        </div>

        <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">{value}</p>

        <div className="mt-1 flex items-center gap-1.5">
          {trendUp
            ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          }
          <span className={cn("text-xs font-semibold", trendUp ? "text-emerald-400" : "text-red-400")}>
            {trend}
          </span>
          <span className="text-xs text-zinc-500">vs mes anterior</span>
        </div>
      </div>

      <div className="px-2 pb-2">
        {chart === "bar" ? <BarChart /> : chart === "donut"
          ? <div className="flex justify-end px-3 pb-1"><DonutChart /></div>
          : <LineChart up={trendUp} />
        }
      </div>
    </div>
  )
}
