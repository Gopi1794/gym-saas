"use client"

import { useMemo } from "react"
import { Flame, TrendingUp, Dumbbell, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { ExerciseProgressionSection } from "./ExerciseProgressionSection"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short",
  })
}

function formatWeekShort(mondayIso: string): string {
  const d = new Date(mondayIso + "T12:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

// ── CSS bar chart: últimas 12 semanas ──────────────────────────────────
function WeeklyBars({
  weeks,
  weekMap,
  thisWeekKey,
}: {
  weeks: string[]
  weekMap: Map<string, number>
  thisWeekKey: string
}) {
  const maxVal = Math.max(...weeks.map(w => weekMap.get(w) ?? 0), 1)

  return (
    <div className="flex items-end gap-1 h-28">
      {weeks.map((w) => {
        const count = weekMap.get(w) ?? 0
        const isCurrent = w === thisWeekKey
        const heightPct = count === 0 ? 4 : Math.max(8, Math.round((count / maxVal) * 100))
        return (
          <div key={w} className="flex flex-1 flex-col items-center gap-1">
            <span className={cn(
              "text-[9px] tabular-nums leading-none",
              count > 0 ? (isCurrent ? "text-brand-500 font-bold" : "text-zinc-500") : "text-transparent"
            )}>
              {count > 0 ? count : "·"}
            </span>
            <div
              className={cn(
                "w-full rounded-t-sm",
                count === 0
                  ? "bg-zinc-800"
                  : isCurrent
                    ? "bg-brand-600"
                    : "bg-brand-900"
              )}
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[8px] text-zinc-600 leading-none truncate w-full text-center">
              {formatWeekShort(w).split(" ")[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Día de la semana: barras horizontales ──────────────────────────────
function WeekdayBars({ weekdayMap }: { weekdayMap: Map<number, number> }) {
  const maxVal = Math.max(...Array.from(weekdayMap.values()), 1)
  // Mon→Sun order (1-6, 0)
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div className="space-y-2">
      {order.map((dow) => {
        const count = weekdayMap.get(dow) ?? 0
        const widthPct = Math.max(count === 0 ? 0 : 4, Math.round((count / maxVal) * 100))
        return (
          <div key={dow} className="flex items-center gap-3">
            <span className="w-7 shrink-0 text-[11px] text-zinc-500">{WEEKDAY_LABELS[dow]}</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full">
              <div
                className={cn("h-full rounded-full", count > 0 ? "bg-brand-600" : "bg-zinc-800")}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────
type StatColor = "red" | "orange" | "cyan" | "emerald"

const COLOR_MAP: Record<StatColor, { icon: string; value: string; border: string }> = {
  red:     { icon: "text-brand-500",   value: "text-brand-400",   border: "border-brand-700/40"   },
  orange:  { icon: "text-orange-400",  value: "text-orange-300",  border: "border-orange-500/40"  },
  cyan:    { icon: "text-cyan-400",    value: "text-cyan-300",    border: "border-cyan-500/40"    },
  emerald: { icon: "text-emerald-400", value: "text-emerald-300", border: "border-emerald-500/40" },
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
    <div className={cn("min-w-0 rounded-2xl border bg-zinc-900 p-4", c.border)}>
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800">
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

// ── Main component ─────────────────────────────────────────────────────
export default function ProgressView({ sessions, trainingDays, exerciseHistory }: Props) {
  const { weeks, weekMap, weekdayMap, streak, thisWeekCount, totalCount } = useMemo(() => {
    const map = new Map<string, number>()
    const weekdays = new Map<number, number>()

    for (const s of sessions) {
      const key = getMondayOf(new Date(s.completed_at)).toISOString().split("T")[0]
      map.set(key, (map.get(key) ?? 0) + 1)
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
    <div className="w-full max-w-full space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Dumbbell}     color="red"     label="Total sesiones"  value={totalCount} />
        <StatCard icon={Flame}        color="orange"  label="Racha (semanas)" value={streak} />
        <StatCard icon={CalendarDays} color="cyan"    label="Esta semana"     value={thisWeekCount} suffix={`/ ${trainingDays}`} />
        <StatCard icon={TrendingUp}   color="emerald" label="Prom. semanal"   value={avgPerWeek} />
      </div>

      {/* Últimas 12 semanas */}
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900 p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Últimas 12 semanas
        </p>
        <p className="mb-4 text-xs text-zinc-600">Sesiones completadas por semana</p>
        <WeeklyBars weeks={weeks} weekMap={weekMap} thisWeekKey={thisWeekKey} />
      </div>

      {/* Ritmo semanal */}
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900 p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Ritmo semanal
        </p>
        <p className="mb-4 text-xs text-zinc-600">Qué días entrenás más</p>
        <WeekdayBars weekdayMap={weekdayMap} />
      </div>

      {/* Progresión de ejercicios */}
      <ExerciseProgressionSection history={exerciseHistory} />

      {/* Historial */}
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900 p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Historial
        </p>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Dumbbell className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Completá tu primer sesión para ver el historial</p>
          </div>
        ) : (
          <div>
            {sessions.slice(0, 20).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border-b border-zinc-800 px-1 py-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
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
