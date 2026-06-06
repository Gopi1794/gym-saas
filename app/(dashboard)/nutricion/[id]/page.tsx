import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getNutritionPlan, getFoods, getFoodFavorites } from "@/app/actions/nutrition"
import NutritionPlanEditor from "@/components/nutrition/NutritionPlanEditor"

export const metadata: Metadata = { title: "Editor de plan nutricional" }

export default async function NutricionPlanPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { gym_id: string | null; role: string } | null
  if (!profile || !["admin", "trainer"].includes(profile.role)) redirect("/nutricion")

  const [plan, foods, favoriteIds] = await Promise.all([
    getNutritionPlan(params.id),
    getFoods(profile.gym_id ?? ""),
    getFoodFavorites(user!.id),
  ])

  if (!plan) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/nutricion" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Volver a planes
        </Link>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">{plan.name}</h1>
        <p className="text-muted-foreground">
          {plan.profiles?.full_name ?? "Socio"} · {plan.goal}
        </p>
      </div>
      <NutritionPlanEditor plan={plan} foods={foods} userId={user!.id} initialFavorites={favoriteIds} />
    </div>
  )
}
