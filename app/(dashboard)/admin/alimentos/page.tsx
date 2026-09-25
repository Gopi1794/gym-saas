import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getFoodsPage } from "@/app/actions/nutrition"
import { parseFoodLibraryParams } from "@/lib/food-library"
import FoodLibraryPanel from "@/components/nutrition/FoodLibraryPanel"

export const metadata: Metadata = { title: "Biblioteca de alimentos" }

export default async function AlimentosPage({
  searchParams,
}: {
  searchParams: { q?: string | string[]; cat?: string | string[]; page?: string | string[] }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { gym_id: string | null; role: string } | null
  if (!profile || !["admin", "trainer"].includes(profile.role)) redirect("/dashboard")

  const gymId = profile.gym_id ?? ""
  const params = parseFoodLibraryParams(searchParams)
  const foodsPage = await getFoodsPage(gymId, params)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Biblioteca de alimentos</h1>
        <p className="text-muted-foreground">Alimentos globales y personalizados de tu gimnasio. Valores por 100g.</p>
      </div>
      <FoodLibraryPanel gymId={gymId} foodsPage={foodsPage} query={params.query} chip={params.chip} />
    </div>
  )
}
