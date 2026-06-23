"use server"

import { createClient } from "@/lib/supabase/server"
import type { SessionSet } from "@/lib/achievements/types"

export type WorkoutDraft = {
  plan_id: string
  day_of_week: number
  day_name: string
  exercise_idx: number
  current_set: number
  phase: "exercising" | "resting"
  collected_sets: SessionSet[]
  rest_ends_at: number | null
  rest_total: number
}

export async function saveWorkoutDraft(draft: WorkoutDraft): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const row = {
    user_id: user.id,
    plan_id: draft.plan_id,
    day_of_week: draft.day_of_week,
    day_name: draft.day_name,
    exercise_idx: draft.exercise_idx,
    current_set: draft.current_set,
    phase: draft.phase,
    collected_sets: draft.collected_sets,
    rest_ends_at: draft.rest_ends_at,
    rest_total: draft.rest_total,
    updated_at: new Date().toISOString(),
  }

  await (supabase
    .from("workout_session_drafts" as never)
    .upsert(row as never, { onConflict: "user_id,plan_id,day_of_week" } as never) as unknown as Promise<unknown>)
}

export async function loadWorkoutDraft(planId: string): Promise<WorkoutDraft | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await (supabase
    .from("workout_session_drafts" as never)
    .select("*")
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>)

  if (!data) return null

  return {
    plan_id: data.plan_id as string,
    day_of_week: data.day_of_week as number,
    day_name: data.day_name as string,
    exercise_idx: data.exercise_idx as number,
    current_set: data.current_set as number,
    phase: data.phase as "exercising" | "resting",
    collected_sets: (data.collected_sets ?? []) as SessionSet[],
    rest_ends_at: data.rest_ends_at as number | null,
    rest_total: data.rest_total as number,
  }
}

export async function deleteWorkoutDraft(planId: string, dayOfWeek: number): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("workout_session_drafts" as never)
    .delete()
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .eq("day_of_week", dayOfWeek)
}
