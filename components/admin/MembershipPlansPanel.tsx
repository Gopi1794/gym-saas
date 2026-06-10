"use client"

import { useState } from "react"
import {
  Plus, X, Pencil,
  Clock, DollarSign, CreditCard, Star, Gem,
} from "lucide-react"
import { saveMembershipPlan, type MembershipPlanInput } from "@/app/actions/membership-plans"
import { cn } from "@/lib/utils"
import { Alert } from "@/components/ui/alert"

type PlanType = "basic" | "premium" | "vip"

interface PlanRow {
  id: string
  type: PlanType
  label: string
  price: number
  duration_days: number
  features: string[]
  is_active: boolean
}

interface Props {
  initialPlans: PlanRow[]
  memberCounts?: Record<PlanType, number>
}

const TYPE_META: Record<PlanType, {
  defaultLabel: string
  color: string
  border: string
  shadow: string
  lightBg: string
  darkBg: string
  progressColor: string
  ring: string
  activeBorder: string
  Icon: React.ElementType
}> = {
  basic: {
    defaultLabel: "Basic",
    color: "text-zinc-500 dark:text-zinc-300",
    border: "border-zinc-200 dark:border-zinc-600/50",
    shadow: "shadow-md dark:shadow-xl dark:shadow-zinc-500/10",
    lightBg: "from-zinc-100 to-white",
    darkBg: "from-zinc-800/50 to-zinc-900/10",
    progressColor: "bg-zinc-400",
    ring: "ring-zinc-500/30",
    activeBorder: "border-zinc-400 dark:border-zinc-600/50",
    Icon: CreditCard,
  },
  premium: {
    defaultLabel: "Premium",
    color: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-500/40",
    shadow: "shadow-md dark:shadow-xl dark:shadow-amber-500/20",
    lightBg: "from-amber-50 to-white",
    darkBg: "from-amber-950/40 to-zinc-900/10",
    progressColor: "bg-amber-400",
    ring: "ring-amber-500/40",
    activeBorder: "border-amber-400 dark:border-amber-500/40",
    Icon: Star,
  },
  vip: {
    defaultLabel: "VIP",
    color: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-500/40",
    shadow: "shadow-md dark:shadow-xl dark:shadow-violet-500/20",
    lightBg: "from-violet-50 to-white",
    darkBg: "from-violet-950/40 to-zinc-900/10",
    progressColor: "bg-violet-400",
    ring: "ring-violet-500/40",
    activeBorder: "border-violet-400 dark:border-violet-500/40",
    Icon: Gem,
  },
}

const DURATION_PRESETS = [
  { label: "15 días", days: 15 },
  { label: "30 días", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "6 meses", days: 180 },
  { label: "1 año",   days: 365 },
]

const ORDER: PlanType[] = ["basic", "premium", "vip"]

function durationLabel(days: number): string {
  if (days === 15)  return "15 días"
  if (days === 30)  return "1 mes"
  if (days === 90)  return "3 meses"
  if (days === 180) return "6 meses"
  if (days === 365) return "1 año"
  return `${days} días`
}

function defaultPlan(type: PlanType): PlanRow {
  return { id: "", type, label: TYPE_META[type].defaultLabel, price: 0, duration_days: 30, features: [], is_active: true }
}

