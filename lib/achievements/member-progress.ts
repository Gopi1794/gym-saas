import type { createClient } from "@/lib/supabase/server"
import { daysAgoAR } from "@/lib/date-ar"
import {
  currentStreakFromDates,
  parseAchievementMetrics,
  type AchievementMetrics,
} from "./progress"

type ServerClient = ReturnType<typeof createClient>

type QueryResult<T> = { data: T | null; error: unknown }

export type MemberAchievementProgress = {
  /** null when the metrics could not be read: views show no numbers. */
  metrics: AchievementMetrics | null
  /** null when the session dates could not be read. */
  streak: number | null
}

// The RPC only looks back 365 days, so a longer streak cannot be earned anyway.
const STREAK_WINDOW_DAYS = 366

// Supabase reports failures in `error`, but a network problem can still throw:
// both end up as a failed result, never as a broken profile page.
async function settle<T>(query: PromiseLike<QueryResult<T>>): Promise<QueryResult<T>> {
  try {
    return await query
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Real numbers behind the member's achievement progress. Reads only the
 * caller's own rows (RLS applies). Each half degrades on its own so the
 * profile keeps working and the views never invent a number.
 */
export async function loadMemberAchievementProgress(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<MemberAchievementProgress> {
  const [metricsResult, sessionsResult] = await Promise.all([
    settle(
      supabase.rpc("member_achievement_metrics" as never, { p_user_id: userId } as never) as unknown as PromiseLike<
        QueryResult<unknown>
      >,
    ),
    settle(
      supabase
        .from("workout_sessions" as never)
        .select("completed_at")
        .eq("user_id", userId)
        .gte("completed_at", daysAgoAR(STREAK_WINDOW_DAYS))
        .order("completed_at", { ascending: false }) as unknown as PromiseLike<
        QueryResult<{ completed_at: string }[]>
      >,
    ),
  ])

  const metrics = metricsResult.error ? null : parseAchievementMetrics(metricsResult.data)

  const sessions = sessionsResult.error ? null : sessionsResult.data
  const streak = sessions ? currentStreakFromDates(sessions.map((s) => s.completed_at), now) : null

  return { metrics, streak }
}
