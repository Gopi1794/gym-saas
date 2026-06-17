import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import PaymentsTable, { type PaymentRow } from "@/components/payments/PaymentsTable"
import PageTour from "@/components/onboarding/PageTour"
import type { Step } from "react-joyride"

const PAYMENTS_TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Historial de pagos 💳",
    content: "Acá ves todos los pagos procesados a través de MercadoPago para tu gimnasio.",
  },
  {
    target: "[data-tour='payments-table']",
    placement: "top",
    title: "Tabla de pagos",
    content: "Podés ordenar por cualquier columna haciendo click en el encabezado. El estado muestra si el pago fue aprobado, rechazado o está pendiente.",
  },
]

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Pagos" }

export default async function PaymentsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user!.id)
    .single()

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, mp_payment_id, created_at, user_id, profiles(full_name, avatar_url)")
    .eq("gym_id", profile?.gym_id ?? "")
    .order("created_at", { ascending: false })
    .limit(100) as unknown as { data: PaymentRow[] | null }

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-white leading-tight">Pagos</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Historial de pagos del gimnasio</p>
        </div>
        <PageTour tourKey="payments" steps={PAYMENTS_TOUR_STEPS} />
      </div>

      <div data-tour="payments-table">
        <PaymentsTable payments={payments ?? []} />
      </div>
    </div>
  )
}
