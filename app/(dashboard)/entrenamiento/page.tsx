import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import TabSwitcher from "@/components/ui/TabSwitcher"
import ExerciseGrid from "@/components/exercises/ExerciseGrid"
import AddExerciseDialog from "@/components/exercises/AddExerciseDialog"
import MemberWorkoutView from "@/components/planes/MemberWorkoutView"
import { getExerciseMaxes } from "@/app/actions/exercise-maxes"
import TrainerPlanesView from "@/components/planes/TrainerPlanesView"
import ImportExercisesPanel from "@/components/exercises/ImportExercisesPanel"
import { Dumbbell } from "lucide-react"

export const metadata: Metadata = { title: "Entrenamiento" }

type Plan = {
  id: string; name: string; description: string | null
  is_template: boolean; created_by: string | null; assigned_to: string | null
}
type PlanDay = {
  id: string; day_of_week: number; name: string | null
  workout_plan_exercises: {
    id: string; sets: number; reps: number; reps_max: number | null; rest_seconds: number
    order_index: number; notes: string | null; duration_seconds: number | null
    exercises: { id: string; name: string; category: string; image_url: string | null; muscle_groups: string[] }
    set_configs: { id: string; set_number: number; reps: number | null; reps_max: number | null; percent_1rm: number | null; duration_seconds: number | null; notes: string | null }[]
  }[]
}
type PlanRow = {
  id: string; name: string; description: string | null; created_at: string
  assigned_to: string | null; level?: string | null
  workout_plan_days: { id: string; day_of_week: number; workout_plan_exercises: { id: string }[] }[]
}

export default async function EntrenamientoPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, gym_id, gender, weight_kg")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { role: string; gym_id: string | null; gender: string | null; weight_kg: number | null } | null
  const role = profile?.role ?? ""
  const gymId = profile?.gym_id ?? ""
  const isAdmin = role === "admin"
  const canManage = role === "admin" || role === "trainer"

  // ── Miembro: muestra su rutina directamente (sin tabs) ──
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
            <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi rutina</h1>
            <p className="text-muted-foreground">Tu plan de entrenamiento asignado</p>
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

    const [daysRes, sessionsRes, exerciseMaxes] = await Promise.all([
      supabase
        .from("workout_plan_days" as never)
        .select(`id, day_of_week, name, workout_plan_exercises(id, sets, reps, reps_max, rest_seconds, order_index, notes, duration_seconds, exercises(id, name, category, image_url, muscle_groups, is_timed), set_configs:workout_plan_set_configs(id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes))`)
        .eq("plan_id", plan.id)
        .order("day_of_week") as unknown as Promise<{ data: PlanDay[] | null }>,
      supabase
        .from("workout_sessions" as never)
        .select("id, day_name, day_of_week, exercises_count, completed_at")
        .eq("user_id", user!.id)
        .order("completed_at", { ascending: false })
        .limit(10) as unknown as Promise<{ data: { id: string; day_name: string; day_of_week: number; exercises_count: number; completed_at: string }[] | null }>,
      getExerciseMaxes(user!.id),
    ])

    return (
      <MemberWorkoutView
        plan={plan}
        days={daysRes.data ?? []}
        userId={user!.id}
        recentSessions={sessionsRes.data ?? []}
        gender={profile?.gender ?? null}
        weightKg={profile?.weight_kg ?? null}
        exerciseMaxes={exerciseMaxes}
      />
    )
  }

  // ── Admin / Trainer: vista con tabs ──
  const tab = searchParams.tab ?? "ejercicios"
  const tabs = [
    { key: "ejercicios", label: "Ejercicios" },
    { key: "planes", label: "Planes" },
    ...(isAdmin ? [{ key: "importar", label: "Importar" }] : []),
  ]

  let content: React.ReactNode

  if (tab === "planes") {
    const planSelect = `id, name, description, created_at, assigned_to, level, workout_plan_days(id, day_of_week, workout_plan_exercises(id))`
    type MemberRow = { id: string; full_name: string | null }
    const [{ data: rawTemplates }, { data: rawMemberPlans }, { data: rawMembers }] = await Promise.all([
      supabase.from("workout_plans").select(planSelect).eq("is_template", true).order("created_at"),
      supabase.from("workout_plans").select(planSelect).eq("is_template", false).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").eq("gym_id", gymId).eq("role", "member").order("full_name"),
    ])
    content = (
      <TrainerPlanesView
        trainerId={user!.id}
        gymId={gymId}
        memberPlans={(rawMemberPlans ?? []) as unknown as PlanRow[]}
        templates={(rawTemplates ?? []) as unknown as PlanRow[]}
        members={(rawMembers ?? []) as MemberRow[]}
      />
    )
  } else if (tab === "importar" && isAdmin) {
    content = <ImportExercisesPanel />
  } else {
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
    content = (
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <AddExerciseDialog />
          </div>
        )}
        <ExerciseGrid exercises={exercisesWithFavorite as never} userId={user!.id} isAdmin={isAdmin} />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Entrenamiento</h1>
        <p className="text-muted-foreground">Ejercicios y planes de tu gimnasio</p>
      </div>
      <TabSwitcher tabs={tabs} activeTab={tab} />
      {content}
    </div>
  )
}
