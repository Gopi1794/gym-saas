"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CreditCard, Calendar, CheckCircle2, AlertCircle, Pencil } from "lucide-react"
import { updateMemberMembership } from "@/app/actions/members"
import { isMembershipActive } from "@/lib/utils"

type MembershipType = "basic" | "premium" | "vip"

interface Props {
  memberId: string
  initialType: MembershipType | null
  initialExpiresAt: string | null
}

const TYPE_LABELS: Record<MembershipType, string> = {
  basic: "Basic",
  premium: "Premium",
  vip: "VIP",
}

const TYPE_CLASSES: Record<MembershipType, string> = {
  basic: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  premium: "bg-brand-700/20 text-brand-400 border border-brand-700/30",
  vip: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function MemberMembershipEdit({ memberId, initialType, initialExpiresAt }: Props) {
  const type = (initialType ?? "basic") as MembershipType
  const [editing, setEditing] = useState(false)
  const [membershipType, setMembershipType] = useState<MembershipType>(type)
  const [expiresAt, setExpiresAt] = useState(
    initialExpiresAt ? initialExpiresAt.split("T")[0] : ""
  )
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const active = isMembershipActive(initialExpiresAt)

  async function handleSave() {
    setLoading(true)
    setFeedback(null)
    const result = await updateMemberMembership({
      memberId,
      membershipType,
      membershipExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Membresía actualizada" })
      setEditing(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Membresía
        </h3>
        <button
          onClick={() => { setEditing(e => !e); setFeedback(null) }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? "Cancelar" : "Editar"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="rounded-xl bg-zinc-800/60 px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <CreditCard className="h-3.5 w-3.5" />
                Tipo
              </div>
              <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${TYPE_CLASSES[type]}`}>
                {TYPE_LABELS[type]}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-800/60 px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                Vence
              </div>
              <p className={`text-sm font-bold ${active ? "text-zinc-100" : "text-red-400"}`}>
                {formatDate(initialExpiresAt)}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Type selector */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <CreditCard className="h-3.5 w-3.5" />
                Tipo de membresía
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["basic", "premium", "vip"] as MembershipType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMembershipType(t)}
                    className={`rounded-xl py-2 text-xs font-semibold transition-all border ${
                      membershipType === t
                        ? TYPE_CLASSES[t] + " ring-1 ring-offset-1 ring-offset-zinc-900 " +
                          (t === "vip" ? "ring-amber-500/50" : t === "premium" ? "ring-brand-500/50" : "ring-zinc-500/50")
                        : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry date */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                Fecha de vencimiento
              </span>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors [color-scheme:dark]"
              />
              {/* Quick shortcuts */}
              <div className="flex gap-2">
                {[
                  { label: "+30 días", days: 30 },
                  { label: "+3 meses", days: 90 },
                  { label: "+1 año", days: 365 },
                ].map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiresAt(addDays(days))}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/40 py-1.5 min-h-[44px] text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
              feedback.kind === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
