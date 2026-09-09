"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"

// Adapted from Mono Charts (MIT): https://github.com/Subhan-code/Monocharts
export type MonoKpiChart = "ring" | "bar" | "line" | "none"
export type MonoKpiColor = "violet" | "cyan" | "emerald" | "brand"

interface MonoRoundedKpiCardProps {
  label: string
  value: number | string
  unit?: string
  chart: MonoKpiChart
  color: MonoKpiColor
  data?: number[]
  progress?: number
  compact?: boolean
}

const COLORS: Record<MonoKpiColor, { hex: string; text: string }> = {
  violet: { hex: "#818cf8", text: "text-indigo-500 dark:text-indigo-400" },
  cyan: { hex: "#06b6d4", text: "text-cyan-600 dark:text-cyan-400" },
  emerald: { hex: "#10b981", text: "text-emerald-600 dark:text-emerald-400" },
  brand: { hex: "#D50000", text: "text-brand-600 dark:text-brand-400" },
}

function MiniChart({ chart, color, data, progress, compact = false }: Pick<MonoRoundedKpiCardProps, "chart" | "color" | "data" | "progress" | "compact">) {
  const accent = COLORS[color].hex
  const points = (data ?? []).map((value, index) => ({ index, value }))

  if (chart === "none") return null

  if (chart === "ring") {
    const percentage = Math.round(Math.max(0, Math.min(progress ?? 0, 1)) * 100)
    const ringData = [{ name: "Progreso", value: percentage }, { name: "Restante", value: 100 - percentage }]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={ringData}
            dataKey="value"
            innerRadius={compact ? 13 : 17}
            outerRadius={compact ? 19 : 23}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="none"
          >
            <Cell fill={accent} />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (points.length === 0) return null

  if (chart === "bar") {
    const highest = Math.max(...points.map((point) => point.value), 1)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={compact ? "22%" : "28%"}>
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {points.map((point) => <Cell key={point.index} fill={accent} fillOpacity={point.value === highest ? 1 : 0.28} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`mono-kpi-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.34} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={accent} strokeWidth={compact ? 2 : 2.5} strokeLinecap="round" fill={`url(#mono-kpi-${color})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MonoRoundedKpiCard({ label, value, unit, chart, color, data, progress, compact = false }: MonoRoundedKpiCardProps) {
  const hasChart = chart === "ring" || (chart !== "none" && (data?.length ?? 0) > 0)
  const accent = COLORS[color]

  return (
    <article className={cn(
      "relative flex flex-col justify-between overflow-hidden border border-border bg-card shadow-sm transition-shadow duration-150 ease-out hover:shadow-md dark:bg-zinc-950",
      compact ? "min-h-24 rounded-[20px] p-3" : "min-h-32 rounded-[24px] p-4",
    )}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-70" style={{ background: `linear-gradient(120deg, ${COLORS[color].hex}1a, transparent 68%)` }} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
        {hasChart && (
          <div className={cn("shrink-0", compact ? "h-9 w-12" : "h-12 w-16")}>
            <MiniChart chart={chart} color={color} data={data} progress={progress} compact={compact} />
          </div>
        )}
      </div>
      <p className={cn("relative font-black tracking-tight", compact ? "text-lg" : "text-2xl", accent.text)}>
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
        {unit && <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>}
      </p>
    </article>
  )
}