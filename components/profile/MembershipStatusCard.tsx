"use client"

import { useState } from "react"
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Zap, CreditCard, Star, Gem, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Alert } from "@/components/ui/alert"

type MembershipType = "basic" | "premium" | "vip"

interface PlanInfo {
  type: MembershipType
  label: string
  price: number
  duration_days: number
  is_active: boolean
}

interface Props {
  membershipType: MembershipType | null
  expiresAt: string | null
  plans?: PlanInfo[]
}

type Status = "active" | "expiring" | "expired"

const PLAN_LABELS: Record<MembershipType, string> = {
  basic: "Básico",
  premium: "Premium",
  vip: "VIP",
}

const PLAN_ICONS: Record<MembershipType, React.ElementType> = {
  basic: CreditCard,
  premium: Star,
  vip: Gem,
}

const PLAN_COLORS: Record<MembershipType, { color: string; border: string; ring: string; bg: string }> = {
  basic:   { color: "text-zinc-500 dark:text-zinc-300",   border: "border-zinc-300 dark:border-zinc-600",   ring: "ring-zinc-400/40",   bg: "bg-zinc-100 dark:bg-zinc-800/60" },
  premium: { color: "text-amber-600 dark:text-amber-400", border: "border-amber-400 dark:border-amber-500/60", ring: "ring-amber-400/40", bg: "bg-amber-50 dark:bg-amber-950/40" },
  vip:     { color: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500/60", ring: "ring-violet-400/40", bg: "bg-violet-50 dark:bg-violet-950/40" },
}

const STATUS_CONFIG: Record<Status, {
  Icon: React.ElementType
  iconClass: string
  bgClass: string
  labelClass: string
  label: string
}> = {
  active: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-500 dark:text-emerald-400",
    bgClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50",
    labelClass: "text-emerald-600 dark:text-emerald-400",
    label: "Activa",
  },
  expiring: {
    Icon: AlertTriangle,
    iconClass: "text-amber-500 dark:text-amber-400",
    bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50",
    labelClass: "text-amber-600 dark:text-amber-400",
    label: "Por vencer",
  },
  expired: {
    Icon: XCircle,
    iconClass: "text-red-500 dark:text-red-400",
    bgClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50",
    labelClass: "text-red-600 dark:text-red-400",
    label: "Vencida",
  },
}

function getStatus(expiresAt: string | null): { status: Status; daysLeft: number | null } {
  if (!expiresAt) return { status: "expired", daysLeft: null }
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (daysLeft <= 0) return { status: "expired", daysLeft }
  if (daysLeft <= 7) return { status: "expiring", daysLeft }
  return { status: "active", daysLeft }
}

function formatPrice(price: number): string {
  if (price === 0) return "Gratis"
  return "$" + price.toLocaleString("es-AR")
}

function formatDuration(days: number): string {
  if (days === 15)  return "15 días"
  if (days === 30)  return "1 mes"
  if (days === 90)  return "3 meses"
  if (days === 180) return "6 meses"
  if (days === 365) return "1 año"
  return `${days} días`
}

export default function MembershipStatusCard({ membershipType, expiresAt, plans = [] }: Props) {
  const { status, daysLeft } = getStatus(expiresAt)
  const config = STATUS_CONFIG[status]
  const Icon = config.Icon

  const currentType = membershipType ?? "basic"
  const [open, setOpen]           = useState(status !== "active")
  const [selected, setSelected]   = useState<MembershipType>(currentType)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const activePlans = plans.filter(p => p.is_active)
  const selectedPlan = activePlans.find(p => p.type === selected)

  // New expiry after payment: extends from current expiry (if future) or from today
  const newExpiryLabel = (() => {
    if (!selectedPlan) return null
    const base = expiresAt && new Date(expiresAt) > new Date()
      ? new Date(expiresAt)
      : new Date()
    base.setDate(base.getDate() + selectedPlan.duration_days)
    return base.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
  })()

  const expiryLabel = (() => {
    if (!expiresAt) return "Sin fecha de vencimiento"
    if (daysLeft !== null && daysLeft <= 0) return "Venció el " + new Date(expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })
    if (daysLeft === 1) return "Vence mañana"
    if (daysLeft !== null && daysLeft <= 7) return `Vence en ${daysLeft} días`
    return "Vence el " + new Date(expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
  })()

  async function handleCheckout() {
    if (!selectedPlan) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Membresía ${selectedPlan.label || PLAN_LABELS[selected]} — Voltia`,
          amount: selectedPlan.price,
          membership_type: selected,
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
    <div className={cn("rounded-2xl border", config.bgClass)}>
      {/* Status header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-zinc-900/60">
            <Icon aria-hidden className={cn("h-5 w-5", config.iconClass)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {membershipType ? PLAN_LABELS[membershipType] : "Sin plan"}
              </p>
              <span className={cn("text-xs font-medium", config.labelClass)}>
                · {config.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{expiryLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {membershipType === "vip" && (
            <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1">
              <Zap aria-hidden className="h-3 w-3 text-yellow-400" />
              <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">VIP</span>
            </div>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Renovar
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Plan selector — expandable */}
      {open && (
        <div className="border-t border-black/5 dark:border-white/5 px-4 pb-4 pt-3 space-y-3">
          {activePlans.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">
              El gimnasio aún no configuró los planes. Consultá en recepción.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Seleccioná el plan a renovar:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {(["basic", "premium", "vip"] as MembershipType[]).map(type => {
                  const plan = activePlans.find(p => p.type === type)
                  const colors = PLAN_COLORS[type]
                  const PlanIcon = PLAN_ICONS[type]
                  const isSelected = selected === type
                  const disabled = !plan

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setSelected(type)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all space-y-1.5",
                        disabled
                          ? "border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/20 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? `${colors.border} ${colors.bg} ring-2 ${colors.ring} cursor-pointer`
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-600 cursor-pointer",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <PlanIcon className={cn("h-3.5 w-3.5", !disabled && isSelected ? colors.color : "text-zinc-400")} />
                        <span className={cn("text-xs font-bold uppercase tracking-wide", !disabled && isSelected ? colors.color : "text-zinc-500 dark:text-zinc-400")}>
                          {plan?.label || PLAN_LABELS[type]}
                        </span>
                      </div>
                      <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                        {disabled ? "—" : formatPrice(plan!.price)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {disabled ? "No configurado" : formatDuration(plan!.duration_days)}
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && (
                <Alert variant="error">{error}</Alert>
              )}

              {selectedPlan && selectedPlan.price > 0 ? (
                <div className="space-y-2">
                  {newExpiryLabel && (
                    <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                      {expiresAt && new Date(expiresAt) > new Date()
                        ? <>Tu membresía actual se <span className="font-medium text-zinc-700 dark:text-zinc-300">extenderá</span> hasta el <span className="font-medium text-zinc-700 dark:text-zinc-300">{newExpiryLabel}</span>. No perdés los días que te quedan.</>
                        : <>Tu membresía vencerá el <span className="font-medium text-zinc-700 dark:text-zinc-300">{newExpiryLabel}</span>.</>
                      }
                    </p>
                  )}
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw aria-hidden className={cn("h-4 w-4", loading && "animate-spin")} />
                    {loading ? "Redirigiendo…" : `Pagar ${formatPrice(selectedPlan.price)} con MercadoPago`}
                  </button>
                </div>
              ) : selectedPlan && selectedPlan.price === 0 ? (
                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-1">
                  Este plan es gratuito. Hablá con recepción para activarlo.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}
