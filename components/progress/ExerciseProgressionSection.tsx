import { Dumbbell } from "lucide-react"
import { ExerciseProgressCard } from "./ExerciseProgressCard"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

export function ExerciseProgressionSection({ history }: { history: ExerciseHistory[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-500">
        <Dumbbell className="h-8 w-8" />
        <p className="text-sm">Todavía no registraste cargas con peso</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Progresión por ejercicio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {history.map(ex => (
          <ExerciseProgressCard key={ex.exerciseId} exercise={ex} />
        ))}
      </div>
    </div>
  )
}
