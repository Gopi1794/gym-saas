"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, Wallet, Landmark } from "lucide-react"
import { collectMembershipPayment } from "@/app/actions/members"
import { Alert } from "@/components/ui/alert"

type MembershipType = "basic" | "premium" | "vip"
type Method = "cash" | "mercadopago"

interface PlanInfo {
  type: MembershipType
  price: number
}

interface Props {
  memberId: string
  plans: PlanInfo[]
}

const TYPE_LABELS: Record<MembershipType, string> = {
  basic: "Basic",
  premium: "Premium",
  vip: "VIP",
}

// A diferencia de MemberMembershipEdit (admin-only, edición libre de tipo +
// fecha), este formulario nunca pide fecha ni monto a mano — siempre sale
// server-side del plan elegido (ver collectMembershipPayment). Solo recibe
// planes ya filtrados a price > 0 && is_active desde el caller.
export default function MemberCollectPayment({ memberId, plans }: Props) {
  const [open, setOpen] = useState(false)
  const [membershipType, setMembershipType] = useState<MembershipType | null>(plans[0]?.type ?? null)
  const [method, setMethod] = useState<Method>("cash")
  const [mpReference, setMpReference] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const selectedPlan = plans.find(p => p.type === membershipType) ?? null

  async function handleSubmit() {
    if (!membershipType) return
    setLoading(true)
    setFeedback(null)
    const result = await collectMembershipPayment({
      memberId,
      membershipType,
      method,
      mpReference: method === "mercadopago" ? mpReference : null,
      notes,
    })
    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Pago registrado y membresía renovada" })
      setMpReference("")
      setNotes("")
      setTimeout(() => { setFeedback(null); setOpen(false) }, 2000)
    }
  }

  if (plans.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Cobrar y renovar
        </h3>
        <button
          onClick={() => { setOpen(o => !o); setFeedback(null) }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <DollarSign className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Cobrar"}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Plan selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Plan</span>
              <div className={`grid gap-2 ${plans.length === 1 ? "grid-cols-1" : plans.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {plans.map((plan) => (
                  <button
                    key={plan.type}
                    type="button"
                    onClick={() => setMembershipType(plan.type)}
                    className={`rounded-xl py-2 px-1 text-xs font-semibold transition-all border flex flex-col items-center gap-0.5 ${
                      membershipType === plan.type
                        ? "border-brand-500/50 bg-brand-700/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/50"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{TYPE_LABELS[plan.type]}</span>
                    <span className="text-[10px] font-normal opacity-70">
                      ${Number(plan.price).toLocaleString("es-AR")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Method selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Método de pago</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("cash")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 min-h-[44px] text-xs font-semibold border transition-all ${
                    method === "cash"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/50"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" /> Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("mercadopago")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 min-h-[44px] text-xs font-semibold border transition-all ${
                    method === "mercadopago"
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/50"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Landmark className="h-3.5 w-3.5" /> MercadoPago
                </button>
              </div>
            </div>

            {method === "mercadopago" && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Nº de operación (opcional)</span>
                <input
                  type="text"
                  value={mpReference}
                  onChange={e => setMpReference(e.target.value)}
                  placeholder="Si lo tenés, evita cargar el mismo pago dos veces"
                  className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Cualquier dato importante sobre este pago"
                className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !membershipType}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Cobrando…" : selectedPlan ? `Cobrar $${Number(selectedPlan.price).toLocaleString("es-AR")}` : "Cobrar"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <Alert variant={feedback.kind === "success" ? "success" : "error"}>
              {feedback.msg}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
