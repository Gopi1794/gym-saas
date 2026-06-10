import { ProgressSparkline } from "./ProgressSparkline"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

export function ExerciseProgressCard({ exercise }: { exercise: ExerciseHistory }) {
  const lastSession = exercise.sessions[exercise.sessions.length - 1]
  const prevSession = exercise.sessions[exercise.sessions.length - 2]
  const delta = prevSession ? lastSession.maxWeightKg - prevSession.maxWeightKg : null
  const sparkPoints = exercise.sessions.map(s => ({ value: s.maxWeightKg }))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-foreground text-sm leading-tight">{exercise.exerciseName}</p>
          <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 capitalize">{exercise.category}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold text-brand-500">{lastSession.maxWeightKg} kg</span>
          {delta !== null && (
            <span className={`text-xs font-medium ${delta >= 0 ? "text-green-500" : "text-red-400"}`}>
              {delta >= 0 ? "+" : ""}{delta} kg
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Última vez: {formatDate(exercise.lastDate)}</p>
      </div>
      <ProgressSparkline exerciseId={exercise.exerciseId} points={sparkPoints} />
    </div>
  )
}
