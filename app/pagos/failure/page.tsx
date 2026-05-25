import type { Metadata } from "next"
import Link from "next/link"
import { XCircle } from "lucide-react"

export const metadata: Metadata = { title: "Pago fallido" }

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: { payment_id?: string; status?: string }
}) {
  return (
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-5">
            <XCircle className="h-16 w-16 text-red-400" strokeWidth={1.5} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-normal tracking-wide text-zinc-50">
            El pago no pudo completarse
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Hubo un problema al procesar tu pago. No se realizó ningún cobro. Podés intentarlo nuevamente o contactar a tu gimnasio.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Posibles causas</p>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Fondos insuficientes en la tarjeta</li>
            <li>• Datos de tarjeta incorrectos</li>
            <li>• El banco rechazó la operación</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm py-3 px-6 transition-colors"
          >
            Intentar nuevamente
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 font-medium text-sm py-3 px-6 transition-colors"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
