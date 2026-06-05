import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getNutritionPlans, getMemberNutritionPlan } from "@/app/actions/nutrition"
import NutritionPlansPanel from "@/components/nutrition/NutritionPlansPanel"
import MemberNutritionView from "@/components/nutrition/MemberNutritionView"

export const metadata: Metadata = { title: "Nutrición" }

export default async function NutricionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { gym_id: string | null; role: string } | null
  if (!profile) redirect("/dashboard")

  const gymId = profile.gym_id ?? ""
  const role = profile.role

  if (role === "member") {
    const plan = await getMemberNutritionPlan(user!.id)
    return <MemberNutritionView plan={plan} />
  }

  const [plans, membersRaw] = await Promise.all([
    getNutritionPlans(gymId),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("gym_id", gymId)
      .eq("role", "member")
      .order("full_name"),
  ])

  const members = (membersRaw.data ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Nutrición</h1>
        <p className="text-muted-foreground">Planes nutricionales de los socios</p>
      </div>
      <NutritionPlansPanel gymId={gymId} plans={plans} members={members} />
    </div>
  )
}
