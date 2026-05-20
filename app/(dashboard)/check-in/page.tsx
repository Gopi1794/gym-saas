import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import CheckInTabs from "@/components/check-in/CheckInTabs"

export const dynamic = "force-dynamic"
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
  const isMember = profile?.role === "member"
  const gymId: string = profile?.gym_id ?? ""

  const checkInsQuery = supabase
    .from("check_ins")
    .select("*, profiles(full_name, avatar_url, membership_type)")
    .gte("checked_in_at", today)
    .order("checked_in_at", { ascending: false })
    .limit(50)

  const { data: todayCheckIns, error: checkInsError } = isMember
    ? await checkInsQuery.eq("user_id", user!.id)
    : await checkInsQuery.eq("gym_id", gymId)

  if (checkInsError) console.error("[CheckInPage] query error:", checkInsError.message, checkInsError.details)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">
          Check-in
        </h1>
        <p className="text-muted-foreground">
          {isMember ? "Mostrá tu QR en la entrada del gym" : "Escaneá QR de socios o registrá ingreso manual"}
        </p>
      </div>

      <CheckInTabs
        profile={profile!}
        todayCheckIns={todayCheckIns ?? []}
        gymId={gymId}
      />
    </div>
  )
}
