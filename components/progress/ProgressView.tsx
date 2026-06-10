"use client"

import { useMemo, useRef, useEffect } from "react"
import { useTheme } from "next-themes"
import * as echarts from "echarts/core"
import { BarChart, LineChart, PieChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { Flame, TrendingUp, Dumbbell, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { ExerciseProgressionSection } from "./ExerciseProgressionSection"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

// Register ECharts modules once at module level
echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

export type SessionRecord = {
  id: string
  day_name: string
  day_of_week: number
  exercises_count: number
  completed_at: string
}

interface Props {
  sessions: SessionRecord[]
  trainingDays: number
  exerciseHistory: ExerciseHistory[]
}

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekLabel(mondayIso: string): string {
  const d = new Date(mondayIso + "T12:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short",
  })
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

type ChartRef = ReturnType<typeof echarts.init> | null

interface WeeklyBarChartProps {
  weeks: string[]
  weekMap: Map<string, number>
  thisWeekKey: string
  isDark?: boolean
}

function WeeklyBarChart({ weeks, weekMap, thisWeekKey, isDark = true }: WeeklyBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartRef>(null)

  const option = useMemo(() => {
    const maxVal = Math.max(...weeks.map((w) => weekMap.get(w) ?? 0), 1)
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isMobile = typeof window !== "undefined" && window.innerWidth < 420
    const axisLabelColor = isDark ? "#3f3f46" : "#a1a1aa"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { graphic } = echarts as any

    const seriesData = weeks.map((w) => {
      const count = weekMap.get(w) ?? 0
      const isCurrent = w === thisWeekKey

      const color =
        count === 0
          ? "#27272a"
          : isCurrent
          ? new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#ff4444" },
              { offset: 1, color: "#d50000" },
            ])
          : new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255,68,68,0.45)" },
              { offset: 1, color: "rgba(213,0,0,0.2)" },
            ])

      return {
        value: count,
        itemStyle: {
          color,
          borderRadius: [6, 6, 2, 2],
          ...(isCurrent && count > 0
            ? { shadowBlur: 14, shadowColor: "rgba(255,34,34,0.45)", shadowOffsetY: -3 }
            : {}),
        },
        label: {
          show: count > 0,
          position: "top",
          formatter: String(count),
          color: isCurrent ? "#ff6464" : "#52525b",
          fontSize: 10,
          fontWeight: isCurrent ? "bold" : "normal",
          distance: 3,
        },
      }
    })

    return {
      backgroundColor: "transparent",
      animation: !reduceMotion,
      animationDuration: 600,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        extraCssText: "border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);",
        textStyle: { color: "#e4e4e7", fontSize: 12 },
        padding: [10, 14],
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: "rgba(255,34,34,0.05)" },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter(params: any[]) {
          const { name, value } = params[0]
          const plural = value === 1 ? "sesión" : "sesiones"
          return `<div style="color:#71717a;font-size:10px;margin-bottom:4px">${name}</div>` +
            `<b style="color:#ff4444;font-size:16px">${value}</b>` +
            `<span style="color:#71717a;font-size:11px"> ${plural}</span>`
        },
      },
      grid: { left: 0, right: 0, top: 28, bottom: 24, containLabel: false },
      xAxis: {
        type: "category",
        data: weeks.map(formatWeekLabel),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisLabelColor, fontSize: isMobile ? 8 : 9, interval: isMobile ? 1 : 0, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: { type: "value", show: false, max: maxVal + 2 },
      series: [{ type: "bar", data: seriesData, barMinHeight: 4, barMaxWidth: 28, barCategoryGap: "30%" }],
    }
  }, [weeks, weekMap, thisWeekKey, isDark])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, null, { renderer: "canvas" })
    chartRef.current = chart
    chart.setOption(option as any)

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option as any, { notMerge: false })
  }, [option])

  return <div ref={containerRef} className="min-w-0 max-w-full overflow-hidden" style={{ width: "100%", height: 168 }} />
}

interface WeeklyLoadChartProps {
  weeks: string[]
  exerciseMap: Map<string, number>
  sessionMap: Map<string, number>
  isDark?: boolean
}

