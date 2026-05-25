import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AchievementList from "@/components/achievements/AchievementList"
import type { Achievement } from "@/types"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const ACHIEVEMENTS_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Logros del gimnasio 🏆",
    content: "Creá logros que tus miembros pueden desbloquear al cumplir objetivos de asistencia y entrenamiento.",
  },
  {
    target: "[data-tour='achievements-list']",
    placement: "top",
    title: "Lista de logros",
    content: "Cada logro tiene un ícono, nombre, descripción y condición para desbloquearlo. Los miembros los ven en su perfil.",
  },
]

export const metadata: Metadata = { title: "Logros del gimnasio" }

export default async function AchievementsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()
  const profile = profileData as { gym_id: string | null; role: string } | null

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

      <div data-tour="achievements-list">
        <AchievementList items={achievements ?? []} />
      </div>
      <PageTour tourKey="achievements" steps={ACHIEVEMENTS_STEPS} />
    </div>
  )
}
