import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import StaffLog from "@/components/check-in/StaffLog"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const STAFF_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Staff del gimnasio 👥",
    content: "Acá ves el registro de asistencia de cada trainer y los socios a su cargo.",
  },
  {
    target: "[data-tour='staff-content']",
    placement: "bottom",
    title: "Registro de trainers",
    content: "Cada trainer tiene su historial de ingresos. Hacé click en uno para ver sus detalles.",
  },
]

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Staff | GymFlow" }

export default async function StaffPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()
  const profile = profileData as { role: string; gym_id: string | null } | null

  if (profile?.role !== "admin") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">
          Staff
        </h1>
        <p className="text-muted-foreground">
          Asistencia y socios a cargo de cada trainer
        </p>
      </div>

      <div data-tour="staff-content">
        <StaffLog gymId={profile.gym_id ?? ""} />
      </div>
      <PageTour tourKey="staff" steps={STAFF_STEPS} />
    </div>
  )
}