function WeeklyLoadChart({ weeks, exerciseMap, sessionMap, isDark = true }: WeeklyLoadChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartRef>(null)

  const option = useMemo(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isMobile = typeof window !== "undefined" && window.innerWidth < 420
    const axisLabelColor = isDark ? "#3f3f46" : "#a1a1aa"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { graphic } = echarts as any
    const exercises = weeks.map((w) => exerciseMap.get(w) ?? 0)
    const sessions = weeks.map((w) => sessionMap.get(w) ?? 0)
    const maxVal = Math.max(...exercises, 1)

    return {
      backgroundColor: "transparent",
      animation: !reduceMotion,
      animationDuration: 700,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        extraCssText: "border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);",
        textStyle: { color: "#e4e4e7", fontSize: 12 },
        padding: [10, 14],
        axisPointer: { type: "line", lineStyle: { color: "rgba(255,68,68,0.25)" } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter(params: any[]) {
          const label = params[0]?.axisValue ?? ""
          const load = params.find((p) => p.seriesName === "Ejercicios")?.value ?? 0
          const count = params.find((p) => p.seriesName === "Sesiones")?.value ?? 0
          return `<div style="color:#71717a;font-size:10px;margin-bottom:6px">${label}</div>` +
            `<div><b style="color:#22d3ee;font-size:15px">${load}</b><span style="color:#71717a;font-size:11px"> ejercicios</span></div>` +
            `<div><b style="color:#ff4444;font-size:15px">${count}</b><span style="color:#71717a;font-size:11px"> sesiones</span></div>`
        },
      },
      grid: { left: 0, right: 0, top: 18, bottom: 24, containLabel: false },
      xAxis: {
        type: "category",
        data: weeks.map(formatWeekLabel),
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisLabelColor, fontSize: isMobile ? 8 : 9, interval: isMobile ? 1 : 0, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: { type: "value", show: false, max: maxVal + 4 },
      series: [
        {
          name: "Ejercicios",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          data: exercises,
          lineStyle: { width: 3, color: "#22d3ee" },
          itemStyle: { color: "#67e8f9", borderColor: "#0f172a", borderWidth: 2 },
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(34,211,238,0.28)" },
              { offset: 1, color: "rgba(34,211,238,0)" },
            ]),
          },
        },
        {
          name: "Sesiones",
          type: "bar",
          data: sessions,
          barMaxWidth: 14,
          barMinHeight: 3,
          itemStyle: { color: "rgba(255,68,68,0.22)", borderRadius: [5, 5, 2, 2] },
        },
      ],
    }
  }, [weeks, exerciseMap, sessionMap, isDark])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, null, { renderer: "canvas" })
    chartRef.current = chart
    chart.setOption(option as any)

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option as any, { notMerge: false })
  }, [option])

  return <div ref={containerRef} className="min-w-0 max-w-full overflow-hidden" style={{ width: "100%", height: 190 }} />
}

interface WeekdayDonutChartProps {
  weekdayMap: Map<number, number>
  isDark?: boolean
}

function WeekdayDonutChart({ weekdayMap, isDark = true }: WeekdayDonutChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartRef>(null)

  const option = useMemo(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const data = WEEKDAY_LABELS.map((name, day) => ({
      name,
      value: weekdayMap.get(day) ?? 0,
    })).filter((item) => item.value > 0)

    const chartData = data.length > 0 ? data : [{ name: "Sin datos", value: 1, itemStyle: { color: "#27272a" } }]

    return {
      backgroundColor: "transparent",
      animation: !reduceMotion,
      animationDuration: 650,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        extraCssText: "border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);",
        textStyle: { color: "#e4e4e7", fontSize: 12 },
        padding: [10, 14],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter(param: any) {
          if (param.name === "Sin datos") return "Todavía no hay sesiones"
          return `<b style="color:#ff4444;font-size:15px">${param.value}</b>` +
            `<span style="color:#71717a;font-size:11px"> sesiones los ${param.name}</span>`
        },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "82%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          padAngle: 3,
          minAngle: 8,
          itemStyle: { borderRadius: 10, borderColor: isDark ? "#18181b" : "#f4f4f5", borderWidth: 3 },
          label: { color: "#a1a1aa", fontSize: 10, formatter: "{b}" },
          labelLine: { length: 8, length2: 6, lineStyle: { color: "#3f3f46" } },
          color: ["#ff4444", "#fb923c", "#facc15", "#22d3ee", "#34d399", "#a78bfa", "#f472b6"],
          data: chartData,
        },
      ],
    }
  }, [weekdayMap, isDark])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, null, { renderer: "canvas" })
    chartRef.current = chart
    chart.setOption(option as any)

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option as any, { notMerge: false })
  }, [option])

  return <div ref={containerRef} className="min-w-0 max-w-full overflow-hidden" style={{ width: "100%", height: 190 }} />
}

