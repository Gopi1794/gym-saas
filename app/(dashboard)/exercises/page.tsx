import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import ExerciseGrid from "@/components/exercises/ExerciseGrid"
import AddExerciseDialog from "@/components/exercises/AddExerciseDialog"
import MemberWorkoutView from "@/components/planes/MemberWorkoutView"
import { Dumbbell } from "lucide-react"

export const metadata: Metadata = { title: "Exercise Library" }

type Profile = { role: string; gender?: string | null }
type Plan = {
  id: string
  name: string
  description: string | null
  is_template: boolean
  created_by: string | null
  assigned_to: string | null
}
type PlanDay = {
  id: string
  day_of_week: number
  name: string | null
  workout_plan_exercises: {
    id: string
    sets: number
    reps: number
    rest_seconds: number
    order_index: number
    notes: string | null
    duration_seconds: number | null
    exercises: {
      id: string
      name: string
      category: string

      image_url: string | null
      muscle_groups: string[]
    }
  }[]
}

export default async function ExercisesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userGender =
    (user?.user_metadata?.gender as string | undefined) ??
    (user?.user_metadata?.sexo as string | undefined) ??
    (user?.user_metadata?.genero as string | undefined)

  const profileRes = await supabase
    .from("profiles")
    .select("role, gender")
    .eq("id", user!.id)
    .single()

  const profile = profileRes.data as Profile | null
  const role = profile?.role ?? ""

  // ── Member: show assigned workout plan ──
  if (role === "member") {
    const planRes = await (supabase
      .from("workout_plans" as never)
      .select("id, name, description, is_template, created_by, assigned_to")
      .eq("assigned_to", user!.id)
      .eq("is_template", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as Promise<{ data: Plan | null }>)

    const plan = planRes.data

    if (!plan) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Mi rutina</h1>
            <p className="text-zinc-400">Tu plan de entrenamiento asignado</p>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Dumbbell className="h-5 w-5 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Tu trainer todavía no te asignó un plan</p>
          </div>
        </div>
      )
    }

    const [daysRes, sessionsRes] = await Promise.all([
      supabase
        .from("workout_plan_days" as never)
        .select(`
          id, day_of_week, name,
          workout_plan_exercises(
            id, sets, reps, rest_seconds, order_index, notes, duration_seconds,
            exercises(id, name, category, image_url, muscle_groups)
          )
        `)
        .eq("plan_id", plan.id)
        .order("day_of_week") as unknown as Promise<{ data: PlanDay[] | null }>,
      supabase
        .from("workout_sessions" as never)
        .select("id, day_name, day_of_week, exercises_count, completed_at")
        .eq("user_id", user!.id)
        .order("completed_at", { ascending: false })
        .limit(10) as unknown as Promise<{ data: { id: string; day_name: string; day_of_week: number; exercises_count: number; completed_at: string }[] | null }>,
    ])

    return (
      <MemberWorkoutView
        plan={plan}
        days={daysRes.data ?? []}
        userId={user!.id}
        recentSessions={sessionsRes.data ?? []}
        gender={profile?.gender ?? null}
      />
    )
  }

  // ── Admin / Trainer: show exercise library ──
  const [exercisesRes, favoritesRes] = await Promise.all([
    supabase.from("exercises").select("*").order("name"),
    supabase.from("exercise_favorites").select("exercise_id").eq("user_id", user!.id),
  ])

  const exercises = exercisesRes.data ?? []
  const favoriteIds = new Set((favoritesRes.data ?? []).map((f) => (f as { exercise_id: string }).exercise_id))
  const exercisesWithFavorite = exercises.map((ex) => ({
    ...(ex as object),
    is_favorite: favoriteIds.has((ex as { id: string }).id),
  }))

  const isAdmin = role === "admin"
  const canManage = role === "admin" || role === "trainer"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.22em] text-brand-400">Entrenamiento</p>
          <h1 className="font-heading text-2xl uppercase tracking-wide text-zinc-50">Biblioteca de ejercicios</h1>
          <p className="text-sm text-zinc-400">Accedé a la biblioteca de tu gimnasio</p>
        </div>
        <div className="flex gap-2">
          {canManage && <AddExerciseDialog />}
        </div>
      </div>

      <ExerciseGrid
        exercises={exercisesWithFavorite as never}
        userId={user!.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
