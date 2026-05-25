"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Clock, Dumbbell, CalendarCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import WorkoutSession from "./WorkoutSession"

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

type Exercise = {
  id: string
  name: string
  category: string
  difficulty: string
  image_url: string | null
  muscle_groups: string[]
}

type PlanExercise = {
  id: string
  sets: number
  reps: number
  rest_seconds: number
  order_index: number
  notes: string | null
  exercises: Exercise
}

type DayData = {
  id: string
  day_of_week: number
  name: string | null
  workout_plan_exercises: PlanExercise[]
}

type Plan = {
  id: string
  name: string
  description: string | null
}

export type WorkoutSessionRecord = {
  id: string
  day_name: string
  day_of_week: number
  exercises_count: number
  completed_at: string
}

interface Props {
  plan: Plan
  days: DayData[]
  userId: string
  recentSessions: WorkoutSessionRecord[]
  gender?: string | null
}

const MUSCLE_COLORS = [
  "bg-brand-500",
  "bg-blue-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
]

function getMuscleGroups(exercises: PlanExercise[]): string[] {
  const counts = new Map<string, number>()
  for (const pe of exercises) {
    for (const m of pe.exercises.muscle_groups ?? []) {
      counts.set(m, (counts.get(m) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
    .slice(0, 4)
}

function VolumeBar({ exercises }: { exercises: PlanExercise[] }) {
  const counts = new Map<string, number>()
  for (const pe of exercises) {
    for (const m of pe.exercises.muscle_groups ?? []) {
      counts.set(m, (counts.get(m) ?? 0) + pe.sets)
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="flex items-end gap-1 h-10">
      {top.map(([, count], i) => (
        <div
          key={i}
          style={{ height: `${Math.max(20, Math.round((count / total) * 100))}%` }}
          className="w-1.5 rounded-full bg-white/40"
        />
      ))}
    </div>
  )
}

function DayDetail({ day, onBack, onStart, gender }: { day: DayData; onBack: () => void; onStart: () => void; gender?: string | null }) {
  const exercises = [...day.workout_plan_exercises].sort((a, b) => a.order_index - b.order_index)
  const muscles = getMuscleGroups(exercises)
  const estimatedMin = Math.max(
    1,
    Math.round(exercises.reduce((acc, pe) => acc + (pe.sets * pe.reps * 3 + pe.sets * pe.rest_seconds) / 60, 0))
  )
  const heroImage = gender === "female" ? "/card-mujer/card_mujer.png" : "/card-hombre/card_hombre.png"

  return (
    <div className="space-y-5 pb-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Hero card */}
      <div className="relative" style={{ paddingTop: 36 }}>
        {/* Card */}
        <div className="relative z-0 overflow-hidden rounded-2xl bg-brand-800" style={{ minHeight: 140 }}>
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/90 to-transparent" />
          <div className="relative z-10 flex h-full min-h-[140px] p-5">
            <div className="flex flex-col justify-between max-w-[55%]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {DAY_NAMES[day.day_of_week]}
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">
                  {exercises.length} ejercicio{exercises.length !== 1 ? "s" : ""}
                </h2>
                <p className="mt-0.5 text-xs text-brand-400">~{estimatedMin} min</p>
              </div>
            </div>
          </div>
        </div>
        {/* Image — z-10, overlays card */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-[62%] z-10"
          style={{ height: "calc(100% + 8px)" }}
        >
          <Image src={heroImage} alt="" fill priority className="object-contain object-bottom" />
        </div>
        {/* Exercise dots — z-20, visible above image */}
        <div
          className="pointer-events-none absolute right-6 z-20 flex flex-col justify-center gap-2"
          style={{ top: 36, bottom: 0 }}
        >
          {exercises.slice(0, 8).map((_, i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-white/40 shadow-sm" />
          ))}
        </div>
      </div>

      {/* Muscle group pills */}
      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {muscles.map((m, i) => (
            <div key={m} className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1">
              <span className={cn("h-2 w-2 rounded-full shrink-0", MUSCLE_COLORS[i % MUSCLE_COLORS.length])} />
              <span className="text-xs text-zinc-300 capitalize">{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* Exercise list */}
      <div className="rounded-2xl border border-white/8 bg-zinc-900/50 overflow-hidden">
        {exercises.map((pe, index) => (
          <div
            key={pe.id}
            className={cn(
              "flex items-center gap-4 p-4",
              index !== exercises.length - 1 && "border-b border-white/5"
            )}
          >
            <div className="relative shrink-0">
              {pe.exercises.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pe.exercises.image_url}
                  alt={pe.exercises.name}
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800">
                  <Dumbbell className="h-5 w-5 text-zinc-500" />
                </div>
              )}
              <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                {index + 1}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-100 capitalize truncate">{pe.exercises.name}</p>
              <p className="text-sm text-zinc-500">
                {pe.sets} series × {pe.reps} reps
              </p>
            </div>

            <div className="flex items-center gap-1 text-zinc-500 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">{pe.rest_seconds}s</span>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="w-full rounded-full border border-brand-700/40 bg-brand-700/10 py-4 text-sm font-semibold text-brand-500 transition-all hover:bg-brand-700/20 hover:text-brand-400 active:scale-[0.98]"
      >
        Empezar entrenamiento
      </button>
    </div>
  )
}

type ActiveWorkout = { exercises: PlanExercise[]; dayName: string; dayOfWeek: number }

export default function MemberWorkoutView({ plan, days, userId, recentSessions, gender }: Props) {
  const router = useRouter()
  const [selectedDow, setSelectedDow] = useState<number | null>(null)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)

  const todayDow = (new Date().getDay() + 6) % 7

  const activeDays = days
    .filter((d) => d.workout_plan_exercises.length > 0)
    .sort((a, b) => a.day_of_week - b.day_of_week)

  if (activeWorkout) {
    return (
      <WorkoutSession
        exercises={activeWorkout.exercises}
        dayName={activeWorkout.dayName}
        dayOfWeek={activeWorkout.dayOfWeek}
        userId={userId}
        planId={plan.id}
        onClose={() => {
          setActiveWorkout(null)
          setSelectedDow(null)
          router.refresh()
        }}
      />
    )
  }

  if (selectedDow !== null) {
    const day = days.find((d) => d.day_of_week === selectedDow)
    if (day) {
      const sorted = [...day.workout_plan_exercises].sort((a, b) => a.order_index - b.order_index)
      return (
        <DayDetail
          day={day}
          gender={gender}
          onBack={() => setSelectedDow(null)}
          onStart={() => setActiveWorkout({ exercises: sorted, dayName: DAY_NAMES[day.day_of_week], dayOfWeek: day.day_of_week })}
        />
      )
    }
  }

  const todayIsActive = activeDays.some((d) => d.day_of_week === todayDow)
  const otherDays = activeDays.filter((d) => d.day_of_week !== todayDow)

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">{plan.name}</h1>
        {plan.description && (
          <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
        )}
      </div>

      {/* Today card */}
      {todayIsActive && (() => {
        const today = activeDays.find((d) => d.day_of_week === todayDow)!
        const muscles = getMuscleGroups(today.workout_plan_exercises)
        return (
          <button
            onClick={() => setSelectedDow(todayDow)}
            className="w-full rounded-2xl bg-brand-700 p-5 text-left transition-all hover:bg-brand-700 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-brand-300">
                  Hoy
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">
                  {DAY_NAMES[todayDow]}
                </h2>
                <p className="mt-0.5 text-sm text-brand-300">
                  {today.workout_plan_exercises.length} ejercicio{today.workout_plan_exercises.length !== 1 ? "s" : ""}
                </p>
              </div>
              <VolumeBar exercises={today.workout_plan_exercises} />
            </div>
            {muscles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {muscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs capitalize text-white"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </button>
        )
      })()}

      {/* Weekly grid */}
      {otherDays.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Plan semanal
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {otherDays.map((day) => {
              const muscles = getMuscleGroups(day.workout_plan_exercises)
              const label = muscles.length > 0
                ? muscles.slice(0, 2).join(", ")
                : `${day.workout_plan_exercises.length} ejercicios`
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDow(day.day_of_week)}
                  className="rounded-2xl border border-white/8 bg-zinc-900 p-4 text-left transition-all hover:border-brand-700/30 hover:bg-zinc-800 active:scale-[0.98]"
                >
                  <p className="font-semibold text-zinc-100">{DAY_NAMES[day.day_of_week]}</p>
                  <p className="mt-0.5 text-xs capitalize text-zinc-500 line-clamp-1">{label}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Fallback: no active day today and no grid */}
      {!todayIsActive && activeDays.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Dumbbell className="h-5 w-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">Tu trainer todavía no cargó ejercicios en tu plan</p>
        </div>
      )}

      {/* History */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Historial reciente
          </p>
          {recentSessions.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-brand-700/15 px-2.5 py-0.5 text-xs font-semibold text-brand-500">
              <CalendarCheck className="h-3 w-3" />
              {recentSessions.length} completado{recentSessions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {recentSessions.length === 0 ? (
          <p className="text-sm text-zinc-600">Todavía no completaste ningún entrenamiento.</p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const date = new Date(s.completed_at)
              const label = date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-900/50 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700/15">
                    <CalendarCheck className="h-4 w-4 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize text-zinc-200">{s.day_name}</p>
                    <p className="text-xs text-zinc-500">
                      {s.exercises_count} ejercicio{s.exercises_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs capitalize text-zinc-600">{label}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
