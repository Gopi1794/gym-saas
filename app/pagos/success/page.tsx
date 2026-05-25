import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import LottiePlayer from "@/components/ui/lottie-player"

export const metadata: Metadata = { title: "Pago exitoso" }

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { payment_id?: string; external_reference?: string; status?: string }
}) {
  const paymentId = searchParams.payment_id

  return (
    <div className="relative min-h-dvh bg-zinc-950 flex items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0 z-0">
        <LottiePlayer
          src="/animations/Confetti_Purple.lottie"
          autoplay
          loop={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="relative z-10 w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-500/10 p-5">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" strokeWidth={1.5} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-normal tracking-wide text-zinc-50">
            ¡Pago exitoso!
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Tu membresía fue activada correctamente. Ya podés acceder a todas las funciones del gimnasio.
          </p>
          {paymentId && (
            <p className="text-zinc-600 text-xs">
              Referencia: #{paymentId}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">¿Qué sigue?</p>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Tu membresía ya está activa</li>
            <li>• Podés registrar tu asistencia con QR</li>
            <li>• Tu plan de entrenamiento está disponible</li>
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
