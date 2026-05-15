"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { CompleteSessionResult, EarnedAchievement, SessionSet } from "@/lib/achievements/types"

export type CompleteSessionInput = {
  plan_id: string
  /** ISO day index: 0 = Monday … 6 = Sunday */
  day_of_week: number
  day_name: string
  exercises_count: number
  /** Must be >= 0. The server coerces NULL to 0 in the RPC, but we validate here too. */
  rest_skips: number
  sets?: SessionSet[]
}

/**
 * Completes a workout session atomically via the complete_workout_session Postgres RPC.
 *
 * Design notes:
 * - user_id is NOT passed — the RPC reads auth.uid() from the session cookie.
 * - The RPC uses RETURNS TABLE, so Supabase JS returns an array of rows.
 *   We unwrap data[0] to get the single result row.
 * - On success we revalidate /dashboard (leaderboard) and /profile (badge grid).
 * - This function never throws; it always returns a typed CompleteSessionResult.
 */
export async function completeWorkoutSession(
  input: CompleteSessionInput
): Promise<CompleteSessionResult> {
  // Manual input validation — return typed error instead of throwing
  if (!input.plan_id) {
    return { ok: false, error: "plan_id is required" }
  }
  if (typeof input.day_of_week !== "number" || input.day_of_week < 0 || input.day_of_week > 6) {
    return { ok: false, error: "day_of_week must be an integer between 0 and 6" }
  }
  if (!input.day_name) {
    return { ok: false, error: "day_name is required" }
  }
  if (typeof input.rest_skips !== "number" || input.rest_skips < 0) {
    return { ok: false, error: "rest_skips must be a non-negative integer" }
  }

  const supabase = createClient()

  // RPC call — note: user_id is intentionally absent; auth comes from cookies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("complete_workout_session", {
    p_plan_id: input.plan_id,
    p_day_of_week: input.day_of_week,
    p_day_name: input.day_name,
    p_exercises_count: input.exercises_count,
    p_rest_skips: input.rest_skips,
    p_sets: input.sets ?? [],
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!data || !Array.isArray(data as any) || (data as any[]).length === 0) {
    return { ok: false, error: "No data returned from complete_workout_session RPC" }
  }

  // RETURNS TABLE yields an array; unwrap the single result row.
  const row = (data as unknown[])[0] as {
    session_id: string
    xp_earned: number
    new_total_xp: number
    earned_achievements: unknown
  }

  // Revalidate cached server-rendered pages that show XP / leaderboard / badges
  revalidatePath("/dashboard")
  revalidatePath("/profile")

  return {
    ok: true,
    session_id: row.session_id,
    xp_earned: row.xp_earned,
    new_total_xp: row.new_total_xp,
    // The RPC returns earned_achievements as JSONB; cast to the typed array.
    earned_achievements: (row.earned_achievements ?? []) as EarnedAchievement[],
  }
}
