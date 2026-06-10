"use client"

import { useState } from "react"
import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"
import { ExerciseProgressCard } from "./ExerciseProgressCard"
import type { ExerciseHistory } from "@/app/actions/exercise-maxes"

type Filter = "all" | "kg" | "reps"

const TABS: { key: Filter; label: string }[] = [
  { key: "all",  label: "Todos"   },
  { key: "kg",   label: "Fuerza"  },
  { key: "reps", label: "Cuerpo"  },
]

export function ExerciseProgressionSection({ history }: { history: ExerciseHistory[] }) {
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = filter === "all" ? history : history.filter(e => e.metric === filter)

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Progresión por ejercicio
        </p>

        {/* Tab pills */}
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === tab.key
                  ? "bg-brand-700/80 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-zinc-600">
          <Dumbbell className="h-7 w-7" />
          <p className="text-sm">
            {history.length === 0
              ? "Completá una sesión para ver tu progresión"
              : "Sin ejercicios en esta categoría"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(ex => (
            <ExerciseProgressCard key={ex.exerciseId} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  )
}
