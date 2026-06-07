import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getNutritionPlans, getMemberNutritionPlan, getFoods } from "@/app/actions/nutrition"
import { getMealLogsForDate, getWaterToday, getNutritionStreak, getAdherenceReport } from "@/app/actions/nutrition-tracking"
import TabSwitcher from "@/components/ui/TabSwitcher"
import NutritionPlansPanel from "@/components/nutrition/NutritionPlansPanel"
import MemberNutritionView from "@/components/nutrition/MemberNutritionView"
import FoodLibraryPanel from "@/components/nutrition/FoodLibraryPanel"
import NutritionAdherencePanel from "@/components/nutrition/NutritionAdherencePanel"

export const metadata: Metadata = { title: "Nutrición" }

export default async function NutricionPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
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
  const today = new Date().toISOString().split("T")[0]

  // ── Miembro: vista directa sin tabs ──
  if (role === "member") {
    const [plan, waterGlasses, streak] = await Promise.all([
      getMemberNutritionPlan(user!.id),
      getWaterToday(user!.id),
      getNutritionStreak(user!.id),
    ])
    const mealLogs = plan ? await getMealLogsForDate(user!.id, today) : []
    return (
      <MemberNutritionView
        plan={plan}
        mealLogs={mealLogs}
        waterGlasses={waterGlasses}
        streak={streak}
        today={today}
      />
    )
  }

  // ── Admin / Trainer: vista con tabs ──
  const tab = searchParams.tab ?? "planes"
  const tabs = [
    { key: "planes",      label: "Planes" },
    { key: "adherencia",  label: "Adherencia" },
    { key: "alimentos",   label: "Alimentos" },
  ]

  let content: React.ReactNode

  if (tab === "alimentos") {
    const foods = await getFoods(gymId)
    content = <FoodLibraryPanel gymId={gymId} initialFoods={foods} />
  } else if (tab === "adherencia") {
    const entries = await getAdherenceReport(gymId)
    content = <NutritionAdherencePanel entries={entries} />
  } else {
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
    content = <NutritionPlansPanel gymId={gymId} plans={plans} members={members} />
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Nutrición</h1>
        <p className="text-muted-foreground">Planes, adherencia y biblioteca de alimentos</p>
      </div>
      <TabSwitcher tabs={tabs} activeTab={tab} />
      {content}
    </div>
  )
}
