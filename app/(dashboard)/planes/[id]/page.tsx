import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PlanEditor from "@/components/planes/PlanEditor"

interface Props {
  params: { id: string }
}

export default async function PlanPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single()

  const role: string = (profileData as { role: string } | null)?.role ?? ""
  if (!role) redirect("/dashboard")

  const isTrainer = ["admin", "trainer"].includes(role)
  const isMember = role === "member"

  const [{ data: plan }, { data: planDays }, { data: allExercises }] = await Promise.all([
    supabase
      .from("workout_plans" as never)
      .select("*")
      .eq("id", params.id)
      .single() as unknown as Promise<{ data: { id: string; name: string; description: string | null; is_template: boolean; created_by: string | null; assigned_to: string | null } | null }>,
    supabase
      .from("workout_plan_days" as never)
      .select(`
        id, day_of_week, name,
        workout_plan_exercises(
          id, sets, reps, rest_seconds, order_index, notes, duration_seconds,
          exercises(id, name, category, difficulty, image_url, muscle_groups, is_timed)
        )
      `)
      .eq("plan_id", params.id)
      .order("day_of_week") as unknown as Promise<{ data: unknown[] | null }>,
    isTrainer
      ? supabase
          .from("exercises")
          .select("id, name, category, difficulty, muscle_groups, image_url, is_timed")
          .order("name")
      : Promise.resolve({ data: [] }),
  ])

  if (!plan) notFound()

  // Members can only view their own assigned plan
  if (isMember && plan.assigned_to !== user!.id) redirect("/planes")

  return (
    <PlanEditor
      plan={plan}
      initialDays={(planDays ?? []) as never}
      allExercises={(allExercises ?? []) as never}
      trainerId={user!.id}
      readOnly={isMember}
    />
  )
}
