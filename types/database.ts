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
          invite_code: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id?: string | null
          logo_url?: string | null
          address?: string | null
          created_at?: string
          invite_code?: string
        }
        Update: Partial<Database["public"]["Tables"]["gyms"]["Insert"]>
        Relationships: []
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
          date_of_birth: string | null
          phone: string | null
          weight_kg: number | null
          height_cm: number | null
          goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
          medical_conditions: string | null
          training_frequency: "never" | "1-2" | "3-4" | "5+" | null
          emergency_name: string | null
          emergency_phone: string | null
          notification_hour: number
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
          date_of_birth?: string | null
          phone?: string | null
          weight_kg?: number | null
          height_cm?: number | null
          goal?: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
          medical_conditions?: string | null
          training_frequency?: "never" | "1-2" | "3-4" | "5+" | null
          emergency_name?: string | null
          emergency_phone?: string | null
          notification_hour?: number
        }
        Update: Partial<Omit<Database["public"]["Tables"]["profiles"]["Insert"], "id">>
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          external_id: string | null
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
          external_id?: string | null
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
        Relationships: []
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
        Relationships: []
      }
      check_ins: {
        Row: {
          id: string
          user_id: string
          gym_id: string
          checked_in_at: string
          method: "qr" | "manual"
          checked_out_at: string | null
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
        Relationships: [
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      workout_session_sets: {
        Row: {
          id: string
          session_id: string
          exercise_id: string | null
          exercise_name: string
          category: string
          set_number: number
          reps: number | null
          weight_kg: number | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id?: string | null
          exercise_name: string
          category: string
          set_number: number
          reps?: number | null
          weight_kg?: number | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workout_session_sets"]["Insert"]>
        Relationships: []
      }
      achievements: {
        Row: {
          id: string
          gym_id: string
          name: string
          description: string | null
          icon: string | null
          xp_reward: number
          condition_type: "total_sessions" | "streak_days" | "sessions_week" | "total_xp" | "sessions_category" | "total_volume_kg" | "total_cardio_minutes"
          condition_value: number
          condition_target: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          name: string
          description?: string | null
          icon?: string | null
          xp_reward?: number
          condition_type: "total_sessions" | "streak_days" | "sessions_week" | "total_xp" | "sessions_category" | "total_volume_kg" | "total_cardio_minutes"
          condition_value: number
          condition_target?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["achievements"]["Insert"]>
        Relationships: []
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
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          metadata: Json
          read: boolean
          dedup_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          metadata?: Json
          read?: boolean
          dedup_key?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}
