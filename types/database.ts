export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string | null
          logo_url: string | null
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id?: string | null
          logo_url?: string | null
          address?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["gyms"]["Insert"]>
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: "admin" | "trainer" | "member"
          gym_id: string | null
          membership_type: "basic" | "premium" | "vip" | null
          membership_expires_at: string | null
          qr_code: string
          gender: "male" | "female" | "other" | null
          created_at: string
          total_xp: number
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: "admin" | "trainer" | "member"
          gym_id?: string | null
          membership_type?: "basic" | "premium" | "vip" | null
          membership_expires_at?: string | null
          qr_code?: string
          gender?: "male" | "female" | "other" | null
          created_at?: string
          total_xp?: number
        }
        Update: Partial<Omit<Database["public"]["Tables"]["profiles"]["Insert"], "id">>
      }
      exercises: {
        Row: {
          id: string
          name: string
          description: string | null
          category: "strength" | "cardio" | "flexibility" | "balance" | "hiit"
          muscle_groups: string[]
          difficulty: "beginner" | "intermediate" | "advanced"
          video_url: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: "strength" | "cardio" | "flexibility" | "balance" | "hiit"
          muscle_groups?: string[]
          difficulty?: "beginner" | "intermediate" | "advanced"
          video_url?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>
      }
      exercise_favorites: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["exercise_favorites"]["Insert"]>
      }
      check_ins: {
        Row: {
          id: string
          user_id: string
          gym_id: string
          checked_in_at: string
          checked_out_at: string | null
          method: "qr" | "manual"
        }
        Insert: {
          id?: string
          user_id: string
          gym_id: string
          checked_in_at?: string
          checked_out_at?: string | null
          method?: "qr" | "manual"
        }
        Update: Partial<Database["public"]["Tables"]["check_ins"]["Insert"]>
      }
      workout_plans: {
        Row: {
          id: string
          gym_id: string | null
          name: string
          description: string | null
          is_template: boolean
          created_by: string | null
          assigned_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gym_id?: string | null
          name: string
          description?: string | null
          is_template?: boolean
          created_by?: string | null
          assigned_to?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workout_plans"]["Insert"]>
      }
      workout_plan_days: {
        Row: {
          id: string
          plan_id: string
          day_of_week: number
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          day_of_week: number
          name?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workout_plan_days"]["Insert"]>
      }
      workout_plan_exercises: {
        Row: {
          id: string
          day_id: string
          exercise_id: string
          sets: number
          reps: number
          rest_seconds: number
          order_index: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          day_id: string
          exercise_id: string
          sets?: number
          reps?: number
          rest_seconds?: number
          order_index?: number
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workout_plan_exercises"]["Insert"]>
      }
      workout_sessions: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          day_of_week: number
          day_name: string
          exercises_count: number
          completed_at: string
          rest_skips: number
          xp_earned: number
        }
        Insert: {
          id?: string
          user_id: string
          plan_id?: string | null
          day_of_week: number
          day_name: string
          exercises_count?: number
          completed_at?: string
          rest_skips?: number
          xp_earned?: number
        }
        Update: Partial<Database["public"]["Tables"]["workout_sessions"]["Insert"]>
      }
      achievements: {
        Row: {
          id: string
          gym_id: string
          name: string
          description: string | null
          icon: string | null
          xp_reward: number
          condition_type: "total_sessions" | "streak_days" | "sessions_week" | "total_xp"
          condition_value: number
          created_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          name: string
          description?: string | null
          icon?: string | null
          xp_reward?: number
          condition_type: "total_sessions" | "streak_days" | "sessions_week" | "total_xp"
          condition_value: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["achievements"]["Insert"]>
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          earned_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["user_achievements"]["Insert"]>
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}
