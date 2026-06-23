"use client"

import { useState, useMemo } from "react"
import {
  Sparkles, RotateCw, ChevronDown, ChevronUp, Calendar, BarChart2,
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Dumbbell,
  Lightbulb, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  generateWorkoutInsights,
  type WorkoutAnalysis,
  type InsightType,
  type InsightSession,
} from "@/app/actions/workout-insights"

// ── Types ────────────────────────────────────────────────────────────────────

type SessionSet = {
  exercise_name: string
  set_number: number
  actual_reps: number | null
  planned_reps: number | null
  weight_kg: number | null
}

type Session = {
  id: string
  day_name: string
  completed_at: string
  sets: SessionSet[]
}

type Props = {
  sessions: Session[]
  member: { goal: string | null; training_frequency: string | null }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sessionMetrics(sets: SessionSet[]) {
  let tp = 0, ta = 0, vol = 0
  for (const s of sets) {
    if (s.planned_reps != null) tp += s.planned_reps
    if (s.actual_reps != null) {
      ta += s.actual_reps
      if (s.weight_kg != null) vol += s.actual_reps * s.weight_kg
    }
  }
  return { adherence: tp > 0 ? Math.round((ta / tp) * 100) : null, volumeKg: Math.round(vol) }
}

function exerciseGroups(sets: SessionSet[]) {
  const map: Record<string, SessionSet[]> = {}
  for (const s of sets) {
    if (!map[s.exercise_name]) map[s.exercise_name] = []
    map[s.exercise_name].push(s)
  }
  return Object.entries(map).map(([name, exSets]) => {
    let tp = 0, ta = 0
    for (const s of exSets) {
      if (s.planned_reps != null) tp += s.planned_reps
      if (s.actual_reps != null) ta += s.actual_reps
    }
    const maxSet = Math.max(...exSets.map(s => s.set_number))
    return {
      name,
      adherence: tp > 0 ? Math.round((ta / tp) * 100) : null,
      plannedSets: maxSet,
      completedSets: exSets.length,
      sets: exSets.sort((a, b) => a.set_number - b.set_number),
      anyModified: exSets.some(
        s => s.planned_reps != null && s.actual_reps != null && s.actual_reps !== s.planned_reps
      ),
    }
  })
}

const adherenceTextColor = (pct: number | null) =>
  pct == null ? "text-zinc-400" : pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"

const adherenceBarColor = (pct: number | null) =>
  pct == null ? "bg-zinc-600" : pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"

const adherenceHex = (pct: number | null) =>
  pct == null ? "#71717a" : pct >= 90 ? "#10b981" : pct >= 70 ? "#f97316" : "#ef4444"

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ value, size, strokeWidth, color }: {
  value: number; size: number; strokeWidth: number; color: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(Math.max(value, 0), 100) / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3f3f46" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  )
}

// ── Insight card themes ───────────────────────────────────────────────────────

