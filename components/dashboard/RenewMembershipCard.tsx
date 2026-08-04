"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, AlertTriangle, Clock, RefreshCw, X, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { daysUntilAR } from "@/lib/date-ar"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

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

type Tier = "expired" | "urgent" | "preventive"

const TIER_STYLES: Record<Tier, {
  border: string
  bg: string
  icon: typeof AlertCircle
  iconColor: string
  titleColor: string
}> = {
  expired: {
    border: "border-red-800/60",
    bg: "bg-red-950/30",
    icon: AlertCircle,
    iconColor: "text-red-400",
    titleColor: "text-red-300",
  },
  urgent: {
    border: "border-orange-800/60",
    bg: "bg-orange-950/30",
    icon: AlertTriangle,
    iconColor: "text-orange-400",
    titleColor: "text-orange-300",
  },
  preventive: {
    border: "border-amber-800/60",
    bg: "bg-amber-950/20",
    icon: Clock,
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
  },
}

// Sesión (no base de datos): el aviso vuelve a aparecer la próxima vez que
// el socio entra. Se guarda el nivel descartado, no un booleano, para que
// si la urgencia escala (ej. de "preventivo" a "urgente") el aviso
// resurja aunque ya se haya cerrado en un nivel más bajo.
const DISMISS_KEY = "renew-membership-dismissed-tier"

interface Props {
  expiresAt: string | null
  currentType: "basic" | "premium" | "vip" | null
  plans?: DbPlan[]
  // /pagos/renovar ya es una página dedicada, sin nada detrás — fuerza la
  // card inline de siempre en vez del modal, sea cual sea el tier.
  forceInline?: boolean
}

export default function RenewMembershipCard({ expiresAt, currentType, plans = [], forceInline = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const displayPlans: Plan[] = plans.length > 0 ? plans.map(toDisplayPlan) : FALLBACK_PLANS
  const [selected, setSelected] = useState<Plan["key"]>(currentType ?? "basic")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [dismissedTier, setDismissedTier] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const daysLeft = expiresAt ? daysUntilAR(expiresAt) : null
  const tier: Tier = daysLeft === null || daysLeft < 0 ? "expired" : daysLeft <= 1 ? "urgent" : "preventive"
  const isExpired = tier === "expired"
  // Con forceInline (/pagos/renovar) la card nunca es descartable: es el
  // único contenido de esa página, y el descarte va a sessionStorage — al
  // cerrarla no vuelve ni recargando, y ahí no hay nada más para volver a.
  const canDismiss = !isExpired && !forceInline
  const isModal = !forceInline && tier !== "preventive"

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem(DISMISS_KEY)
    } catch {
      // sessionStorage puede fallar en modo privado; el aviso simplemente no se descarta
    }
    setDismissedTier(stored)
    // El modal arranca cerrado (arriba) y recién se abre acá, ya confirmado
    // que no fue descartado esta sesión. Si abriera en true desde el
    // primer render, un socio que ya lo cerró vería el modal animarse
    // abierto y al toque cerrarse de vuelta.
    if (isModal && !(canDismiss && stored === tier)) {
      setModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, canDismiss, isModal])

  function handleDismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, tier)
    } catch {
      // no persiste, pero igual se oculta para esta vista
    }
    setDismissedTier(tier)
  }

  function handleModalOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // expired no tiene forma de cerrarse (ni X, ni Escape, ni click
      // afuera): el pedido de cierre se ignora y el modal se queda abierto.
      if (isExpired) return
      handleDismiss()
    }
    setModalOpen(nextOpen)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (!isModal && canDismiss && dismissedTier === tier) return null

  const style = TIER_STYLES[tier]
  const Icon = style.icon

  async function handleRenew() {
    setLoading(true)
    setError(null)
    const plan = displayPlans.find((p) => p.key === selected)!
    try {
      const res = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Membresía ${plan.label} — Voltia`,
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

  const title =
    tier === "expired" ? "Tu membresía venció" :
    tier === "urgent" ? (daysLeft === 0 ? "Tu membresía vence hoy" : "Tu membresía vence mañana") :
    `Tu membresía vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`

  const subtitle =
    tier === "expired" ? "Renovala para seguir entrenando sin interrupciones." :
    tier === "urgent" ? "Renová ahora para no quedarte sin acceso." :
    "Renová cuando quieras para no tener que pensarlo después."

  const content = (
    <>
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

      {/* Salida de emergencia: el modal expired no tiene X ni se cierra con
          Escape/click afuera. Si el checkout falla (red, gym sin token de
          MP, API caída), el socio queda atrapado sin poder pagar y sin
          poder salir — este botón es la única puerta que le queda. */}
      {isExpired && isModal && (
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 min-h-[44px] text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      )}
    </>
  )

  if (isModal) {
    return (
      <Dialog open={modalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent showCloseButton={!isExpired} className="sm:max-w-md border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Icon aria-hidden className={cn("h-5 w-5 shrink-0", style.iconColor)} />
              <DialogTitle className={style.titleColor}>{title}</DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400">{subtitle}</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className={cn("rounded-2xl border p-4 space-y-4", style.border, style.bg)}>
      {/* Status */}
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} />
        <div className="flex-1">
          <p className={cn("text-sm font-semibold", style.titleColor)}>{title}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        {canDismiss && (
          <button
            onClick={handleDismiss}
            aria-label="Descartar aviso"
            className="shrink-0 -m-1.5 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {content}
    </div>
  )
}
