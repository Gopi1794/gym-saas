"use client"

import { useMemo } from "react"
import { Flame, TrendingUp, Dumbbell, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

export type SessionRecord = {
  id: string
  day_name: string
  day_of_week: number
  exercises_count: number
  completed_at: string
}

interface Props {
  sessions: SessionRecord[]
  trainingDays: number // days per week in the plan
}

// ── helpers ────────────────────────────────────────────────

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

// ── main component ─────────────────────────────────────────

export default function ProgressView({ sessions, trainingDays }: Props) {
  const { weeks, weekMap, streak, thisWeekCount, totalCount } = useMemo(() => {
    // Build week map: mondayISO → session count
    const map = new Map<string, number>()
    for (const s of sessions) {
      const key = getMondayOf(new Date(s.completed_at)).toISOString().split("T")[0]
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    // Last 12 weeks
    const today = new Date()
    const thisMonday = getMondayOf(today)
    const last12: string[] = []
    for (let i = 11; i >= 0; i--) {
      const m = new Date(thisMonday)
      m.setDate(thisMonday.getDate() - i * 7)
      last12.push(m.toISOString().split("T")[0])
    }

    // Streak (consecutive weeks going back from this week)
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
      streak: s,
      thisWeekCount: map.get(thisWeekKey) ?? 0,
      totalCount: sessions.length,
    }
  }, [sessions])

  const maxBar = Math.max(...weeks.map(w => weekMap.get(w) ?? 0), 1)
  const thisWeekKey = weeks[weeks.length - 1]
  const avgPerWeek = weeks.length > 0
    ? (weeks.reduce((acc, w) => acc + (weekMap.get(w) ?? 0), 0) / weeks.length).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Dumbbell}   color="violet" label="Total sesiones"  value={totalCount} />
        <StatCard icon={Flame}      color="orange" label="Racha (semanas)" value={streak} />
        <StatCard icon={CalendarDays} color="cyan" label="Esta semana"     value={thisWeekCount} suffix={`/ ${trainingDays}`} />
        <StatCard icon={TrendingUp} color="emerald" label="Prom. semanal"  value={avgPerWeek} />
      </div>

      {/* ── Bar chart ── */}
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Últimas 12 semanas
        </p>

        <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
          {weeks.map((monday) => {
            const count  = weekMap.get(monday) ?? 0
            const isThis = monday === thisWeekKey
            const pct    = count === 0 ? 0 : Math.max((count / maxBar) * 100, 8)

            return (
              <div key={monday} className="flex flex-1 min-w-[28px] flex-col items-center gap-1.5">
                {/* Bar */}
                <div className="relative flex w-full flex-col justify-end" style={{ height: 96 }}>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-500",
                      count === 0
                        ? "bg-zinc-800/60"
                        : isThis
                          ? "bg-brand-500 shadow-[0_0_12px_rgba(167,139,250,0.5)]"
                          : "bg-brand-700/70",
                    )}
                    style={{ height: count === 0 ? 4 : `${pct}%` }}
                  />
                  {count > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-zinc-300">
                      {count}
                    </span>
                  )}
                </div>
                {/* Week label */}
                <span className={cn(
                  "text-[9px] font-medium text-center leading-tight",
                  isThis ? "text-brand-500 font-bold" : "text-zinc-600",
                )}>
                  {formatWeekLabel(monday)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Session history ── */}
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5">
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

// ── StatCard ───────────────────────────────────────────────

type StatColor = "violet" | "orange" | "cyan" | "emerald"

const COLOR_MAP: Record<StatColor, { icon: string; value: string; border: string }> = {
  violet:  { icon: "text-brand-500",  value: "text-brand-400",  border: "border-brand-700/20" },
  orange:  { icon: "text-orange-400",  value: "text-orange-300",  border: "border-orange-500/20" },
  cyan:    { icon: "text-cyan-400",    value: "text-cyan-300",    border: "border-cyan-500/20"   },
  emerald: { icon: "text-emerald-400", value: "text-emerald-300", border: "border-emerald-500/20" },
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
    <div className={cn("rounded-2xl border bg-zinc-900/60 p-4", c.border)}>
      <Icon className={cn("h-4 w-4 mb-2", c.icon)} />
      <p className={cn("text-2xl font-black tabular-nums leading-none", c.value)}>
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-zinc-500">{suffix}</span>}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  )
}
