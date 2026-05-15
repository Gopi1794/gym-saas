import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import MemberTable from "@/components/members/MemberTable"

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

  const membersQuery = supabase
    .from("profiles")
    .select("*")
    .eq("role", "member")
    .order("created_at", { ascending: false })

  if (gymId) membersQuery.eq("gym_id", gymId)

  const { data: members } = await membersQuery

  const memberIds = (members ?? []).map((m) => m.id)

  const { data: plans } = memberIds.length
    ? await (supabase
        .from("workout_plans" as never)
        .select("id, name, assigned_to")
        .eq("is_template", false)
        .in("assigned_to", memberIds) as unknown as Promise<{
          data: { id: string; name: string; assigned_to: string | null }[] | null
        }>)
    : Promise.resolve({ data: [] })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Miembros</h1>
        <p className="text-zinc-400">{members?.length ?? 0} miembros registrados</p>
      </div>

      <MemberTable members={members ?? []} plans={plans ?? []} />
    </div>
  )
}
