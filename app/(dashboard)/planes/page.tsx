import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import TrainerPlanesView from "@/components/planes/TrainerPlanesView"
import PlanCard from "@/components/planes/PlanCard"

export const metadata: Metadata = { title: "Plantillas de entrenamiento" }

type PlanRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  assigned_to: string | null
  level?: string | null
  workout_plan_days: {
    id: string
    day_of_week: number
    workout_plan_exercises: { id: string }[]
  }[]
}

export default async function PlanesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { role: string; gym_id: string | null } | null
  const role = profile?.role ?? ""
  const gymId = profile?.gym_id ?? ""
  if (!role) redirect("/dashboard")

  const isTrainer = ["admin", "trainer"].includes(role)

  if (!isTrainer) {
    // Members: show their assigned plan
    const planSelect = `
      id, name, description, created_at, assigned_to, level,
      workout_plan_days(id, day_of_week, workout_plan_exercises(id))
    `
    const { data: rawMyPlan } = await supabase
      .from("workout_plans")
      .select(planSelect)
      .eq("assigned_to", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const myPlan = rawMyPlan as PlanRow | null

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Mi plan de entrenamiento</h1>
          <p className="text-zinc-400">El plan que tu entrenador armó para vos</p>
        </div>
        {!myPlan ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
            <p className="text-zinc-400 font-medium">Todavía no tenés un plan asignado</p>
            <p className="text-sm text-zinc-600">Hablá con tu entrenador para que te cree uno</p>
          </div>
        ) : (
          <PlanCard plan={myPlan} isTemplate={false} trainerId="" readOnly />
        )}
      </div>
    )
  }

  // Trainer / admin: templates + member plans + members list
  const planSelect = `
    id, name, description, created_at, assigned_to, level,
    workout_plan_days(id, day_of_week, workout_plan_exercises(id))
  `

  type MemberRow = { id: string; full_name: string | null }

  const [
    { data: rawTemplates },
    { data: rawMemberPlans },
    { data: rawMembers },
  ] = await Promise.all([
    supabase
      .from("workout_plans")
      .select(planSelect)
      .eq("is_template", true)
      .order("created_at"),
    supabase
      .from("workout_plans")
      .select(planSelect)
      .eq("is_template", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("gym_id", profile?.gym_id ?? "")
      .eq("role", "member")
      .order("full_name"),
  ])

  const templates = (rawTemplates ?? []) as unknown as PlanRow[]
  const memberPlans = (rawMemberPlans ?? []) as unknown as PlanRow[]
  const members = (rawMembers ?? []) as MemberRow[]

  return (
    <TrainerPlanesView
      trainerId={user!.id}
      gymId={gymId}
      memberPlans={memberPlans}
      templates={templates}
      members={members}
    />
  )
}
