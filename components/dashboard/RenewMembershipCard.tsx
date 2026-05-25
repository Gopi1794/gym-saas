"use client"

import { useState } from "react"
import { AlertCircle, Clock, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface DbPlan {
  type: "basic" | "premium" | "vip"
  label: string
  price: number
  duration_days: number
  features: string[]
}

interface Plan {
  key: "basic" | "premium" | "vip"
  label: string
  amount: number
  description: string
}

const FALLBACK_PLANS: Plan[] = [
  { key: "basic",   label: "Básico",   amount: 15000, description: "Acceso libre" },
  { key: "premium", label: "Premium",  amount: 25000, description: "Acceso + clases" },
  { key: "vip",     label: "VIP",      amount: 40000, description: "Todo incluido" },
]

function toDisplayPlan(p: DbPlan): Plan {
  return {
    key: p.type,
    label: p.label,
    amount: p.price,
    description: p.features[0] ?? p.label,
  }
}

interface Props {
  expiresAt: string | null
  currentType: "basic" | "premium" | "vip" | null
  plans?: DbPlan[]
}

export default function RenewMembershipCard({ expiresAt, currentType, plans = [] }: Props) {
  const displayPlans: Plan[] = plans.length > 0 ? plans.map(toDisplayPlan) : FALLBACK_PLANS
  const [selected, setSelected] = useState<Plan["key"]>(currentType ?? "basic")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isExpired = !expiresAt || new Date(expiresAt) < new Date()
  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null

  async function handleRenew() {
    setLoading(true)
    setError(null)
    const plan = displayPlans.find((p) => p.key === selected)!
    try {
      const res = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Membresía ${plan.label} — GymFlow`,
          amount: plan.amount,
          membership_type: plan.key,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al iniciar el pago")
      window.location.href = data.checkout_url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
      setLoading(false)
    }
  }

  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-4",
      isExpired
        ? "border-red-800/60 bg-red-950/30"
        : "border-amber-800/60 bg-amber-950/20"
    )}>
      {/* Status */}
      <div className="flex items-start gap-3">
        {isExpired ? (
          <AlertCircle aria-hidden className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
        ) : (
          <Clock aria-hidden className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
        )}
        <div>
          <p className={cn(
            "text-sm font-semibold",
            isExpired ? "text-red-300" : "text-amber-300"
          )}>
            {isExpired ? "Tu membresía venció" : `Tu membresía vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isExpired
              ? "Renovala para seguir entrenando sin interrupciones."
              : "Renová ahora para no perder el acceso."}
          </p>
        </div>
      </div>

      {/* Plan selector */}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Seleccionar plan">
        {displayPlans.map((plan) => (
          <button
            key={plan.key}
            role="radio"
            aria-checked={selected === plan.key}
            onClick={() => setSelected(plan.key)}
            className={cn(
              "min-h-[44px] rounded-xl border p-2.5 text-left transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
              selected === plan.key
                ? "border-brand-500 bg-brand-700/20"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            )}
          >
            <p className={cn(
              "text-xs font-semibold",
              selected === plan.key ? "text-brand-400" : "text-zinc-300"
            )}>
              {plan.label}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{plan.description}</p>
            <p className={cn(
              "text-sm font-bold mt-1.5 tabular-nums",
              selected === plan.key ? "text-zinc-100" : "text-zinc-400"
            )}>
              ${plan.amount.toLocaleString("es-AR")}
            </p>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="text-xs text-red-400">{error}</p>
      )}

      {/* CTA */}
      <button
        onClick={handleRenew}
        disabled={loading}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-colors",
          "hover:bg-red-500 disabled:opacity-50 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        )}
      >
        <RefreshCw aria-hidden className={cn("h-4 w-4", loading && "animate-spin")} />
        {loading ? "Redirigiendo a MercadoPago…" : "Renovar membresía"}
      </button>
    </div>
  )
}
