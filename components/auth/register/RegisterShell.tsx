"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Dumbbell, ChevronLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { variants } from "./shared"
import { Alert } from "@/components/ui/alert"

interface Step {
  icon: LucideIcon
  title: string
  subtitle: string
}

interface Props {
  steps: Step[]
  step: number
  dir: number
  loading: boolean
  serverError: string | null
  isLast: boolean
  submitLabel: string
  loadingLabel: string
  onContinue: () => void
  onBack: () => void
  gymBanner?: { gymCode: string; gymName: string | null }
  children: React.ReactNode
}

export default function RegisterShell({
  steps, step, dir, loading, serverError, isLast,
  submitLabel, loadingLabel, onContinue, onBack, gymBanner, children,
}: Props) {
  const StepIcon = steps[step].icon

  return (
    <div className="w-full max-w-md">
      {gymBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-700/30 bg-brand-50/80 px-4 py-3 dark:bg-brand-950/40">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-700/20">
            <Dumbbell className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Invitación al gym
            </p>
            <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {gymBanner.gymName ?? "Gimnasio privado"}
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-xs tracking-widest text-zinc-500">
            PASO {step + 1} DE {steps.length}
          </p>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i <= step
                    ? "w-6 bg-brand-500 shadow-[0_0_6px_rgba(213,0,0,0.7)]"
                    : "w-4 bg-zinc-300 dark:bg-zinc-700",
                )}
              />
            ))}
          </div>
        </div>
        <div className="h-px w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-brand-600"
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-600/40 bg-brand-50 dark:border-brand-700/40 dark:bg-brand-950/60">
          <StepIcon className="h-5 w-5 text-brand-600 dark:text-brand-500" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-zinc-900 dark:text-zinc-50">{steps[step].title}</h1>
          <p className="text-sm text-zinc-500">{steps[step].subtitle}</p>
        </div>
      </div>

      {/* Animated step content */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {serverError && (
        <div className="mt-4">
          <Alert variant="error">{serverError}</Alert>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(213,0,0,0.3)] transition-all active:scale-[0.97] disabled:opacity-60"
          style={{ transition: "transform 150ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}</>
            : submitLabel}
        </button>

        {step > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </button>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
            Cancelar
          </Link>
        )}
      </div>

      {step === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500 dark:hover:text-brand-400">
            Iniciá sesión
          </Link>
        </p>
      )}
    </div>
  )
}
