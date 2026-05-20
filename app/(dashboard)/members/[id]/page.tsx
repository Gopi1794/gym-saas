import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, Dumbbell, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { isMembershipActive } from "@/lib/utils"
import PlanCard from "@/components/planes/PlanCard"
import CreatePlanForMember from "@/components/members/CreatePlanForMember"
import MemberPhysicalEdit from "@/components/members/MemberPhysicalEdit"
import MemberMembershipEdit from "@/components/members/MemberMembershipEdit"

interface Props {
  params: { id: string }
}

type MemberRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  membership_type: string | null
  membership_expires_at: string | null
  weight_kg: number | null
  height_cm: number | null
}

type PlanRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  assigned_to: string | null
  workout_plan_days: {
    id: string
    day_of_week: number
    workout_plan_exercises: { id: string }[]
  }[]
}

export default async function MemberDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single()

  const role = (currentProfile as { role: string } | null)?.role ?? ""
  if (!["admin", "trainer"].includes(role)) redirect("/dashboard")

  const { data: rawMember } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, membership_type, membership_expires_at, weight_kg, height_cm")
    .eq("id", params.id)
    .single() as unknown as { data: MemberRow | null }

  if (!rawMember) notFound()
  const member = rawMember

  const planSelect = `
    id, name, description, created_at, assigned_to,
    workout_plan_days(id, day_of_week, workout_plan_exercises(id))
  `

  const { data: rawPlan } = await supabase
    .from("workout_plans" as never)
    .select(planSelect)
    .eq("assigned_to", params.id)
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as { data: PlanRow | null }

  const memberName = member.full_name ?? "Miembro"
  const active = isMembershipActive(member.membership_expires_at)

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/members"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a miembros
      </Link>

      {/* Member card */}
      <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-md">
        <Avatar className="h-16 w-16">
          <AvatarImage src={member.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">
            <User className="h-7 w-7 text-zinc-400" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-50 truncate">{memberName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 capitalize">
              {member.role}
            </Badge>
            <Badge
              variant="outline"
              className={
                member.membership_type === "vip"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : member.membership_type === "premium"
                  ? "border-brand-700/30 bg-brand-700/10 text-brand-500"
                  : "border-zinc-600/30 bg-zinc-800 text-zinc-400"
              }
            >
              {member.membership_type ?? "basic"}
            </Badge>
            <Badge variant={active ? "success" : "secondary"}>
              {active ? "Activo" : "Vencido"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Membership */}
      <MemberMembershipEdit
        memberId={params.id}
        initialType={member.membership_type as "basic" | "premium" | "vip" | null}
        initialExpiresAt={member.membership_expires_at}
      />

      {/* Physical data */}
      <MemberPhysicalEdit
        memberId={params.id}
        initialWeight={member.weight_kg}
        initialHeight={member.height_cm}
      />

      {/* Plan section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Plan de entrenamiento</h2>
            <p className="text-sm text-zinc-500">
              {rawPlan ? "Plan asignado actualmente" : "Este miembro no tiene un plan asignado"}
            </p>
          </div>
          {!rawPlan && (
            <CreatePlanForMember
              memberId={params.id}
              memberName={memberName}
              trainerId={user!.id}
            />
          )}
        </div>

        {rawPlan ? (
          <div className="max-w-sm">
            <PlanCard plan={rawPlan} isTemplate={false} trainerId={user!.id} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Dumbbell className="h-5 w-5 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">
              Creá un plan personalizado para {memberName}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
