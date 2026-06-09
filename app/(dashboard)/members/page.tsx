import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Users, CheckCircle2, Clock } from "lucide-react"
import MemberTable from "@/components/members/MemberTable"
import InviteLink from "@/components/members/InviteLink"
import { isMembershipActive } from "@/lib/utils"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const MEMBERS_TOUR_STEPS: Step[] = [
  {
    target: "[data-tour='members-stats']",
    placement: "bottom",
    title: "Resumen de membresías",
    content: "Total de socios, cuántos tienen membresía activa y cuántos con la membresía vencida.",
  },
  {
    target: "[data-tour='members-invite']",
    placement: "bottom",
    title: "Invitar socios",
    content: "Compartí este link para que nuevos miembros se registren y queden vinculados automáticamente a tu gym.",
  },
  {
    target: "[data-tour='members-table']",
    placement: "top",
    title: "Tabla de miembros",
    content: "El punto de color en el avatar indica el estado de churn: verde (ok), amarillo (sin asistir 2 semanas), rojo (membresía vencida o inactivo).",
  },
]

export const metadata: Metadata = { title: "Miembros" }

export default async function MembersPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user!.id)
    .single()

  if (currentProfile?.role === "member") redirect("/dashboard")

  const gymId = (currentProfile as { role: string; gym_id: string | null } | null)?.gym_id

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
    ? await supabase
        .from("member_churn_status")
        .select("id, churn_status")
        .eq("gym_id", gymId)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Miembros</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestioná los socios de tu gimnasio</p>
        </div>
        <PageTour tourKey="members" steps={MEMBERS_TOUR_STEPS} />
      </div>

      {/* Stats */}
      <div data-tour="members-stats" className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-zinc-100 leading-none">{allMembers.length}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Total</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-900/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-300 leading-none">{activeCount}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Activos</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
            <Clock className="h-4 w-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-zinc-400 leading-none">{expiredCount}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Vencidos</p>
          </div>
        </div>
      </div>

      {/* Invite link */}
      {inviteCode && (
        <div data-tour="members-invite" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold text-zinc-400 mb-2">Invitar nuevo miembro</p>
          <p className="text-xs text-zinc-600 mb-3">
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
