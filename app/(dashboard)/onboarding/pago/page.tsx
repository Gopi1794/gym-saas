"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Dumbbell, CheckCircle2 } from "lucide-react"

export default function SaasPaymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)

    const res = await fetch("/api/mp/saas-checkout", { method: "POST" })
    const data = await res.json()

    if (!res.ok || !data.checkout_url) {
      setError(data.error ?? "Error al iniciar el pago")
      setLoading(false)
      return
    }

    window.location.href = data.checkout_url
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700/20 border border-brand-700/30">
            <Dumbbell className="h-8 w-8 text-brand-500" />
          </div>
          <h1 className="font-display text-3xl text-zinc-50">Activá tu gym</h1>
          <p className="mt-2 text-zinc-400">Tu gimnasio está listo. Solo falta confirmar la suscripción.</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-heading text-sm uppercase tracking-wider text-zinc-400">Plan</span>
            <span className="text-sm font-semibold text-zinc-200">Mensual</span>
          </div>

          <div className="flex items-end gap-1 mb-6">
            <span className="text-4xl font-bold text-zinc-50">$100</span>
            <span className="mb-1 text-zinc-500">/mes</span>
          </div>

          <ul className="space-y-2.5">
            {[
              "Miembros ilimitados",
              "Pagos online con Mercado Pago",
              "Check-in con QR",
              "Planes de entrenamiento",
              "Reportes y métricas",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(213,0,0,0.3)] transition-all active:scale-[0.97] disabled:opacity-60"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirigiendo a Mercado Pago…</>
            : "Pagar con Mercado Pago"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Pago seguro procesado por Mercado Pago
        </p>

        {process.env.NODE_ENV !== "production" && (
          <button
            onClick={async () => {
              setLoading(true)
              setError(null)
              const res = await fetch("/api/dev/activate-gym", { method: "POST" })
              const data = await res.json()
              if (!res.ok) { setError(data.error); setLoading(false); return }
              router.push("/dashboard")
              router.refresh()
            }}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-zinc-700 py-3 text-sm font-semibold text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40"
          >
            [DEV] Simular pago aprobado
          </button>
        )}
      </div>
    </div>
  )
}
