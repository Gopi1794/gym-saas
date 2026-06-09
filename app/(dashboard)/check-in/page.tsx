import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import CheckInTabs from "@/components/check-in/CheckInTabs"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const MEMBER_CHECKIN_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Check-in 📱",
    content: "Desde acá podés ver tu código QR para registrar tu asistencia al ingresar al gym.",
  },
  {
    target: "[data-tour='checkin-main']",
    placement: "bottom",
    title: "Tu código QR",
    content: "Mostrá este QR en la entrada. El staff lo escanea y tu asistencia queda registrada automáticamente.",
  },
]

const ADMIN_CHECKIN_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Check-in 🔍",
    content: "Registrá el ingreso de socios escaneando su QR o buscando su nombre manualmente.",
  },
  {
    target: "[data-tour='checkin-main']",
    placement: "bottom",
    title: "Escáner y registro",
    content: "Usá el escáner QR para ingresos rápidos o el registro manual si el socio no tiene el código a mano.",
  },
]

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">
            Check-in
          </h1>
          <p className="text-muted-foreground">
            {isMember ? "Mostrá tu QR en la entrada del gym" : "Escaneá QR de socios o registrá ingreso manual"}
          </p>
        </div>
        <PageTour
          tourKey={isMember ? "checkin-member" : "checkin-admin"}
          steps={isMember ? MEMBER_CHECKIN_STEPS : ADMIN_CHECKIN_STEPS}
        />
      </div>

      <div data-tour="checkin-main">
        <CheckInTabs
          profile={profile!}
          todayCheckIns={todayCheckIns ?? []}
          gymId={gymId}
        />
      </div>
    </div>
  )
}