export default function ProgressView({ sessions, trainingDays, exerciseHistory }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  const { weeks, weekMap, exerciseMap, weekdayMap, streak, thisWeekCount, totalCount } = useMemo(() => {
    const map = new Map<string, number>()
    const exercises = new Map<string, number>()
    const weekdays = new Map<number, number>()

    for (const s of sessions) {
      const key = getMondayOf(new Date(s.completed_at)).toISOString().split("T")[0]
      map.set(key, (map.get(key) ?? 0) + 1)
      exercises.set(key, (exercises.get(key) ?? 0) + (s.exercises_count ?? 0))
      weekdays.set(s.day_of_week, (weekdays.get(s.day_of_week) ?? 0) + 1)
    }

    const today = new Date()
    const thisMonday = getMondayOf(today)
    const last12: string[] = []
    for (let i = 11; i >= 0; i--) {
      const m = new Date(thisMonday)
      m.setDate(thisMonday.getDate() - i * 7)
      last12.push(m.toISOString().split("T")[0])
    }

    let s = 0
    for (let i = 0; i <= 52; i++) {
      const m = new Date(thisMonday)
      m.setDate(thisMonday.getDate() - i * 7)
      const k = m.toISOString().split("T")[0]
      if ((map.get(k) ?? 0) > 0) s++
      else break
    }

    const thisWeekKey = thisMonday.toISOString().split("T")[0]

    return {
      weeks: last12,
      weekMap: map,
      exerciseMap: exercises,
      weekdayMap: weekdays,
      streak: s,
      thisWeekCount: map.get(thisWeekKey) ?? 0,
      totalCount: sessions.length,
    }
  }, [sessions])

  const thisWeekKey = weeks[weeks.length - 1]
  const avgPerWeek =
    weeks.length > 0
      ? (weeks.reduce((acc, w) => acc + (weekMap.get(w) ?? 0), 0) / weeks.length).toFixed(1)
      : "0"

  return (
    <div className="w-full max-w-full space-y-6 overflow-hidden">
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
        <StatCard icon={Dumbbell} color="red" label="Total sesiones" value={totalCount} />
        <StatCard icon={Flame} color="orange" label="Racha (semanas)" value={streak} />
        <StatCard icon={CalendarDays} color="cyan" label="Esta semana" value={thisWeekCount} suffix={`/ ${trainingDays}`} />
        <StatCard icon={TrendingUp} color="emerald" label="Prom. semanal" value={avgPerWeek} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Últimas 12 semanas
          </p>
          <p className="mb-4 text-xs text-zinc-600">Sesiones completadas por semana</p>
          <WeeklyBarChart weeks={weeks} weekMap={weekMap} thisWeekKey={thisWeekKey} isDark={isDark} />
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-cyan-500/20 bg-zinc-900/60 p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            Carga de trabajo
          </p>
          <p className="mb-4 text-xs text-zinc-600">Ejercicios completados y frecuencia semanal</p>
          <WeeklyLoadChart weeks={weeks} exerciseMap={exerciseMap} sessionMap={weekMap} isDark={isDark} />
        </div>
      </div>

      <ExerciseProgressionSection history={exerciseHistory} />

      <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Ritmo semanal
        </p>
        <p className="mb-4 text-xs text-zinc-600">Qué días concentrás más entrenamientos</p>
        <WeekdayDonutChart weekdayMap={weekdayMap} isDark={isDark} />
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Historial
        </p>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Dumbbell className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Completá tu primer sesión para ver el historial</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 20).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-zinc-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700/20">
                    <Dumbbell className="h-4 w-4 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize text-zinc-100">{s.day_name}</p>
                    <p className="text-xs text-zinc-500">{formatDate(s.completed_at)}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-zinc-400">
                  {s.exercises_count} ejerc.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type StatColor = "red" | "orange" | "cyan" | "emerald"

const COLOR_MAP: Record<StatColor, { bg: string; icon: string; value: string; border: string }> = {
  red: { bg: "bg-brand-700/10", icon: "text-brand-500", value: "text-brand-400", border: "border-brand-700/25" },
  orange: { bg: "bg-orange-500/10", icon: "text-orange-400", value: "text-orange-300", border: "border-orange-500/25" },
  cyan: { bg: "bg-cyan-500/10", icon: "text-cyan-400", value: "text-cyan-300", border: "border-cyan-500/25" },
  emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-400", value: "text-emerald-300", border: "border-emerald-500/25" },
}

function StatCard({
  icon: Icon, color, label, value, suffix,
}: {
  icon: React.ElementType
  color: StatColor
  label: string
  value: number | string
  suffix?: string
}) {
  const c = COLOR_MAP[color]
  return (
    <div className={cn("min-w-0 rounded-2xl border p-4", c.border, c.bg)}>
      <div className={cn("mb-2 flex h-7 w-7 items-center justify-center rounded-lg", c.bg)}>
        <Icon className={cn("h-4 w-4", c.icon)} />
      </div>
      <p className={cn("text-2xl font-black tabular-nums leading-none", c.value)}>
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-zinc-500">{suffix}</span>}
      </p>
      <p className="mt-1.5 text-xs text-zinc-500">{label}</p>
    </div>
  )
}