const THEMES = {
  amber:   { bg: "bg-amber-500/5",   border: "border-amber-500/20",   iconBg: "bg-amber-500/10",   icon: "text-amber-400",   val: "text-amber-400",   btn: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"   },
  emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", iconBg: "bg-emerald-500/10", icon: "text-emerald-400", val: "text-emerald-400", btn: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" },
  blue:    { bg: "bg-blue-500/5",    border: "border-blue-500/20",    iconBg: "bg-blue-500/10",    icon: "text-blue-400",    val: "text-blue-400",    btn: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"    },
  purple:  { bg: "bg-purple-500/5",  border: "border-purple-500/20",  iconBg: "bg-purple-500/10",  icon: "text-purple-400",  val: "text-purple-400",  btn: "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"  },
} as const
type ThemeKey = keyof typeof THEMES

function insightTheme(type: InsightType, index: number): ThemeKey {
  if (type === "positive") return "emerald"
  if (type === "warning") return "amber"
  return index % 2 === 0 ? "blue" : "purple"
}

function InsightIcon({ type, cls }: { type: InsightType; cls: string }) {
  if (type === "positive") return <CheckCircle className={cn("h-4 w-4", cls)} />
  if (type === "warning")  return <TrendingDown className={cn("h-4 w-4", cls)} />
  return <TrendingUp className={cn("h-4 w-4", cls)} />
}

const BADGE_COPY: Record<InsightType, string> = {
  positive: "Mentalidad correcta.",
  warning:  "Revisá cuando estés fresco.",
  suggestion: "Seguí aplicando la misma lógica.",
}

// ── Main component ────────────────────────────────────────────────────────────

const EXERCISE_LIMIT = 5

export default function MemberWorkoutHistory({ sessions, member }: Props) {
  const [analysis, setAnalysis]       = useState<WorkoutAnalysis | null>(null)
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<Set<string>>(() => new Set(sessions[0] ? [sessions[0].id] : []))
  const [showAll, setShowAll]         = useState<Set<string>>(new Set())

  // Per-exercise adherence map (across all sessions)
  const exAdherenceMap = useMemo(() => {
    const acc: Record<string, { tp: number; ta: number }> = {}
    for (const s of sessions)
      for (const set of s.sets) {
        const key = set.exercise_name.toLowerCase()
        if (!acc[key]) acc[key] = { tp: 0, ta: 0 }
        if (set.planned_reps != null) acc[key].tp += set.planned_reps
        if (set.actual_reps != null)  acc[key].ta += set.actual_reps
      }
    const result: Record<string, number> = {}
    for (const [k, { tp, ta }] of Object.entries(acc))
      if (tp > 0) result[k] = Math.round((ta / tp) * 100)
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  // Overall adherence
  const overallAdherence = useMemo(() => {
    let tp = 0, ta = 0
    for (const s of sessions)
      for (const set of s.sets) {
        if (set.planned_reps != null) tp += set.planned_reps
        if (set.actual_reps  != null) ta += set.actual_reps
      }
    return tp > 0 ? Math.round((ta / tp) * 100) : null
  }, [sessions])

  // Computed stat: exercises below 70%
  const below70 = useMemo(() => {
    const vals = Object.values(exAdherenceMap)
    return { count: vals.filter(v => v < 70).length, total: vals.length }
  }, [exAdherenceMap])

  async function handleAnalyze() {
    setLoading(true)
    try {
      const payload: InsightSession[] = sessions.map(s => ({
        day_name: s.day_name,
        completed_at: s.completed_at,
        sets: s.sets.map(set => ({
          exercise_name: set.exercise_name,
          set_number: set.set_number,
          actual_reps: set.actual_reps,
          planned_reps: set.planned_reps,
          weight_kg: set.weight_kg,
        })),
      }))
      setAnalysis(await generateWorkoutInsights(payload, member))
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll(id: string) {
    setShowAll(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const donutColor = adherenceHex(overallAdherence)

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Historial de entrenamientos</h2>
        <p className="text-sm text-muted-foreground">Últimas {sessions.length} sesiones</p>
      </div>

      {/* ── AI Analysis Card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white">Análisis IA</p>
              {analysis && (
                <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">{analysis.overall}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Donut + label */}
            {overallAdherence != null && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative">
                  <DonutChart value={overallAdherence} size={72} strokeWidth={6} color={donutColor} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black leading-none" style={{ color: donutColor }}>
                      {overallAdherence}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 text-center leading-tight">Adherencia<br />general</p>
              </div>
            )}

            {/* Analizar / Actualizar button */}
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RotateCw className="h-3.5 w-3.5" />}
              {analysis ? "Actualizar" : "Analizar"}
            </button>
          </div>
        </div>

        {/* State: empty */}
        {!analysis && !loading && (
          <div className="rounded-xl border border-dashed border-zinc-700 py-8 text-center">
            <Sparkles className="h-5 w-5 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">
              Presioná <span className="text-zinc-300 font-medium">Analizar</span> para obtener recomendaciones con IA
            </p>
          </div>
        )}

        {/* State: loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-800/50 h-44 animate-pulse" />
            ))}
          </div>
        )}

        {/* State: analysis ready */}
        {analysis && (
          <>
            {/* 4 insight cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Slot 0: computed stat */}
              {(() => {
                const isWarning = below70.count > Math.ceil(below70.total * 0.3)
                const t = isWarning ? THEMES.amber : THEMES.emerald
                return (
                  <div className={cn("rounded-2xl border p-4 flex flex-col gap-2", t.bg, t.border)}>
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", t.iconBg)}>
                      {isWarning
                        ? <AlertTriangle className={cn("h-4 w-4", t.icon)} />
                        : <CheckCircle className={cn("h-4 w-4", t.icon)} />}
                    </div>
                    <p className={cn("text-2xl font-black mt-1 tabular-nums", t.val)}>
                      {below70.count} / {below70.total}
                    </p>
                    <p className="text-xs font-medium text-zinc-200 leading-tight">
                      Ejercicios por debajo del 70% planificado
                    </p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed flex-1">
                      {isWarning
                        ? "Para ganar músculo necesitás estar más cerca del 85-95%."
                        : "Excelente adherencia al plan de entrenamiento."}
                    </p>
                  </div>
                )
              })()}

              {/* Slots 1-3: AI insights */}
              {analysis.insights.slice(0, 3).map((insight, i) => {
                const t = THEMES[insightTheme(insight.type, i)]
                const exKey = insight.exercise?.toLowerCase()
                const exAdh = exKey ? exAdherenceMap[exKey] : undefined
                return (
                  <div key={i} className={cn("rounded-2xl border p-4 flex flex-col gap-2", t.bg, t.border)}>
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", t.iconBg)}>
                      <InsightIcon type={insight.type} cls={t.icon} />
                    </div>
                    {insight.exercise && (
                      <p className={cn("text-xs font-semibold capitalize mt-1", t.val)}>{insight.exercise}</p>
                    )}
                    {exAdh != null && (
                      <p className={cn("text-2xl font-black tabular-nums", t.val)}>{exAdh}%</p>
                    )}
                    <p className="text-xs text-zinc-300 leading-relaxed flex-1">{insight.text}</p>
                    <button className={cn(
                      "self-start border rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                      t.btn
                    )}>
                      {BADGE_COPY[insight.type]}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Main recommendation bar */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">Recomendación principal</p>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{analysis.insights[0]?.text}</p>
                </div>
              </div>
              <button className="shrink-0 flex items-center gap-1 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors whitespace-nowrap">
                Ver sugerencias completas
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Session Cards ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {sessions.map(session => {
          const { adherence, volumeKg } = sessionMetrics(session.sets)
          const exercises = exerciseGroups(session.sets)
          const isExpanded = expanded.has(session.id)
          const seeAll = showAll.has(session.id)
          const visible = seeAll ? exercises : exercises.slice(0, EXERCISE_LIMIT)
          const hidden = exercises.length - EXERCISE_LIMIT
          const sColor = adherenceHex(adherence)

          return (
            <div key={session.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {/* Session header */}
              <button
                onClick={() => toggle(session.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800/40 transition-colors text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <Calendar className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white capitalize">{session.day_name}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(session.completed_at).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "long", year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {volumeKg > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 text-zinc-400">
                      <BarChart2 className="h-3.5 w-3.5" />
                      <span className="text-xs">
                        Volumen total{" "}
                        <span className="font-semibold text-zinc-200">
                          {volumeKg >= 1000 ? `${(volumeKg / 1000).toFixed(1)}t` : `${volumeKg}kg`}
                        </span>
                      </span>
                    </div>
                  )}
                  {adherence != null && (
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <DonutChart value={adherence} size={44} strokeWidth={4} color={sColor} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-black" style={{ color: sColor }}>{adherence}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 hidden sm:inline">Adherencia</span>
                    </div>
                  )}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-zinc-500" />
                    : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                </div>
              </button>

              {/* Exercise rows */}
              {isExpanded && (
                <div className="border-t border-zinc-800">
                  {visible.map((ex, idx) => (
                    <div key={ex.name} className={cn("px-5 py-3.5", idx > 0 && "border-t border-zinc-800/50")}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <Dumbbell className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-semibold text-white capitalize truncate flex-1">{ex.name}</p>
                            {ex.anyModified && (
                              <span className="shrink-0 text-[10px] font-semibold text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">
                                modificado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {ex.adherence != null && (
                              <span className={cn("text-sm font-bold shrink-0 tabular-nums w-10", adherenceTextColor(ex.adherence))}>
                                {ex.adherence}%
                              </span>
                            )}
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-700/60 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", adherenceBarColor(ex.adherence))}
                                style={{ width: `${Math.min(ex.adherence ?? 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-zinc-500 shrink-0 whitespace-nowrap">
                              {ex.completedSets} / {ex.plannedSets} series
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Set chips */}
                      <div className="mt-2.5 pl-[52px] flex flex-wrap gap-1.5">
                        {ex.sets.map(s => {
                          const diff =
                            s.planned_reps != null && s.actual_reps != null && s.actual_reps !== s.planned_reps
                          return (
                            <div
                              key={s.set_number}
                              className={cn(
                                "flex items-center gap-1 rounded-lg px-2 py-1 text-xs",
                                diff ? "bg-amber-500/10 border border-amber-500/20" : "bg-zinc-800"
                              )}
                            >
                              <span className="text-zinc-500">S{s.set_number}</span>
                              <span className={cn("font-semibold", diff ? "text-amber-400" : "text-white")}>
                                {s.actual_reps ?? "—"}
                              </span>
                              {diff && <span className="text-zinc-500">/ {s.planned_reps}</span>}
                              {s.weight_kg != null && s.weight_kg > 0 && (
                                <span className="text-zinc-400 ml-0.5">{s.weight_kg}kg</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Ver más */}
                  {!seeAll && hidden > 0 && (
                    <button
                      onClick={() => toggleAll(session.id)}
                      className="w-full border-t border-zinc-800/50 py-3 text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      Ver más ejercicios ({hidden})
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
