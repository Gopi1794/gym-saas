import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TabSwitcher from "@/components/ui/TabSwitcher"
import MemberTable from "@/components/members/MemberTable"
import InviteLink from "@/components/members/InviteLink"
import StaffLog from "@/components/check-in/StaffLog"
import { Users, CheckCircle2, Clock } from "lucide-react"
import { isMembershipActive } from "@/lib/utils"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const PERSONAS_TOUR_STEPS: Step[] = [
  {
    target: "[data-tour='personas-tabs']",
    placement: "bottom",
    title: "Miembros y Staff",
    content: "Navegá entre socios y trainers usando las pestañas.",
  },
  {
    target: "[data-tour='members-table']",
    placement: "top",
    title: "Tabla de miembros",
    content: "El punto de color en el avatar indica el estado de churn: verde (ok), amarillo (sin asistir 2 semanas), rojo (vencido o inactivo).",
  },
]

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Personas" }

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { role: string; gym_id: string | null } | null
  if (!profile || profile.role === "member") redirect("/dashboard")

  const gymId = profile.gym_id ?? ""
  const isAdmin = profile.role === "admin"
  const tab = searchParams.tab ?? "miembros"

  const tabs = [
    { key: "miembros", label: "Miembros" },
    ...(isAdmin ? [{ key: "staff", label: "Staff" }] : []),
  ]

  let content: React.ReactNode

  if (tab === "staff" && isAdmin) {
    content = <StaffLog gymId={gymId} />
  } else {
    const { data: gymData } = gymId
      ? await supabase.from("gyms").select("invite_code").eq("id", gymId).single()
      : { data: null }
    const inviteCode = (gymData as { invite_code: string } | null)?.invite_code ?? null

    const membersQuery = supabase
      .from("profiles")
      .select("*")
      .eq("role", "member")
      .order("created_at", { ascending: false })
    if (gymId) membersQuery.eq("gym_id", gymId)
    const { data: members } = await membersQuery

    const memberIds = (members ?? []).map((m) => m.id)

    const { data: churnData } = gymId
      ? await supabase.from("member_churn_status").select("id, churn_status").eq("gym_id", gymId)
      : { data: [] }

    const churnStatuses = Object.fromEntries(
      (churnData ?? []).map((r) => [r.id, r.churn_status])
    ) as Record<string, "green" | "yellow" | "red">

    const { data: plans } = memberIds.length
      ? await (supabase
          .from("workout_plans" as never)
          .select("id, name, assigned_to")
          .eq("is_template", false)
          .in("assigned_to", memberIds) as unknown as Promise<{
            data: { id: string; name: string; assigned_to: string | null }[] | null
          }>)
      : { data: [] as { id: string; name: string; assigned_to: string | null }[] }

    const allMembers = members ?? []
    const activeCount = allMembers.filter((m) =>
      isMembershipActive((m as { membership_expires_at: string | null }).membership_expires_at)
    ).length
    const expiredCount = allMembers.length - activeCount

    content = (
      <div className="space-y-5">
        <div data-tour="members-stats" className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
              <Users className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100 leading-none">{allMembers.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Total</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 flex items-center gap-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700 leading-none dark:text-emerald-300">{activeCount}</p>
              <p className="text-xs text-emerald-600 mt-0.5 dark:text-emerald-500">Activos</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
              <Clock className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-400 leading-none">{expiredCount}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Vencidos</p>
            </div>
          </div>
        </div>

        {inviteCode && (
          <div data-tour="members-invite" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-xs font-semibold text-zinc-400 mb-2">Invitar nuevo miembro</p>
            <p className="text-xs text-zinc-400 mb-3">
              Compartí este link para que los socios se registren y queden vinculados automáticamente al gym.
            </p>
            <InviteLink inviteCode={inviteCode} />
          </div>
        )}

        <div data-tour="members-table">
          <MemberTable members={allMembers} plans={plans ?? []} churnStatuses={churnStatuses} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Personas</h1>
        <p className="text-muted-foreground">Gestioná miembros y staff de tu gimnasio</p>
      </div>
      <div data-tour="personas-tabs">
        <TabSwitcher tabs={tabs} activeTab={tab} />
      </div>
      {content}
      <PageTour tourKey="personas" steps={PERSONAS_TOUR_STEPS} />
    </div>
  )
}
