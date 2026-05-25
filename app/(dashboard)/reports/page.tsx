import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import RetentionChart from "@/components/reports/RetentionChart"
import ChurnList from "@/components/reports/ChurnList"
import AttendanceChart from "@/components/reports/AttendanceChart"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Reportes" }

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles").select("role, gym_id").eq("id", user!.id).single()

  if ((profile as any)?.role !== "admin") redirect("/dashboard")
  const gymId = (profile as any).gym_id as string
  if (!gymId) redirect("/dashboard")

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString()

  const [{ data: members }, { data: checkIns }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, membership_type, membership_expires_at")
      .eq("gym_id", gymId)
      .eq("role", "member"),

    supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("gym_id", gymId),
  ])

  // Retención
  const active   = (members ?? []).filter(m => m.membership_expires_at && new Date(m.membership_expires_at) > now && Math.ceil((new Date(m.membership_expires_at).getTime() - now.getTime()) / 86_400_000) > 7).length
  const expiring = (members ?? []).filter(m => m.membership_expires_at && new Date(m.membership_expires_at) > now && Math.ceil((new Date(m.membership_expires_at).getTime() - now.getTime()) / 86_400_000) <= 7).length
  const expired  = (members ?? []).filter(m => !m.membership_expires_at || new Date(m.membership_expires_at) <= now).length

  // Churn — vencidos en los últimos 90 días
  const churned = (members ?? [])
    .filter(m => m.membership_expires_at && new Date(m.membership_expires_at) <= now && new Date(m.membership_expires_at) >= new Date(ninetyDaysAgo))
    .sort((a, b) => new Date(b.membership_expires_at!).getTime() - new Date(a.membership_expires_at!).getTime())

  // Asistencia por horario (0-23)
  const byHour = Array(24).fill(0) as number[]
  for (const ci of checkIns ?? []) {
    const h = new Date(ci.checked_in_at).getHours()
    byHour[h]++
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Reportes</h1>
        <p className="text-muted-foreground">Métricas clave de tu gimnasio</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Retención */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Retención</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Estado actual de las membresías</p>
          </div>
          <RetentionChart active={active} expiring={expiring} expired={expired} />
        </div>

        {/* Asistencia por horario */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Asistencia por horario</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Distribución de check-ins a lo largo del día</p>
          </div>
          <AttendanceChart byHour={byHour} />
        </div>

        {/* Churn */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Churn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Socios cuya membresía venció y no renovaron</p>
          </div>
          <ChurnList members={churned as any} />
        </div>
      </div>
    </div>
  )
}
