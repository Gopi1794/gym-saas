"use client"

import { useState } from "react"
import { Dumbbell, Search } from "lucide-react"
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
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-brand-700/25 bg-[linear-gradient(180deg,rgba(9,9,11,0.98),rgba(24,24,27,0.94))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Progresión por ejercicio
          </p>

          <button className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_0_18px_rgba(213,0,0,0.28)] transition-transform duration-150 ease-out hover:bg-brand-600 active:scale-95">
            <Search className="h-3.5 w-3.5" />
            Ver detalles
          </button>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/70 p-0.5 shadow-inner">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-150 ease-out active:scale-95",
                filter === tab.key
                  ? "bg-brand-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
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
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] py-8 text-zinc-600">
          <Dumbbell className="h-7 w-7" />
          <p className="text-sm">
            {history.length === 0
              ? "Completá una sesión para ver tu progresión"
              : "Sin ejercicios en esta categoría"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map(ex => (
            <ExerciseProgressCard key={ex.exerciseId} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  )
}
