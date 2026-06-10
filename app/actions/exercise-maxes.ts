"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function insertExerciseMax(exerciseId: string, weightKg: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("exercise_maxes")
    .insert(
      { user_id: user.id, exercise_id: exerciseId, weight_kg: weightKg }
    )

  if (error) return { error: error.message }
  revalidatePath("/entrenamiento")
  return { ok: true }
}

export async function getExerciseMaxes(userId: string): Promise<Record<string, number>> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("exercise_maxes")
    .select("exercise_id, weight_kg")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })

  if (!data) return {}

  // Deduplicar: quedarse con el registro más reciente por exercise_id
  const seen = new Set<string>()
  const deduped: { exercise_id: string; weight_kg: number }[] = []
  for (const row of data as { exercise_id: string; weight_kg: number }[]) {
    if (!seen.has(row.exercise_id)) {
      seen.add(row.exercise_id)
      deduped.push(row)
    }
  }

  return Object.fromEntries(deduped.map((r) => [r.exercise_id, r.weight_kg]))
}

type ExerciseSessionPoint = {
  sessionId: string
  date: string
  maxWeightKg: number
  totalVolume: number
  setCount: number
}

export type ExerciseHistory = {
  exerciseId: string
  exerciseName: string
  category: string
  sessions: ExerciseSessionPoint[]
  lastDate: string
}

export async function getExerciseHistory(userId: string): Promise<ExerciseHistory[]> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data } = await supabaseAny
    .from("workout_session_sets")
    .select("session_id, exercise_id, weight_kg, reps, workout_sessions!inner(completed_at), exercises(name, category)")
    .not("exercise_id", "is", null)
    .not("weight_kg", "is", null)

  if (!data) return []

  // Agrupar por exercise_id → session_id
  const exerciseMap = new Map<string, Map<string, { sets: typeof data }>>()

  for (const row of data) {
    if (!row.exercise_id || row.weight_kg == null) continue
    if (!exerciseMap.has(row.exercise_id)) exerciseMap.set(row.exercise_id, new Map())
    const sessionMap = exerciseMap.get(row.exercise_id)!
    if (!sessionMap.has(row.session_id)) sessionMap.set(row.session_id, { sets: [] })
    sessionMap.get(row.session_id)!.sets.push(row)
  }

  const result: ExerciseHistory[] = []

  for (const [exerciseId, sessionMap] of exerciseMap) {
    const sessions: ExerciseSessionPoint[] = []
    let exerciseName = ""
    let category = ""

    for (const [sessionId, { sets }] of sessionMap) {
      const firstSet = sets[0]
      exerciseName = firstSet.exercises?.name ?? exerciseId
      category = firstSet.exercises?.category ?? ""
      const date = firstSet.workout_sessions?.completed_at ?? ""
      const maxWeightKg = Math.max(...sets.map((s: any) => s.weight_kg as number))
      const totalVolume = sets.reduce((acc: number, s: any) => acc + (s.weight_kg as number) * (s.reps ?? 0), 0)
      sessions.push({ sessionId, date, maxWeightKg, totalVolume, setCount: sets.length })
    }

    sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const lastDate = sessions[sessions.length - 1]?.date ?? ""
    result.push({ exerciseId, exerciseName, category, sessions, lastDate })
  }

  return result.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
}
