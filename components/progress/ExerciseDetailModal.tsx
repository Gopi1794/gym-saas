"use client"

import { useEffect } from "react"
import { X, TrendingUp, TrendingDown } from "lucide-react"
import { ProgressSparkline } from "./ProgressSparkline"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })
}

const METRIC_LABEL: Record<string, string> = {
  kg: "Fuerza",
  reps: "Cuerpo",
  duration: "Cardio",
}

export function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: ExerciseHistory
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const isKg = exercise.metric === "kg"
  const isDuration = exercise.metric === "duration"
  const unit = isKg ? "kg" : isDuration ? "min" : "reps"

  const getValue = (s: (typeof exercise.sessions)[number]) =>
    isKg ? (s.maxWeightKg ?? 0) : isDuration ? Math.round(s.totalDurationSec / 60) : s.totalReps

  const sparkPoints = exercise.sessions.map(s => ({ value: getValue(s) }))

  // Reversed for display (newest first)
  const reversedSessions = [...exercise.sessions].reverse()
  const maxValue = Math.max(...exercise.sessions.map(getValue), 1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Sheet / Modal */}
      <div
        className="relative z-10 w-full max-w-lg rounded-t-3xl border-t border-white/[0.08] bg-zinc-950 pb-10 md:rounded-2xl md:border md:border-white/[0.10] md:pb-6 md:mx-4"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "85dvh", overflowY: "auto" }}
      >
        {/* Drag indicator — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-3 pb-4">
          <div>
            <h2 className="text-lg font-bold capitalize text-zinc-100">{exercise.exerciseName}</h2>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-brand-500">
              {METRIC_LABEL[exercise.metric]} · {exercise.sessions.length} sesión{exercise.sessions.length !== 1 ? "es" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sparkline grande */}
        {sparkPoints.length >= 2 && (
          <div className="mx-6 mb-5 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 pt-4 pb-2">
            <ProgressSparkline
              exerciseId={`detail-${exercise.exerciseId}`}
              points={sparkPoints}
              height={72}
              className="h-[72px] w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
              <span>{formatDate(exercise.sessions[0].date)}</span>
              <span>{formatDate(exercise.sessions[exercise.sessions.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Session list */}
        <div className="px-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Historial</p>
          <div className="flex flex-col gap-2">
            {reversedSessions.map((session, idx) => {
              const value = getValue(session)
              const prevSession = reversedSessions[idx + 1]
              const prevValue = prevSession ? getValue(prevSession) : null
              const delta = prevValue !== null ? value - prevValue : null
              const barWidth = Math.max(8, Math.round((value / maxValue) * 100))

              return (
                <div
                  key={session.sessionId}
                  className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">{formatDate(session.date)}</p>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-zinc-100">{value}</span>
                        <span className="text-xs text-zinc-500">{unit}</span>
                        {isKg && session.maxWeightKg != null && (
                          <span className="text-[10px] text-zinc-600">· {session.setCount} set{session.setCount !== 1 ? "s" : ""}</span>
                        )}
                        {!isKg && (
                          <span className="text-[10px] text-zinc-600">· {session.setCount} set{session.setCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>

                    {delta !== null && delta !== 0 ? (
                      <div className={`flex items-center gap-1 text-[11px] font-semibold ${delta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                        {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {delta > 0 ? "+" : ""}{delta} {unit}
                      </div>
                    ) : delta === 0 ? (
                      <span className="text-[11px] text-zinc-600">= igual</span>
                    ) : null}
                  </div>

                  {/* Bar */}
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-500"
                      style={{ width: `${barWidth}%`, transition: "width 400ms ease" }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
