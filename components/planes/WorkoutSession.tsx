"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronRight,
  Dumbbell,
  SkipForward,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { completeWorkoutSession } from "@/app/actions/workout-sessions";
import type { CompleteSessionResult, SessionSet } from "@/lib/achievements/types";
import WorkoutResults from "@/components/planes/WorkoutResults";
import RestTimerKnob from "@/components/ui/rest-timer-knob";
import LottiePlayer from "@/components/ui/lottie-player";

type Exercise = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  muscle_groups: string[];
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
  exercises: Exercise;
};

type Phase = "exercising" | "resting" | "finished";

interface Props {
  exercises: PlanExercise[];
  dayName: string;
  dayOfWeek: number;
  userId: string;
  planId: string;
  userWeightKg?: number | null;
  onClose: () => void;
}

function calcCalories(
  durationSeconds: number,
  weightKg: number,
  speedKmh?: number,
  resistanceLevel?: number,
): number {
  let met = 5;
  if (speedKmh && speedKmh > 0) {
    if (speedKmh < 5) met = 3.5;
    else if (speedKmh < 7) met = 5;
    else if (speedKmh < 10) met = 8;
    else met = 11;
  } else if (resistanceLevel && resistanceLevel > 0) {
    met = 4 + resistanceLevel * 0.3;
  }
  return Math.round(met * weightKg * (durationSeconds / 3600));
}

