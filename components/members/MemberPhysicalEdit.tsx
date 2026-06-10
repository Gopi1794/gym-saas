"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Weight, Ruler, Pencil } from "lucide-react"
import { updateMemberPhysical } from "@/app/actions/members"
import { Alert } from "@/components/ui/alert"

interface Props {
  memberId: string
  initialWeight: number | null
  initialHeight: number | null
}

export default function MemberPhysicalEdit({ memberId, initialWeight, initialHeight }: Props) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(initialWeight?.toString() ?? "")
  const [height, setHeight] = useState(initialHeight?.toString() ?? "")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  async function handleSave() {
    setLoading(true)
    setFeedback(null)
    const result = await updateMemberPhysical({
      memberId,
      weightKg: weight ? parseFloat(weight) : null,
      heightCm: height ? parseInt(height) : null,
    })
    setLoading(false)
    if (result.error) {
      setFeedback({ type: "error", msg: result.error })
    } else {
      setFeedback({ type: "success", msg: "Guardado" })
      setEditing(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const bmi =
    weight && height
      ? (parseFloat(weight) / Math.pow(parseInt(height) / 100, 2)).toFixed(1)
      : null

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Datos físicos
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
            <Stat
              icon={<Weight className="h-4 w-4 text-brand-500" />}
              label="Peso"
              value={initialWeight ? `${initialWeight} kg` : "—"}
            />
            <Stat
              icon={<Ruler className="h-4 w-4 text-brand-500" />}
              label="Talla"
              value={initialHeight ? `${initialHeight} cm` : "—"}
            />
            {bmi && (
              <div className="col-span-2 rounded-xl bg-zinc-800/60 px-4 py-3 text-center">
                <p className="text-xs text-zinc-400 mb-0.5">IMC</p>
                <p className="text-xl font-bold text-zinc-100">{bmi}</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Weight className="h-3.5 w-3.5" />
                  Peso (kg)
                </span>
                <input
                  type="number"
                  min="20"
                  max="300"
                  step="0.1"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="70.5"
                  className="w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Ruler className="h-3.5 w-3.5" />
                  Talla (cm)
                </span>
                <input
                  type="number"
                  min="100"
                  max="250"
                  step="1"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                  placeholder="175"
                  className="w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
              </label>
            </div>

            {weight && height && (
              <p className="text-xs text-zinc-500 text-center">
                IMC calculado:{" "}
                <span className="font-semibold text-zinc-300">
                  {(parseFloat(weight) / Math.pow(parseInt(height) / 100, 2)).toFixed(1)}
                </span>
              </p>
            )}

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
          >
            <Alert variant={feedback.type === "success" ? "success" : "error"}>
              {feedback.msg}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-800/60 px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-zinc-100">{value}</p>
    </div>
  )
}
