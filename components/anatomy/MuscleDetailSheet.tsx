"use client"

import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronDown } from "lucide-react"
import type { MuscleAnatomyEntry } from "@/lib/muscle-anatomy"
import type { Exercise } from "@/lib/muscle-exercises"

interface MuscleDetailSheetProps {
  entry: MuscleAnatomyEntry
  exercises: Exercise[]
  minimized: boolean
  onClose: () => void
  onMinimize: () => void
}

export function MuscleDetailSheet({ entry, exercises, minimized, onClose, onMinimize }: MuscleDetailSheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <button
        onClick={onMinimize}
        className="flex w-full items-center justify-center py-3"
        aria-label="Minimizar"
      >
        <span className="h-1 w-10 rounded-full bg-zinc-700" />
      </button>

      {!minimized && (
        <div className="px-6 pb-8">
          {/* La key en el nombre del musculo fuerza el crossfade cada vez que cambia la zona seleccionada */}
          <AnimatePresence mode="wait">
            <motion.div
              key={entry.zone}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl text-zinc-50">{entry.displayName}</p>
                  <p className="font-heading text-xs uppercase tracking-wide text-brand-500">{entry.category}</p>
                </div>
                <button
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-[13px]">
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Origen:</span>
                  <span className="text-zinc-100">{entry.origen}</span>
                </div>
                <div className="h-px bg-zinc-800" />
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Inserción:</span>
                  <span className="text-zinc-100">{entry.insercion}</span>
                </div>
                <div className="h-px bg-zinc-800" />
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Función:</span>
                  <span className="text-zinc-100">{entry.funcion}</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="font-heading text-sm text-zinc-50">Ejercicios Recomendados</p>
                {exercises.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">No hay ejercicios cargados para este músculo todavía.</p>
                ) : (
                  <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                    {exercises.map(exercise => (
                      <div key={exercise.id} className="w-[160px] shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                        <p className="truncate text-[13px] font-bold text-zinc-100">{exercise.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {minimized && (
        <div className="flex items-center justify-center gap-1 pb-3 text-xs text-zinc-500">
          <ChevronDown className="h-3.5 w-3.5" />
          Ver {entry.displayName}
        </div>
      )}
    </div>
  )
}
