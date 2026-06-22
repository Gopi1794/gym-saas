"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Dumbbell,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Play,
  BarChart3,
  ScanLine,
} from "lucide-react";
import MachineScanner from "@/components/machines/MachineScanner";
import { cn } from "@/lib/utils";
import WorkoutSession from "./WorkoutSession";

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

type Exercise = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  muscle_groups: string[];
};

type SetConfig = {
  id: string;
  set_number: number;
  reps: number | null;
  reps_max: number | null;
  percent_1rm: number | null;
  duration_seconds: number | null;
  notes: string | null;
};

type PlanExercise = {
  id: string;
  sets: number;
  reps: number;
  reps_max: number | null;
  rest_seconds: number;
  order_index: number;
  notes: string | null;
  duration_seconds: number | null;
  phase: "warmup" | "main" | "cooldown";
  set_configs: SetConfig[];
  exercises: Exercise;
};

type DayData = {
  id: string;
  day_of_week: number;
  name: string | null;
  workout_plan_exercises: PlanExercise[];
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
};

export type WorkoutSessionRecord = {
  id: string;
  day_name: string;
  day_of_week: number;
  exercises_count: number;
  completed_at: string;
};

interface Props {
  plan: Plan;
  days: DayData[];
  userId: string;
  gymId: string;
  recentSessions: WorkoutSessionRecord[];
  gender?: string | null;
  weightKg?: number | null;
  exerciseMaxes?: Record<string, number>;
}

const MUSCLE_COLORS = [
  "bg-brand-500",
  "bg-blue-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
];

