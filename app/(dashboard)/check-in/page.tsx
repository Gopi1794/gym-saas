import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import CheckInTabs from "@/components/check-in/CheckInTabs"

export const metadata: Metadata = { title: "Check-in" }

export default async function CheckInPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single()
  const profile = profileData as any

  const today = new Date().toISOString().split("T")[0]

  const { data: todayCheckIns } = await supabase
    .from("check_ins")
    .select("*, profiles(full_name, avatar_url, membership_type)")
    .eq("gym_id", profile?.gym_id ?? "")
    .gte("checked_in_at", today)
    .order("checked_in_at", { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">
          Check-in
        </h1>
        <p className="text-muted-foreground">
          {profile?.role === "member"
            ? "Show your QR code at the gym entrance"
            : "Scan member QR codes or check in manually"}
        </p>
      </div>

      <CheckInTabs
        profile={profile!}
        todayCheckIns={todayCheckIns ?? []}
        gymId={profile?.gym_id ?? ""}
      />
    </div>
  )
}
