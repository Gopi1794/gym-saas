import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AchievementList from "@/components/achievements/AchievementList"
import type { Achievement } from "@/types"

export const metadata: Metadata = { title: "Logros del gimnasio" }

export default async function AchievementsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()

  // Role guard: only admin or trainer may access this page (ADR-6)
  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    notFound()
  }

  const { data: achievements } = await (supabase
    .from("achievements" as never)
    .select("*")
    .eq("gym_id", profile.gym_id ?? "")
    .order("created_at", { ascending: false }) as unknown as Promise<{
    data: Achievement[] | null
  }>)

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Logros del gimnasio</h1>
        <p className="text-sm text-zinc-400">
          Configurá los logros que pueden ganar tus miembros
        </p>
      </div>

      <AchievementList items={achievements ?? []} />
    </div>
  )
}
