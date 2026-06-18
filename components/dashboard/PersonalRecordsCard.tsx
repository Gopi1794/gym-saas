import { Trophy } from "lucide-react"

type PREntry = {
  exercise_name: string
  weight_kg: number
}

export default function PersonalRecordsCard({ records }: { records: PREntry[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Récords personales</p>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Todavía no tenés PRs registrados. El trainer los puede cargar desde el chat.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Récords personales</p>
        <span className="ml-auto text-xs text-zinc-500">{records.length} ejercicios</span>
      </div>
      <div className="space-y-2.5">
        {records.map((r) => (
          <div key={r.exercise_name} className="flex items-center justify-between gap-2">
            <span className="truncate text-sm capitalize text-zinc-700 dark:text-zinc-300">
              {r.exercise_name}
            </span>
            <span className="shrink-0 text-sm font-black text-zinc-900 dark:text-white">
              {r.weight_kg}{" "}
              <span className="text-xs font-normal text-zinc-500">kg</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
