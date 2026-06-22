"use client"

import { useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { ProgressSparkline } from "./ProgressSparkline"
import { ExerciseDetailModal } from "./ExerciseDetailModal"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

export function ExerciseProgressCard({ exercise }: { exercise: ExerciseHistory }) {
  const [open, setOpen] = useState(false)

  const lastSession = exercise.sessions[exercise.sessions.length - 1]
  const prevSession = exercise.sessions[exercise.sessions.length - 2]
  const isKg = exercise.metric === "kg"
  const isDuration = exercise.metric === "duration"

  const getValue = (s: typeof lastSession) =>
    isKg ? (s.maxWeightKg ?? 0) : isDuration ? Math.round(s.totalDurationSec / 60) : s.totalReps

  const currentValue = getValue(lastSession)
  const prevValue = prevSession ? getValue(prevSession) : null
  const delta = prevValue !== null ? currentValue - prevValue : null
  const sparkPoints = exercise.sessions.map(s => ({ value: getValue(s) }))
  const unit = isKg ? "kg" : isDuration ? "min" : "reps"
  const sessionCount = exercise.sessions.length

  const DeltaIcon = delta === null || delta === 0 ? null : delta > 0 ? TrendingUp : TrendingDown
  const deltaColor = delta === null || delta === 0 ? "text-zinc-400" : delta > 0 ? "text-emerald-500" : "text-red-400"
  const chartValues = exercise.sessions.map(s => getValue(s))
  const maxChartValue = Math.max(...chartValues, 1)
  const previousSessions = exercise.sessions.slice(-5, -1)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group min-w-0 w-full overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ease-out active:scale-[0.98] hover:border-white/[0.10] hover:bg-zinc-800 text-left"
      >
        <div className="grid min-h-[132px] grid-cols-[1fr_1.45fr] gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-zinc-100">{exercise.exerciseName}</p>
            <div className="mt-5 h-12 overflow-hidden">
              <ProgressSparkline
                exerciseId={`mini-${exercise.exerciseId}`}
                points={sparkPoints}
                height={48}
                className="h-12 w-full opacity-80"
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold leading-none text-zinc-100">
                  {currentValue} <span className="text-base font-semibold text-zinc-100">{unit}</span>
                </p>
                <p className="mt-1 text-[11px] leading-none text-zinc-500">{formatDate(exercise.lastDate)} · {sessionCount} sesión{sessionCount !== 1 ? "es" : ""}</p>
              </div>

              <div className="text-right">
                <p className="text-xl font-semibold leading-none text-zinc-500">
                  {prevValue ?? "—"} {prevValue !== null ? unit : ""}
                </p>
                {delta !== null && delta !== 0 && DeltaIcon ? (
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold ${deltaColor}`}>
                    <DeltaIcon className="h-3 w-3" />
                    <span>{delta > 0 ? "+" : ""}{delta} {unit} vs prev</span>
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] font-semibold text-zinc-500">—</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex h-12 items-end gap-4 border-t border-white/5 pt-1">
              {previousSessions.map((session) => {
                const value = getValue(session)
                const height = Math.max(18, (value / maxChartValue) * 44)

                return (
                  <div key={session.sessionId} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex h-9 w-full items-end justify-center">
                      <span className="absolute bottom-0 h-px w-full bg-zinc-500/25" />
                      <span
                        className="w-5 rounded-sm bg-gradient-to-t from-zinc-600 to-zinc-300 shadow-[0_0_14px_rgba(255,255,255,0.08)]"
                        style={{ height }}
                      />
                    </div>
                    <span className="text-[8px] font-medium text-zinc-600">
                      {formatDate(session.date)}
                    </span>
                  </div>
                )
              })}
              <div className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex h-9 w-full items-end justify-center">
                  <span className="absolute bottom-0 h-px w-full bg-zinc-500/25" />
                  <span className="w-5 rounded-sm bg-gradient-to-t from-red-500 to-red-400 shadow-[0_0_18px_rgba(239,68,68,0.35)]" style={{ height: 44 }} />
                </div>
                <span className="text-[8px] font-bold text-zinc-500">hoy</span>
              </div>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <ExerciseDetailModal exercise={exercise} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
