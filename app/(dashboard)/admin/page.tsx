import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TabSwitcher from "@/components/ui/TabSwitcher"
import PaymentsTable, { type PaymentRow } from "@/components/payments/PaymentsTable"
import GymSettingsPanel from "@/components/admin/GymSettingsPanel"
import MembershipPlansPanel from "@/components/admin/MembershipPlansPanel"
import ExportPanel from "@/components/admin/ExportPanel"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Administración" }

export default async function AdminPage({
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
  if (profile?.role !== "admin") redirect("/dashboard")

  const gymId = profile.gym_id ?? ""
  const tab = searchParams.tab ?? "pagos"
  const tabs = [
    { key: "pagos",          label: "Pagos" },
    { key: "membresias",     label: "Membresías" },
    { key: "exportaciones",  label: "Exportaciones" },
    { key: "configuracion",  label: "Configuración" },
  ]

  let content: React.ReactNode

  if (tab === "exportaciones") {
    content = <ExportPanel />
  } else if (tab === "configuracion") {
    content = <GymSettingsPanel />
  } else if (tab === "membresias") {
    const { data: plans } = await supabase
      .from("membership_plans" as never)
      .select("*")
      .eq("gym_id", gymId)
      .order("type") as unknown as { data: any[] | null }

    const { data: memberRows } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("gym_id", gymId)
      .not("membership_type", "is", null) as unknown as { data: { membership_type: string }[] | null }

    const memberCounts = {
      basic:   memberRows?.filter(m => m.membership_type === "basic").length   ?? 0,
      premium: memberRows?.filter(m => m.membership_type === "premium").length ?? 0,
      vip:     memberRows?.filter(m => m.membership_type === "vip").length     ?? 0,
    }

    content = <MembershipPlansPanel initialPlans={plans ?? []} memberCounts={memberCounts} />
  } else {
    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount, status, mp_payment_id, created_at, profiles(full_name, avatar_url)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(100) as unknown as { data: PaymentRow[] | null }

    content = (
      <div data-tour="payments-table">
        <PaymentsTable payments={payments ?? []} />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Administración</h1>
        <p className="text-muted-foreground">Pagos y configuración del gimnasio</p>
      </div>
      <TabSwitcher tabs={tabs} activeTab={tab} />
      {content}
    </div>
  )
}