function getMuscleGroups(exercises: PlanExercise[]): string[] {
  const counts = new Map<string, number>();
  for (const pe of exercises) {
    for (const m of pe.exercises.muscle_groups ?? []) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
    .slice(0, 4);
}

function VolumeBar({ exercises }: { exercises: PlanExercise[] }) {
  const counts = new Map<string, number>();
  for (const pe of exercises) {
    for (const m of pe.exercises.muscle_groups ?? []) {
      counts.set(m, (counts.get(m) ?? 0) + pe.sets);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="flex items-end gap-1 h-10">
      {top.map(([, count], i) => (
        <div
          key={i}
          style={{
            height: `${Math.max(20, Math.round((count / total) * 100))}%`,
          }}
          className="w-1.5 rounded-full bg-white/40"
        />
      ))}
    </div>
  );
}

function DayDetail({
  day,
  onBack,
  onStart,
  gender,
}: {
  day: DayData;
  onBack: () => void;
  onStart: () => void;
  gender?: string | null;
}) {
  const exercises = [...day.workout_plan_exercises].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const muscles = getMuscleGroups(exercises);
  const estimatedMin = Math.max(
    1,
    Math.round(
      exercises.reduce((acc, pe) => {
        const workTime = pe.duration_seconds != null
          ? pe.sets * pe.duration_seconds
          : pe.sets * pe.reps * 3;
        return acc + (workTime + pe.sets * pe.rest_seconds) / 60;
      }, 0),
    ),
  );
  const heroImage =
    gender === "female"
      ? "/card-mujer/card_mujer.png"
      : "/card-hombre/card_hombre.png";

  return (
    <div className="space-y-5 pb-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-brand-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Hero card */}
      <div className="relative" style={{ paddingTop: 36 }}>
        {/* Card */}
        <div
          className="relative z-0 overflow-hidden rounded-2xl bg-brand-800"
          style={{ minHeight: 140 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/90 to-transparent" />
          <div className="relative z-10 flex h-full min-h-[140px] p-5">
            <div className="flex flex-col justify-between max-w-[55%]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {DAY_NAMES[day.day_of_week]}
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">
                  {exercises.length} ejercicio
                  {exercises.length !== 1 ? "s" : ""}
                </h2>
                <p className="mt-0.5 text-xs text-brand-400">
                  ~{estimatedMin} min
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Image â€” z-10, overlays card */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-[62%] z-10"
          style={{ height: "calc(100% + 8px)" }}
        >
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-contain object-bottom"
          />
        </div>
        {/* Exercise dots â€” z-20, visible above image */}
        <div
          className="pointer-events-none absolute right-6 z-20 flex flex-col justify-center gap-2"
          style={{ top: 36, bottom: 0 }}
        >
          {exercises.slice(0, 8).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-white/40 shadow-sm"
            />
          ))}
        </div>
      </div>

      {/* Muscle group pills */}
      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {muscles.map((m, i) => (
            <div
              key={m}
              className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  MUSCLE_COLORS[i % MUSCLE_COLORS.length],
                )}
              />
              <span className="text-xs text-zinc-300 capitalize">{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* Exercise list — card grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {exercises.map((pe, index) => (
          <div
            key={pe.id}
            className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-brand-700/50"
          >
            {/* Number badge */}
            <span className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white shadow-lg">
              {index + 1}
            </span>

            {/* Image */}
            <div className="h-20 w-full bg-zinc-800">
              {pe.exercises.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pe.exercises.image_url}
                  alt={pe.exercises.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Dumbbell className="h-8 w-8 text-zinc-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-3 pt-2">
              <p className="font-heading text-sm uppercase tracking-wide text-zinc-100 leading-tight line-clamp-2">
                {pe.exercises.name}
              </p>

              {/* Stats */}
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100">
                    {pe.sets}
                  </span>
                  <span className="text-[10px] text-zinc-500">series</span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100">
                    {pe.duration_seconds != null
                      ? `${pe.duration_seconds}s`
                      : pe.reps_max != null
                        ? `${pe.reps}–${pe.reps_max}`
                        : pe.reps}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {pe.duration_seconds != null ? "tiempo" : "reps"}
                  </span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100">
                    {pe.rest_seconds}s
                  </span>
                  <span className="text-[10px] text-zinc-500">descanso</span>
                </div>
              </div>
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
  );
}

type ActiveWorkout = {
  exercises: PlanExercise[];
  dayName: string;
  dayOfWeek: number;
};

const STORAGE_KEY = "voltia_active_workout"

export default function MemberWorkoutView({
  plan,
  days,
  userId,
  gymId,
  recentSessions,
  gender,
  weightKg,
  exerciseMaxes,
}: Props) {
  const router = useRouter();
  const [selectedDow, setSelectedDow] = useState<number | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [showMachineScanner, setShowMachineScanner] = useState(false);

  // Restore workout state if browser tab was killed (e.g. user switched to WhatsApp)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const { dayOfWeek, dayName } = JSON.parse(saved) as { dayOfWeek: number; dayName: string }
      const day = days.find(d => d.day_of_week === dayOfWeek)
      if (!day) return
      const sorted = [...day.workout_plan_exercises].sort((a, b) => a.order_index - b.order_index)
      setActiveWorkout({ exercises: sorted, dayName, dayOfWeek })
    } catch { /* ignore */ }
  }, [days])

  const todayDow = (new Date().getDay() + 6) % 7;

  const activeDays = days
    .filter((d) => d.workout_plan_exercises.length > 0)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  if (activeWorkout) {
    return (
      <WorkoutSession
        exercises={activeWorkout.exercises}
        dayName={activeWorkout.dayName}
        dayOfWeek={activeWorkout.dayOfWeek}
        userId={userId}
        planId={plan.id}
        userWeightKg={weightKg}
        exerciseMaxes={exerciseMaxes}
        onClose={() => {
          sessionStorage.removeItem(STORAGE_KEY)
          setActiveWorkout(null);
          setSelectedDow(null);
          router.refresh();
        }}
      />
    );
  }

  if (selectedDow !== null) {
    const day = days.find((d) => d.day_of_week === selectedDow);
    if (day) {
      const sorted = [...day.workout_plan_exercises].sort(
        (a, b) => a.order_index - b.order_index,
      );
      return (
        <DayDetail
          day={day}
          gender={gender}
          onBack={() => setSelectedDow(null)}
          onStart={() => {
            const workout = { exercises: sorted, dayName: DAY_NAMES[day.day_of_week], dayOfWeek: day.day_of_week }
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dayOfWeek: workout.dayOfWeek, dayName: workout.dayName }))
            setActiveWorkout(workout)
          }}
        />
      );
    }
  }

  const todayIsActive = activeDays.some((d) => d.day_of_week === todayDow);
  const otherDays = activeDays.filter((d) => d.day_of_week !== todayDow);
  const featuredDay =
    activeDays.find((d) => d.day_of_week === todayDow) ?? activeDays[0];
  const featuredExercises = featuredDay?.workout_plan_exercises ?? [];
  const featuredMuscles = featuredDay ? getMuscleGroups(featuredExercises) : [];
  const completedCount = recentSessions.length;
  const progress = activeDays.length
    ? Math.min(100, Math.round((completedCount / activeDays.length) * 100))
    : 0;

  const todayDay = days.find((d) => d.day_of_week === todayDow);

  return (
    <div className="space-y-6 pb-6">
      {showMachineScanner && (
        <MachineScanner
          userId={userId}
          planId={plan.id}
          hasWorkoutToday={todayIsActive}
          onStartExercise={(exerciseId) => {
            if (todayDay) {
              const sorted = [...todayDay.workout_plan_exercises].sort((a, b) => a.order_index - b.order_index)
              const workout = { exercises: sorted, dayName: DAY_NAMES[todayDow], dayOfWeek: todayDow }
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dayOfWeek: workout.dayOfWeek, dayName: workout.dayName }))
              setActiveWorkout(workout)
            }
          }}
          onClose={() => { setShowMachineScanner(false); router.refresh() }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Plan semanal</h1>
          {plan.description && (
            <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowMachineScanner(true)}
          className="flex items-center gap-2 rounded-xl border border-brand-600/40 bg-brand-950/20 px-3 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-950/40"
        >
          <ScanLine className="h-4 w-4" />
          Escanear máquina
        </button>
      </div>

      {featuredDay && (
        <button
          onClick={() => setSelectedDow(featuredDay.day_of_week)}
          className="group relative min-h-[150px] w-full overflow-hidden rounded-2xl border border-red-500/25 bg-[#120101] p-5 text-left shadow-2xl shadow-black/40 transition-transform active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#e00000] via-[#a80000] to-[#280101]" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[clamp(8rem,38vw,18rem)] font-black leading-none tracking-[-0.08em] text-white/10">
            HOY
          </div>
          <div className="pointer-events-none absolute -bottom-3 right-6 h-[178px] w-[150px]">
            <Image
              src="/ejerciciosdeldia.png"
              alt=""
              fill
              priority
              className="object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]"
            />
          </div>
          <div className="absolute bottom-5 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-red-500 backdrop-blur-md transition-transform group-active:scale-95">
            <Play className="ml-0.5 h-5 w-5 fill-red-500" />
          </div>

          <div className="relative z-10 max-w-[58%] [text-shadow:_0_2px_14px_rgb(0_0_0_/_0.65)]">
            <span className="text-xs font-bold uppercase tracking-widest !text-white">
              Hoy
            </span>
            <h2 className="mt-2 font-heading text-3xl font-normal uppercase leading-none tracking-wide !text-white">
              {DAY_NAMES[featuredDay.day_of_week]}
            </h2>
            <p className="mt-1 text-sm !text-white">
              {featuredExercises.length} ejercicio
              {featuredExercises.length !== 1 ? "s" : ""}
            </p>
            {featuredMuscles.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {featuredMuscles.slice(0, 2).map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white/15 px-3 py-1 text-xs capitalize !text-white backdrop-blur-sm"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      )}

      {otherDays.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Plan semanal
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {otherDays.map((day, index) => {
              const muscles = getMuscleGroups(day.workout_plan_exercises);
              const label =
                muscles.length > 0
                  ? muscles.slice(0, 2).join(", ")
                  : `${day.workout_plan_exercises.length} ejercicios`;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDow(day.day_of_week)}
                  className={cn(
                    "relative rounded-2xl border bg-zinc-950/80 p-4 text-left transition-all active:scale-[0.98]",
                    index === 0
                      ? "border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]"
                      : "border-white/8 hover:border-red-500/30",
                  )}
                >
                  <CalendarDays className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                  <p className="font-heading text-base uppercase tracking-wide text-zinc-100">
                    {DAY_NAMES[day.day_of_week]}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs capitalize text-zinc-500">
                    {label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!todayIsActive && activeDays.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Dumbbell className="h-5 w-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">
            Tu trainer todavía no cargó ejercicios en tu plan
          </p>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Historial reciente
          </p>
          {recentSessions.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-brand-700/15 px-2.5 py-0.5 text-xs font-semibold text-brand-500">
              <CalendarCheck className="h-3 w-3" />
              {recentSessions.length} completado
              {recentSessions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {recentSessions.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Todavía no completaste ningún entrenamiento.
          </p>
        ) : (
          <div className="space-y-2">
            {recentSessions.slice(0, 3).map((s) => {
              const date = new Date(s.completed_at);
              const label = date.toLocaleDateString("es-AR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-900/50 px-4 py-3 dark:border-white/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700/15">
                    <CalendarCheck className="h-4 w-4 text-brand-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize text-zinc-200">
                      {s.day_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {s.exercises_count} ejercicio
                      {s.exercises_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs capitalize text-zinc-600">
                    {label}
                  </p>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-900/50 p-5 dark:border-white/5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700/20">
            <BarChart3 className="h-6 w-6 text-brand-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-100">¡Vas excelente!</p>
            <p className="text-xs text-zinc-500">
              Llevás{" "}
              <span className="text-brand-500">
                {completedCount} entrenamiento{completedCount !== 1 ? "s" : ""}
              </span>{" "}
              completado{completedCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-sm font-bold text-zinc-100"
            style={{
              background: `conic-gradient(#ef4444 ${progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
            }}
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-zinc-950">
              {progress}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