function PlanCard({
  plan, memberCount, totalMembers, onSaved,
}: {
  plan: PlanRow
  memberCount: number
  totalMembers: number
  onSaved: (updated: PlanRow) => void
}) {
  const meta = TYPE_META[plan.type]
  const [editing, setEditing]           = useState(false)
  const [label, setLabel]               = useState(plan.label || meta.defaultLabel)
  const [price, setPrice]               = useState(String(plan.price))
  const [durationDays, setDurationDays] = useState(plan.duration_days)
  const [features, setFeatures]         = useState<string[]>(plan.features)
  const [newFeature, setNewFeature]     = useState("")
  const [isActive, setIsActive]         = useState(plan.is_active)
  const [loading, setLoading]           = useState(false)
  const [feedback, setFeedback]         = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const pct = totalMembers > 0 ? Math.round((memberCount / totalMembers) * 100) : 0

  function addFeature() {
    const trimmed = newFeature.trim()
    if (!trimmed || features.includes(trimmed)) return
    setFeatures(prev => [...prev, trimmed])
    setNewFeature("")
  }

  function removeFeature(i: number) {
    setFeatures(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setFeedback({ kind: "error", msg: "Precio inválido" }); return }
    setLoading(true)
    setFeedback(null)
    const input: MembershipPlanInput = {
      type: plan.type,
      label: label.trim() || meta.defaultLabel,
      price: priceNum,
      duration_days: durationDays,
      features,
      is_active: isActive,
    }
    const res = await saveMembershipPlan(input)
    setLoading(false)
    if (res.error) {
      setFeedback({ kind: "error", msg: res.error })
    } else {
      setFeedback({ kind: "success", msg: "Plan guardado" })
      setEditing(false)
      onSaved({ ...plan, ...input })
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <div className={cn(
      "relative rounded-2xl border overflow-hidden transition-all bg-white dark:bg-zinc-900/40",
      meta.border,
      meta.shadow,
    )}>
      {/* Gradient tint light mode */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br pointer-events-none dark:hidden",
        meta.lightBg,
      )} />
      {/* Gradient tint dark mode */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br pointer-events-none hidden dark:block",
        meta.darkBg,
      )} />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <meta.Icon className={cn("h-4 w-4", meta.color)} />
            <span className={cn("text-sm font-bold uppercase tracking-widest", meta.color)}>
              {label}
            </span>
            {!plan.is_active && !editing && (
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                Inactivo
              </span>
            )}
          </div>
          <button
            onClick={() => { setEditing(e => !e); setFeedback(null) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>

        {!editing ? (
          <div className="space-y-4">
            {/* Price */}
            <div>
              <div className="flex items-baseline gap-1">
                <DollarSign className="h-4 w-4 text-zinc-400 mb-0.5 shrink-0" />
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                  {plan.price === 0 ? "Gratis" : Number(plan.price).toLocaleString("es-AR")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                <Clock className="h-3 w-3" />
                {durationLabel(plan.duration_days)}
              </div>
            </div>

            {/* Features */}
            {features.length > 0 ? (
              <ul className="space-y-1.5">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      meta.color.replace("text-", "bg-").split(" ")[0],
                    )} />
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400">Sin beneficios configurados</p>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-zinc-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span>Suscripciones activas: {memberCount}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={cn("h-1 rounded-full transition-all duration-700", meta.progressColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">Nombre del plan</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">Precio (ARS)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 py-2 pl-7 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">Duración</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setDurationDays(p.days)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      durationDays === p.days
                        ? `${meta.activeBorder} ${meta.color} ring-1 ${meta.ring}`
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">Beneficios incluidos</label>
              <div className="flex gap-2">
                <input
                  value={newFeature}
                  onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  placeholder="Ej: Acceso a todas las máquinas"
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {features.length > 0 && (
                <ul className="space-y-1.5">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{f}</span>
                      <button
                        type="button"
                        onClick={() => removeFeature(i)}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setIsActive(a => !a)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                  isActive ? "bg-brand-600" : "bg-zinc-300 dark:bg-zinc-700",
                )}
              >
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0.5",
                )} />
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Plan activo</span>
            </label>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? "Guardando…" : "Guardar plan"}
            </button>
          </div>
        )}

        {feedback && (
          <Alert variant={feedback.kind === "success" ? "success" : "error"}>
            {feedback.msg}
          </Alert>
        )}
      </div>
    </div>
  )
}

export default function MembershipPlansPanel({ initialPlans, memberCounts }: Props) {
  const [plans, setPlans] = useState<PlanRow[]>(() =>
    ORDER.map(type => initialPlans.find(p => p.type === type) ?? defaultPlan(type))
  )

  const counts = memberCounts ?? { basic: 0, premium: 0, vip: 0 }
  const total = counts.basic + counts.premium + counts.vip

  function handleSaved(updated: PlanRow) {
    setPlans(prev => prev.map(p => p.type === updated.type ? updated : p))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configurá el precio, duración y beneficios de cada tipo de membresía. Los cambios se aplican al momento de asignar o renovar.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map(plan => (
          <PlanCard
            key={plan.type}
            plan={plan}
            memberCount={counts[plan.type]}
            totalMembers={total}
            onSaved={handleSaved}
          />
        ))}
      </div>
    </div>
  )
}
