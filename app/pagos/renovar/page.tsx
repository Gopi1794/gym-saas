import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import RenewMembershipCard from "@/components/dashboard/RenewMembershipCard"
import SignOutLink from "@/components/auth/SignOutLink"

export const metadata = { title: "Renovar membresía" }

export default async function RenovarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_expires_at, membership_type, gym_id")
    .eq("id", user.id)
    .single()

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("type, label, price, duration_days, features")
    .eq("gym_id", profile?.gym_id ?? "")
    .eq("is_active", true)
    .order("price")

  return (
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <span className="text-5xl">🔒</span>
          </div>
          <h1 className="font-display text-2xl text-zinc-50">Acceso restringido</h1>
          <p className="text-sm text-zinc-400">
            Tu membresía venció. Renovála para seguir usando la app.
          </p>
        </div>

        <RenewMembershipCard
          expiresAt={profile?.membership_expires_at ?? null}
          currentType={profile?.membership_type ?? null}
          plans={plans ?? []}
          forceInline
        />

        <div className="text-center">
          <SignOutLink />
        </div>
      </div>
    </div>
  )
}
