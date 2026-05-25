import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import ProfileView from "@/components/profile/ProfileView"
import BadgeGrid from "@/components/profile/BadgeGrid"
import NotificationPreferences from "@/components/profile/NotificationPreferences"
import MembershipStatusCard from "@/components/profile/MembershipStatusCard"
import type { Achievement, Profile } from "@/types"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single()

  // Trigger didn't fire (schema loaded after signup) — create profile now
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: user!.id, full_name: user!.user_metadata?.full_name ?? null })
      .select("*")
      .single()
    profile = created
  }

  const [{ count: totalCheckIns }, { count: totalFavorites }, { count: totalPlans }] =
    await Promise.all([
      supabase.from("check_ins").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("exercise_favorites").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("client_plans" as never).select("*", { count: "exact", head: true }).eq("client_id", user!.id),
    ])

  // Achievement queries — run after profile is fetched so we have gym_id
  const [{ data: gymAchievements }, { data: earnedRows }] = await Promise.all([
    supabase
      .from("achievements" as never)
      .select("*")
      .eq("gym_id", profile?.gym_id ?? "") as unknown as Promise<{ data: Achievement[] | null }>,
    supabase
      .from("user_achievements" as never)
      .select("achievement_id, earned_at")
      .eq("user_id", user!.id) as unknown as Promise<{ data: { achievement_id: string; earned_at: string }[] | null }>,
  ])

  const earnedMap = new Map(
    (earnedRows ?? []).map((r) => [r.achievement_id, r.earned_at])
  )

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Profile</h1>
          <p className="text-zinc-400">Setting up your profile…</p>
        </div>
        <p className="text-sm text-zinc-500">
          Your profile is being created. Try refreshing in a few seconds.
        </p>
      </div>
    )
  }

  const p = profile as Profile

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Mi Perfil</h1>
        <p className="text-zinc-400">Tu tarjeta de entrenador</p>
      </div>

      {p.role === "member" && (
        <MembershipStatusCard
          membershipType={p.membership_type}
          expiresAt={p.membership_expires_at}
        />
      )}

      <ProfileView
        profile={profile}
        email={user!.email ?? ""}
        totalCheckIns={totalCheckIns ?? 0}
        totalFavorites={totalFavorites ?? 0}
        totalPlans={totalPlans ?? 0}
      />

      <BadgeGrid all={gymAchievements ?? []} earned={earnedMap} />

      <NotificationPreferences currentHour={(profile as { notification_hour?: number }).notification_hour ?? 7} />
    </div>
  )
}
