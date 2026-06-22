import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProgressView, { type SessionRecord } from "@/components/progress/ProgressView"
import PageTour from "@/components/onboarding/PageTour"
import { getExerciseHistory } from "@/app/actions/exercise-maxes"
import type { Step } from "react-joyride"

const PROGRESS_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Mi progreso 📈",
    content: "Acá llevás el registro de todos tus entrenamientos completados.",
  },
  {
    target: "[data-tour='progress-content']",
    placement: "top",
    title: "Historial de sesiones",
    content: "Cada vez que completás una rutina queda registrada acá. Podés ver tu evolución semana a semana.",
  },
]

export const metadata: Metadata = { title: "Mi progreso" }

export default async function ProgressPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, weight_kg, goal")
    .eq("id", user!.id)
    .single()
  const profile = profileData as { role: string; weight_kg: number | null; goal: string | null } | null

  if (profile?.role !== "member") redirect("/dashboard")

  // Fetch all sessions (ordered newest first)
  const { data: sessions } = await supabase
    .from("workout_sessions" as never)
    .select("id, day_name, day_of_week, exercises_count, completed_at")
    .eq("user_id", user!.id)
    .order("completed_at", { ascending: false }) as unknown as { data: SessionRecord[] | null }

  // Fetch plan training days count
  type PlanDayRow = { day_of_week: number; workout_plan_exercises: { id: string }[] }
  const { data: plan } = await (supabase
    .from("workout_plans" as never)
    .select("id")
    .eq("assigned_to", user!.id)
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: { id: string } | null }>)

  const exerciseHistory = await getExerciseHistory(user!.id)

  let trainingDays = 0
  if (plan) {
    const { data: planDays } = await (supabase
      .from("workout_plan_days" as never)
      .select("day_of_week, workout_plan_exercises(id)")
      .eq("plan_id", plan.id) as unknown as Promise<{ data: PlanDayRow[] | null }>)

    trainingDays = (planDays ?? []).filter(d => d.workout_plan_exercises.length > 0).length
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi progreso</h1>
          <p className="text-sm text-muted-foreground">Tu historial de entrenamientos</p>
        </div>
        <PageTour tourKey="progress" steps={PROGRESS_STEPS} />
      </div>

      <div data-tour="progress-content">
        <ProgressView
          sessions={sessions ?? []}
          trainingDays={trainingDays}
          exerciseHistory={exerciseHistory}
        />
      </div>
    </div>
  )
}
