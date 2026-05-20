import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import StaffLog from "@/components/check-in/StaffLog"

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

      <StaffLog gymId={profile.gym_id ?? ""} />
    </div>
  )
}
