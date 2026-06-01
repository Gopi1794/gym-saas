// Shared types for the XP + Achievements feature.
// This module contains ONLY type definitions — no evaluation logic lives here.
// All evaluation logic lives inside the complete_workout_session Postgres function.

export type ConditionType =
  | "total_sessions"
  | "streak_days"
  | "sessions_week"
  | "total_xp"
  | "sessions_category"
  | "total_volume_kg"
  | "total_cardio_minutes"

export type EarnedAchievement = {
  id: string
  name: string
  description: string | null
  icon: string | null
  xp_reward: number
  earned_at: string
}

/**
 * Discriminated union returned by the completeWorkoutSession server action.
 * Callers MUST check `ok` before accessing the success fields.
 */
export type CompleteSessionResult =
  | {
      ok: true
      session_id: string
      xp_earned: number
      new_total_xp: number
      earned_achievements: EarnedAchievement[]
    }
  | {
      ok: false
      error: string
    }

/**
 * Input shape for the saveAchievement server action.
 * When `id` is present the action performs an UPDATE; otherwise an INSERT.
 */
export type AchievementInput = {
  id?: string
  name: string
  description?: string
  icon?: string
  xp_reward: number
  condition_type: ConditionType
  condition_value: number
  condition_target?: string
}

export type SessionSet = {
  exercise_id?: string
  exercise_name: string
  category: string
  set_number: number
  reps?: number
  weight_kg?: number
  duration_seconds?: number
  distance_meters?: number
  speed_kmh?: number
  resistance_level?: number
  calories_burned?: number
}
