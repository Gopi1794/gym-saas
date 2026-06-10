import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { ProgressSparkline } from "./ProgressSparkline"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

export function ExerciseProgressCard({ exercise }: { exercise: ExerciseHistory }) {
  const lastSession = exercise.sessions[exercise.sessions.length - 1]
  const prevSession = exercise.sessions[exercise.sessions.length - 2]
  const isKg = exercise.metric === "kg"

  const currentValue = isKg ? (lastSession.maxWeightKg ?? 0) : lastSession.totalReps
  const prevValue = prevSession ? (isKg ? (prevSession.maxWeightKg ?? 0) : prevSession.totalReps) : null
  const delta = prevValue !== null ? currentValue - prevValue : null
  const sparkPoints = exercise.sessions.map(s => ({ value: isKg ? (s.maxWeightKg ?? 0) : s.totalReps }))
  const unit = isKg ? "kg" : "reps"
  const sessionCount = exercise.sessions.length

  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown
  const deltaColor = delta === null || delta === 0 ? "text-zinc-500" : delta > 0 ? "text-green-400" : "text-red-400"

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60">
      <div className="px-5 pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-foreground text-sm leading-tight">{exercise.exerciseName}</p>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 capitalize">
            {exercise.category}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-bold text-brand-400 leading-none">
              {currentValue}
              <span className="text-sm font-medium text-zinc-500 ml-1">{unit}</span>
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">{formatDate(exercise.lastDate)} · {sessionCount} sesión{sessionCount !== 1 ? "es" : ""}</p>
          </div>

          {delta !== null && (
            <div className={`flex items-center gap-1 ${deltaColor}`}>
              <DeltaIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {delta > 0 ? "+" : ""}{delta} {unit}
              </span>
            </div>
          )}
        </div>
      </div>

      <ProgressSparkline exerciseId={exercise.exerciseId} points={sparkPoints} />
    </div>
  )
}
