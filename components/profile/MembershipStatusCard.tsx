"use client"

import { useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const PLAN_LABELS: Record<string, string> = {
  basic: "Básico",
  premium: "Premium",
  vip: "VIP",
}

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 15000,
  premium: 25000,
  vip: 40000,
}

interface Props {
  membershipType: "basic" | "premium" | "vip" | null
  expiresAt: string | null
}

type Status = "active" | "expiring" | "expired"

function getStatus(expiresAt: string | null): { status: Status; daysLeft: number | null } {
  if (!expiresAt) return { status: "expired", daysLeft: null }
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (daysLeft <= 0) return { status: "expired", daysLeft }
  if (daysLeft <= 7) return { status: "expiring", daysLeft }
  return { status: "active", daysLeft }
}

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-950/30 border-emerald-800/50",
    labelClass: "text-emerald-400",
    label: "Activa",
  },
  expiring: {
    icon: AlertTriangle,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-950/20 border-amber-800/50",
    labelClass: "text-amber-400",
    label: "Por vencer",
  },
  expired: {
    icon: XCircle,
    iconClass: "text-red-400",
    bgClass: "bg-red-950/30 border-red-800/50",
    labelClass: "text-red-400",
    label: "Vencida",
  },
}

export default function MembershipStatusCard({ membershipType, expiresAt }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { status, daysLeft } = getStatus(expiresAt)
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const planLabel = membershipType ? PLAN_LABELS[membershipType] : "Sin plan"

  const expiryLabel = (() => {
    if (!expiresAt) return "Sin fecha de vencimiento"
    if (daysLeft !== null && daysLeft <= 0) return "Venció el " + new Date(expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })
    if (daysLeft === 1) return "Vence mañana"
    if (daysLeft !== null && daysLeft <= 7) return `Vence en ${daysLeft} días`
    return "Vence el " + new Date(expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
  })()

  async function handleRenew() {
    if (!membershipType) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Membresía ${planLabel} — GymFlow`,
          amount: PLAN_AMOUNTS[membershipType],
          membership_type: membershipType,
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
    <div className={cn("rounded-2xl border p-4", config.bgClass)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900/60">
            <Icon aria-hidden className={cn("h-5 w-5", config.iconClass)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-100">{planLabel}</p>
              <span className={cn("text-xs font-medium", config.labelClass)}>· {config.label}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{expiryLabel}</p>
          </div>
        </div>

        {/* Badge de plan */}
        {membershipType === "vip" && (
          <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1">
            <Zap aria-hidden className="h-3 w-3 text-yellow-400" />
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">VIP</span>
          </div>
        )}
      </div>

      {/* CTA solo cuando vence pronto o ya venció */}
      {(status === "expiring" || status === "expired") && membershipType && (
        <div className="mt-3 space-y-2">
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleRenew}
            disabled={loading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
              "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
            )}
          >
            <RefreshCw aria-hidden className={cn("h-4 w-4", loading && "animate-spin")} />
            {loading ? "Redirigiendo…" : "Renovar membresía"}
          </button>
        </div>
      )}
    </div>
  )
}
