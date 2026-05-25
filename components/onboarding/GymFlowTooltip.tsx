"use client"

import { motion } from "framer-motion"
import { X } from "lucide-react"
import type { TooltipRenderProps } from "react-joyride"

export default function GymFlowTooltip({
  index,
  isLastStep,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div {...tooltipProps} style={{ zIndex: 9999, maxWidth: 360, width: "100vw" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-md shadow-2xl shadow-black/60 p-5 mx-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-600/20 text-brand-400 text-[10px] font-bold tabular-nums">
              {index + 1}/{size}
            </span>
            {step.title && (
              <h3 className="text-sm font-semibold text-white leading-snug">
                {step.title}
              </h3>
            )}
          </div>
          <button
            {...skipProps}
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          {step.content as string}
        </p>

        {/* Progress dots + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: size }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-4 h-1.5 bg-brand-500"
                    : i < index
                    ? "w-1.5 h-1.5 bg-brand-700"
                    : "w-1.5 h-1.5 bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className="min-h-[36px] px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Atrás
              </button>
            )}
            <button
              {...primaryProps}
              className="min-h-[36px] px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors shadow-sm shadow-brand-900/40"
            >
              {isLastStep ? "Finalizar" : "Siguiente"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
