import type { Metadata } from "next"
import Link from "next/link"
import { Clock } from "lucide-react"

export const metadata: Metadata = { title: "Pago en proceso" }

export default async function PaymentPendingPage({
  searchParams,
}: {
  searchParams: { payment_id?: string; status?: string }
}) {
  const paymentId = searchParams.payment_id

  return (
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-500/10 p-5">
            <Clock className="h-16 w-16 text-amber-400" strokeWidth={1.5} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-normal tracking-wide text-zinc-50">
            Pago en proceso
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Tu pago está siendo procesado. Esto puede demorar unos minutos. Te avisaremos cuando se confirme.
          </p>
          {paymentId && (
            <p className="text-zinc-600 text-xs">
              Referencia: #{paymentId}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">¿Qué significa esto?</p>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• El pago fue iniciado pero aún no se confirmó</li>
            <li>• Tu membresía se activará automáticamente al aprobarse</li>
            <li>• Podés revisar el estado en tu dashboard</li>
          </ul>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm py-3 px-6 transition-colors"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
