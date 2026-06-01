import type { Database } from "./database"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Exercise = Database["public"]["Tables"]["exercises"]["Row"]
export type ExerciseFavorite = Database["public"]["Tables"]["exercise_favorites"]["Row"]
export type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"]
export type Gym = Database["public"]["Tables"]["gyms"]["Row"]
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"]
export type UserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"]
export type WorkoutSession = Database["public"]["Tables"]["workout_sessions"]["Row"]

export type ExerciseCategory = Exercise["category"]
export type MemberRole = Profile["role"]
export type MembershipType = Profile["membership_type"]

export type ExerciseWithFavorite = Exercise & { is_favorite: boolean }

export type CheckInWithProfile = CheckIn & {
  profiles: Pick<Profile, "full_name" | "avatar_url" | "membership_type">
}

export type { EarnedAchievement, CompleteSessionResult, ConditionType, AchievementInput } from "@/lib/achievements/types"
