"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function upsertExerciseMax(exerciseId: string, weightKg: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("exercise_maxes")
    .upsert(
      { user_id: user.id, exercise_id: exerciseId, weight_kg: weightKg },
      { onConflict: "user_id,exercise_id" }
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

  if (!data) return {}
  return Object.fromEntries(
    (data as { exercise_id: string; weight_kg: number }[]).map((r) => [r.exercise_id, r.weight_kg])
  )
}
