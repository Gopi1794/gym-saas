"use client"

import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { MuscleAnatomyEntry } from "@/lib/muscle-anatomy"
import type { ExerciseRecommendation } from "@/lib/muscle-exercises"

interface MuscleDetailSheetProps {
  entry: MuscleAnatomyEntry
  recommendation: ExerciseRecommendation
  minimized: boolean
  onClose: () => void
  onToggle: () => void
}

export function MuscleDetailSheet({ entry, recommendation, minimized, onClose, onToggle }: MuscleDetailSheetProps) {
  const { exercises, source } = recommendation
  return (
    <div
      data-testid="muscle-detail-panel"
      className={`absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md lg:inset-y-0 lg:right-0 lg:left-auto lg:overflow-y-auto lg:rounded-l-3xl lg:rounded-tr-none lg:border-t-0 lg:border-l lg:transition-[width] lg:duration-200 ${minimized ? "lg:w-14" : "lg:w-[min(26rem,35vw)]"}`}
      aria-label={`Detalles de ${entry.displayName}`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-center py-3 lg:hidden"
        aria-label={minimized ? `Mostrar ficha de ${entry.displayName}` : "Minimizar"}
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
              <div className="sticky top-0 z-10 -mx-6 flex items-start justify-between bg-zinc-950/95 px-6 pb-4 pt-1 backdrop-blur-md lg:pt-6">
                <div>
                  <p className="font-display text-2xl text-zinc-50">{entry.displayName}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 font-heading text-[10px] uppercase tracking-wide text-brand-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
                    {entry.category}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onToggle}
                    className="hidden h-9 w-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 lg:grid"
                    aria-label="Ocultar ficha"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
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
                {source === "related" && (
                  <p className="mt-1 text-xs leading-relaxed text-amber-300/80">Ejercicios relacionados: trabajan esta zona de forma complementaria.</p>
                )}
                {source === "none" ? (
                  <div className="mt-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/70 p-3">
                    <p className="text-xs font-medium text-zinc-300">Todavía no hay ejercicios asociados.</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">Cuando un ejercicio incluya este grupo muscular, va a aparecer automáticamente acá.</p>
                  </div>
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
        <button onClick={onToggle} className="flex w-full items-center justify-center gap-1 pb-3 text-xs text-zinc-500 lg:hidden" aria-label={`Mostrar ficha de ${entry.displayName}`}>
          <ChevronDown className="h-3.5 w-3.5" />
          Ver {entry.displayName}
        </button>
      )}

      {minimized && (
        <button
          onClick={onToggle}
          className="hidden h-full w-full items-start justify-center pt-6 text-zinc-400 hover:text-zinc-100 lg:flex"
          aria-label={`Mostrar ficha de ${entry.displayName}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
