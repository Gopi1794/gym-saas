"use client"

import Link from "next/link"
import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"]

const LEVEL_CONFIG: Record<string, { label: string; image: string; badge: string }> = {
  beginner: {
    label: "Principiante",
    image: "/plan-entrenamiento-principiantes.jpg",
    badge: "bg-emerald-500/80 text-white backdrop-blur-sm",
  },
  intermediate: {
    label: "Intermedio",
    image: "/entrenamiento para intermedio.avif",
    badge: "bg-amber-500/80 text-white backdrop-blur-sm",
  },
  advanced: {
    label: "Avanzado",
    image: "/plan-entrenamiento-principiantes.jpg",
    badge: "bg-red-600/80 text-white backdrop-blur-sm",
  },
}

type PlanDay = {
  id: string
  day_of_week: number
  workout_plan_exercises: { id: string }[]
}

type Member = { id: string; full_name: string | null }

type Plan = {
  id: string
  name: string
  description: string | null
  created_at: string
  assigned_to: string | null
  level?: string | null
  workout_plan_days: PlanDay[]
}

interface PlanCardProps {
  plan: Plan
  isTemplate: boolean
  trainerId: string
  readOnly?: boolean
  members?: Member[]
}

export default function PlanCard({ plan, isTemplate, trainerId, readOnly = false, members = [] }: PlanCardProps) {
  const days = plan.workout_plan_days ?? []
  const activeDays = new Set(days.map((d) => d.day_of_week))
  const total = days.reduce((sum, d) => sum + d.workout_plan_exercises.length, 0)
  const activeDayCount = activeDays.size
  const assignedMember = members.find((m) => m.id === plan.assigned_to)
  const level = plan.level && LEVEL_CONFIG[plan.level] ? LEVEL_CONFIG[plan.level] : null

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-md flex flex-col transition-all hover:border-zinc-300 dark:hover:border-white/20 shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="relative flex items-center gap-3 p-5 bg-brand-700">
        <div className="relative z-10 flex items-center gap-3 w-full">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Dumbbell className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            {level && (
              <span className={cn("mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", level.badge)}>
                {level.label}
              </span>
            )}
            <h3 className="text-base font-bold uppercase leading-tight tracking-wide text-white truncate">
              {plan.name}
            </h3>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5 gap-4">
        {plan.description && (
          <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
        )}

        {/* Day pills */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Días activos</p>
          <div className="flex gap-1.5">
            {DAY_SHORT.map((label, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                  activeDays.has(i)
                    ? "bg-brand-700/20 dark:bg-brand-700/30 text-brand-600 dark:text-brand-400 ring-1 ring-brand-700/40"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {activeDayCount} día{activeDayCount !== 1 ? "s" : ""} · {total} ejercicio{total !== 1 ? "s" : ""}
          </p>
          {assignedMember && (
            <span className="text-xs font-medium text-brand-500 truncate max-w-[120px]">
              👤 {assignedMember.full_name ?? "Miembro"}
            </span>
          )}
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div className="mt-auto">
          {isTemplate ? (
            <Link
              href={`/planes/${plan.id}`}
              className="block w-full rounded-xl bg-brand-700 py-3 text-center text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-800"
            >
              Editar plantilla
            </Link>
          ) : readOnly ? (
            <Link
              href={`/planes/${plan.id}`}
              className="block w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 py-3 text-center text-sm font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Ver plan
            </Link>
          ) : (
            <Link
              href={`/planes/${plan.id}`}
              className="block w-full rounded-xl bg-brand-700 py-3 text-center text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-800"
            >
              Editar plan
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