/* ── Finished screen (error fallback) ── */
function WorkoutFinished({
  dayName,
  total,
  onClose,
}: {
  dayName: string;
  total: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-6 text-center">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-brand-700/20 blur-[100px]" />

      <LottiePlayer
        src="/animations/success.lottie"
        style={{ width: 160, height: 160 }}
      />

      <div>
        <p className="font-heading text-xs tracking-widest text-brand-500">
          Completado
        </p>
        <h1 className="mt-2 font-display text-4xl text-zinc-50">¡Excelente!</h1>
        <p className="mt-2 text-zinc-400">
          Terminaste el entrenamiento de{" "}
          <span className="font-semibold text-zinc-200">{dayName}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {total} ejercicio{total !== 1 ? "s" : ""} completado
          {total !== 1 ? "s" : ""}
        </p>
      </div>

      <button
        onClick={onClose}
        className="rounded-full bg-brand-700 px-12 py-4 text-sm font-bold text-white shadow-lg shadow-brand-700/40 transition-all hover:bg-brand-700 active:scale-[0.97]"
        style={{ transition: "transform 150ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        Volver a mi rutina
      </button>
    </div>
  );
}

/* ── Main component ── */
export default function WorkoutSession({
  exercises,
  dayName,
  dayOfWeek,
  planId,
  userWeightKg,
  onClose,
}: Props) {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<Phase>("exercising");
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [restSkips, setRestSkips] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [sessionResult, setSessionResult] =
    useState<CompleteSessionResult | null>(null);

  // Per-set tracking
  const [collectedSets, setCollectedSets] = useState<SessionSet[]>([]);
  const [currentWeight, setCurrentWeight] = useState("");
  const [cardioElapsed, setCardioElapsed] = useState(0);
  const [currentDistance, setCurrentDistance] = useState("");
  const [currentSpeed, setCurrentSpeed] = useState("");
  const [currentResistance, setCurrentResistance] = useState("");

  const savedRef = useRef(false);

  const current = exercises[exerciseIdx];
  const isLastSet = currentSet === current.sets;
  const isLastExercise = exerciseIdx === exercises.length - 1;
  const category = current.exercises.category;
  const isStrengthLike = category === "strength" || category === "hiit";
  const isCardio = category === "cardio";
  const isDuration = current.duration_seconds != null;

  const [durationLeft, setDurationLeft] = useState<number>(current.duration_seconds ?? 0);

  // Reset duration countdown when exercise/set changes
  useEffect(() => {
    setDurationLeft(current.duration_seconds ?? 0);
  }, [exerciseIdx, currentSet, current.duration_seconds]);

  // Duration countdown timer
  useEffect(() => {
    if (phase !== "exercising" || !isDuration) return;
    if (durationLeft <= 0) return;
    const t = setInterval(() => setDurationLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, isDuration, durationLeft]);

  // Cardio elapsed timer — counts up while exercising
  useEffect(() => {
    if (phase !== "exercising" || !isCardio || isDuration) return;
    const t = setInterval(() => setCardioElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase, isCardio, isDuration, exerciseIdx, currentSet]);

  // Complete session exactly once when workout is finished
  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    async function finish() {
      setCompleting(true);
      const result = await completeWorkoutSession({
        plan_id: planId,
        day_of_week: dayOfWeek,
        day_name: dayName,
        exercises_count: exercises.length,
        rest_skips: restSkips,
        sets: collectedSets,
      });
      setSessionResult(result);
      setCompleting(false);
    }

    finish();
  }, [phase, planId, dayOfWeek, dayName, exercises.length, restSkips, collectedSets]);

  // Rest countdown
  useEffect(() => {
    if (phase !== "resting") return;
    if (restLeft <= 0) {
      if (isLastSet) {
        if (isLastExercise) {
          setPhase("finished");
        } else {
          setExerciseIdx((i) => i + 1);
          setCurrentSet(1);
          setPhase("exercising");
        }
      } else {
        setCurrentSet((s) => s + 1);
        setPhase("exercising");
      }
      return;
    }
    const t = setTimeout(() => setRestLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, restLeft, isLastSet, isLastExercise]);

  function handleSetDone() {
    const durationSecs = isDuration ? current.duration_seconds! : isCardio ? cardioElapsed : undefined;
    const distanceM = currentDistance !== "" ? Math.round(parseFloat(currentDistance) * 1000) : undefined;
    const speedKmh = currentSpeed !== "" ? parseFloat(currentSpeed) : undefined;
    const resistance = currentResistance !== "" ? parseInt(currentResistance, 10) : undefined;

    const calories =
      isCardio && durationSecs && userWeightKg
        ? calcCalories(durationSecs, userWeightKg, speedKmh, resistance)
        : undefined;

    const setData: SessionSet = {
      exercise_id: current.exercises.id,
      exercise_name: current.exercises.name,
      category: current.exercises.category,
      set_number: currentSet,
      reps: !isCardio && !isDuration ? current.reps : undefined,
      weight_kg:
        isStrengthLike && !isDuration && currentWeight !== ""
          ? parseFloat(currentWeight)
          : undefined,
      duration_seconds: durationSecs,
      distance_meters: distanceM,
      speed_kmh: speedKmh,
      resistance_level: resistance,
      calories_burned: calories,
    };
    setCollectedSets((prev) => [...prev, setData]);
    setCurrentWeight("");
    setCurrentDistance("");
    setCurrentSpeed("");
    setCurrentResistance("");
    setCardioElapsed(0);

    if (isLastSet && isLastExercise) {
      setPhase("finished");
      return;
    }
    const rest = current.rest_seconds;
    setRestTotal(rest);
    setRestLeft(rest);
    setPhase("resting");
  }

  // ── Finished sub-states ──
  if (phase === "finished") {
    if (completing || !sessionResult) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-hidden bg-zinc-950 px-6 text-center">
          <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-brand-700/20 blur-[100px]" />
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-brand-500" />
          <p className="text-sm font-medium text-zinc-400">
            Calculando logros...
          </p>
        </div>
      );
    }

    if (sessionResult.ok === true) {
      const totalCalories = collectedSets.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0);
      return <WorkoutResults result={sessionResult} totalCalories={totalCalories || undefined} onClose={onClose} />;
    }

    return (
      <WorkoutFinished
        dayName={dayName}
        total={exercises.length}
        onClose={onClose}
      />
    );
  }

  /* ── Resting view ── */
  if (phase === "resting") {
    const nextLabel = isLastSet
      ? exercises[exerciseIdx + 1]?.exercises.name
      : `${current.exercises.name} — serie ${currentSet + 1}`;

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-6">
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-brand-700/15 blur-[100px]" />

        <p className="font-heading text-sm tracking-widest text-zinc-500">
          Descansando
        </p>

        <RestTimerKnob total={restTotal} left={restLeft} />

        <div className="rounded-2xl border border-white/8 bg-white/5 px-6 py-3 text-center backdrop-blur-md">
          <p className="text-xs text-zinc-500">A continuación</p>
          <p className="mt-0.5 text-sm font-semibold capitalize text-zinc-200">
            {nextLabel}
          </p>
        </div>

        <button
          onClick={() => {
            setRestSkips((n) => n + 1);
            setRestLeft(0);
          }}
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-7 py-3 text-sm font-semibold text-zinc-400 transition-all hover:border-zinc-600 hover:text-zinc-200 active:scale-[0.97] backdrop-blur-md"
        >
          <SkipForward className="h-4 w-4" />
          Saltar descanso
        </button>
      </div>
    );
  }

  /* ── Exercising view ── */
  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
  const doneSets =
    exercises.slice(0, exerciseIdx).reduce((s, e) => s + e.sets, 0) +
    (currentSet - 1);
  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  const cardioMins = Math.floor(cardioElapsed / 60)
    .toString()
    .padStart(2, "0");
  const cardioSecs = (cardioElapsed % 60).toString().padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-zinc-950">
      {/* Ambient glow top */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-brand-700/15 blur-[80px]" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-3">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 backdrop-blur-md transition-colors hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {exercises.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i < exerciseIdx
                  ? "h-2 w-2 bg-emerald-500"
                  : i === exerciseIdx
                    ? "h-2.5 w-2.5 bg-white"
                    : "h-2 w-2 bg-zinc-700",
              )}
            />
          ))}
        </div>

        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mx-5 h-[3px] overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-brand-700 shadow-sm shadow-brand-700/50 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6 py-6 overflow-y-auto">
        {/* Exercise image */}
        <div className="relative">
          {current.exercises.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.exercises.image_url}
              alt={current.exercises.name}
              className="h-40 w-40 rounded-3xl object-cover"
              style={{
                boxShadow:
                  "0 0 60px rgba(213,0,0,0.25), 0 20px 40px rgba(0,0,0,0.6)",
              }}
            />
          ) : (
            <div
              className="flex h-40 w-40 items-center justify-center rounded-3xl border border-white/8 bg-white/5 backdrop-blur-md"
              style={{
                boxShadow:
                  "0 0 60px rgba(213,0,0,0.2), 0 20px 40px rgba(0,0,0,0.5)",
              }}
            >
              <Dumbbell className="h-16 w-16 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Name + muscles */}
        <div className="text-center">
          <h1 className="font-display text-2xl capitalize text-zinc-50">
            {current.exercises.name}
          </h1>
          {current.exercises.muscle_groups?.length > 0 && (
            <p className="mt-1 text-sm capitalize text-zinc-500">
              {current.exercises.muscle_groups.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>

        {/* Reps / cardio timer / duration countdown */}
        {isDuration ? (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-brand-500" />
              <span className="font-heading text-sm tracking-widest text-zinc-500">
                Cuenta regresiva
              </span>
            </div>
            <span
              className={cn(
                "font-display text-7xl tabular-nums leading-none",
                durationLeft <= 5 ? "text-brand-500" : "text-zinc-50"
              )}
              style={{ textShadow: "0 0 40px rgba(213,0,0,0.4)" }}
            >
              {String(Math.floor(durationLeft / 60)).padStart(2, "0")}:{String(durationLeft % 60).padStart(2, "0")}
            </span>
          </div>
        ) : isCardio ? (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-brand-500" />
              <span className="font-heading text-sm tracking-widest text-zinc-500">
                Tiempo
              </span>
            </div>
            <span
              className="font-display text-7xl tabular-nums text-zinc-50 leading-none"
              style={{ textShadow: "0 0 40px rgba(213,0,0,0.4)" }}
            >
              {cardioMins}:{cardioSecs}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <span
              className="font-display text-8xl tabular-nums text-zinc-50 leading-none"
              style={{ textShadow: "0 0 40px rgba(213,0,0,0.4)" }}
            >
              {current.reps_max != null ? `${current.reps}–${current.reps_max}` : current.reps}
            </span>
            <span className="font-heading text-2xl text-zinc-500 pb-1">
              reps
            </span>
          </div>
        )}

        {/* Cardio inputs — distance, speed, resistance */}
        {isCardio && (
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <label className="text-xs text-zinc-500 whitespace-nowrap">km</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                placeholder="—"
                value={currentDistance}
                onChange={(e) => setCurrentDistance(e.target.value)}
                className="w-16 bg-transparent text-right font-display text-xl text-zinc-50 placeholder-zinc-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <label className="text-xs text-zinc-500 whitespace-nowrap">km/h</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                placeholder="—"
                value={currentSpeed}
                onChange={(e) => setCurrentSpeed(e.target.value)}
                className="w-16 bg-transparent text-right font-display text-xl text-zinc-50 placeholder-zinc-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <label className="text-xs text-zinc-500 whitespace-nowrap">nivel</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                placeholder="—"
                value={currentResistance}
                onChange={(e) => setCurrentResistance(e.target.value)}
                className="w-12 bg-transparent text-right font-display text-xl text-zinc-50 placeholder-zinc-700 outline-none"
              />
            </div>
          </div>
        )}

        {/* Weight input — strength / hiit only */}
        {isStrengthLike && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-md">
            <label className="text-xs text-zinc-500 whitespace-nowrap">
              Peso (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="—"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              className="w-20 bg-transparent text-right font-display text-xl text-zinc-50 placeholder-zinc-700 outline-none"
            />
          </div>
        )}

        {/* Set dots */}
        <div className="flex items-center gap-2.5">
          {Array.from({ length: current.sets }).map((_, i) => {
            const done = i < currentSet - 1;
            const active = i === currentSet - 1;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  done
                    ? "h-2.5 w-2.5 bg-brand-700"
                    : active
                      ? "h-3.5 w-3.5 bg-brand-500"
                      : "h-2.5 w-2.5 bg-zinc-700",
                )}
                style={
                  active
                    ? { boxShadow: "0 0 10px rgba(213,0,0,0.8)" }
                    : undefined
                }
              />
            );
          })}
          <span className="ml-1 font-heading text-xs tracking-wider text-zinc-500">
            Serie {currentSet} de {current.sets}
          </span>
        </div>

        {/* Notes */}
        {current.notes && (
          <div className="rounded-2xl border border-white/8 bg-white/5 px-5 py-3 text-center backdrop-blur-md">
            <p className="text-sm text-zinc-400">{current.notes}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="relative z-10 px-5 pb-10 pt-2 space-y-3">
        <button
          onClick={handleSetDone}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-5 text-base font-bold text-white transition-all hover:bg-brand-700 active:scale-[0.97]"
          style={{
            boxShadow: "0 0 40px rgba(213,0,0,0.4), 0 8px 24px rgba(0,0,0,0.4)",
            transition:
              "transform 150ms cubic-bezier(0.16,1,0.3,1), background 200ms ease",
          }}
        >
          {isLastSet && isLastExercise
            ? "Terminar entrenamiento"
            : "Serie completada"}
          <ChevronRight className="h-5 w-5" />
        </button>

        {!(isLastSet && isLastExercise) && (
          <p className="text-center text-xs text-zinc-600">
            {isLastSet
              ? `Siguiente: ${exercises[exerciseIdx + 1]?.exercises.name}`
              : `${current.rest_seconds}s de descanso después de esta serie`}
          </p>
        )}
      </div>
    </div>
  );
}
