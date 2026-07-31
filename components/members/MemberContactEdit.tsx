"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Phone, User2, Target, Activity, AlertTriangle, Pencil } from "lucide-react"
import { sileo } from "sileo"
import { updateMemberContact } from "@/app/actions/members"

type Gender = "male" | "female" | "other"
type Goal = "lose_weight" | "gain_muscle" | "performance" | "maintain"
type Frequency = "never" | "1-2" | "3-4" | "5+"

const GENDER_LABELS: Record<Gender, string> = { male: "Hombre", female: "Mujer", other: "Otro" }
const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: "Perder peso", gain_muscle: "Ganar músculo", performance: "Rendimiento", maintain: "Mantenerme",
}
const FREQUENCY_LABELS: Record<Frequency, string> = {
  never: "Nunca", "1-2": "1-2 / sem", "3-4": "3-4 / sem", "5+": "5+ / sem",
}

interface Props {
  memberId: string
  initialDateOfBirth: string | null
  initialPhone: string | null
  initialGender: Gender | null
  initialGoal: Goal | null
  initialTrainingFrequency: Frequency | null
  initialEmergencyName: string | null
  initialEmergencyPhone: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

const selectCls = "w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
const inputCls = selectCls + " placeholder-zinc-600"

export default function MemberContactEdit({
  memberId, initialDateOfBirth, initialPhone, initialGender, initialGoal,
  initialTrainingFrequency, initialEmergencyName, initialEmergencyPhone,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "")
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "")
  const [goal, setGoal] = useState<Goal | "">(initialGoal ?? "")
  const [trainingFrequency, setTrainingFrequency] = useState<Frequency | "">(initialTrainingFrequency ?? "")
  const [emergencyName, setEmergencyName] = useState(initialEmergencyName ?? "")
  const [emergencyPhone, setEmergencyPhone] = useState(initialEmergencyPhone ?? "")
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const result = await updateMemberContact({
        memberId,
        dateOfBirth: dateOfBirth || null,
        phone: phone || null,
        gender: gender || null,
        goal: goal || null,
        trainingFrequency: trainingFrequency || null,
        emergencyName: emergencyName || null,
        emergencyPhone: emergencyPhone || null,
      })
      if ("error" in result) {
        sileo.error({ title: "No se pudo guardar", description: result.error, duration: 4000 })
        return
      }
      sileo.success({ title: "Datos de contacto guardados", description: "La ficha del socio ya está actualizada.", duration: 3000 })
      setEditing(false)
      router.refresh()
    } catch {
      sileo.error({ title: "No se pudo guardar", description: "Revisá tu conexión e intentá de nuevo.", duration: 4000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Datos de contacto
        </h3>
        <button
          onClick={() => setEditing(e => !e)}
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
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <Stat icon={<Phone className="h-4 w-4 text-brand-500" />} label="Teléfono" value={initialPhone ?? "—"} />
            <Stat icon={<Calendar className="h-4 w-4 text-brand-500" />} label="Nacimiento"
              value={initialDateOfBirth ? formatDate(initialDateOfBirth) : "—"} />
            <Stat icon={<User2 className="h-4 w-4 text-brand-500" />} label="Género"
              value={initialGender ? (GENDER_LABELS[initialGender] ?? initialGender) : "—"} />
            <Stat icon={<Target className="h-4 w-4 text-brand-500" />} label="Objetivo"
              value={initialGoal ? (GOAL_LABELS[initialGoal] ?? initialGoal) : "—"} />
            <Stat icon={<Activity className="h-4 w-4 text-brand-500" />} label="Frecuencia"
              value={initialTrainingFrequency ? (FREQUENCY_LABELS[initialTrainingFrequency] ?? initialTrainingFrequency) : "—"} />
            <Stat icon={<AlertTriangle className="h-4 w-4 text-brand-500" />} label="Emergencia"
              value={initialEmergencyName ? `${initialEmergencyName}${initialEmergencyPhone ? ` · ${initialEmergencyPhone}` : ""}` : "—"} />
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
                  <Calendar className="h-3.5 w-3.5" />
                  Nacimiento
                </span>
                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Phone className="h-3.5 w-3.5" />
                  Teléfono
                </span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 11 1234-5678" className={inputCls} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <User2 className="h-3.5 w-3.5" />
                  Género
                </span>
                <select value={gender} onChange={e => setGender(e.target.value as Gender | "")} className={selectCls}>
                  <option value="">Sin especificar</option>
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Target className="h-3.5 w-3.5" />
                  Objetivo
                </span>
                <select value={goal} onChange={e => setGoal(e.target.value as Goal | "")} className={selectCls}>
                  <option value="">Sin especificar</option>
                  <option value="lose_weight">Perder peso</option>
                  <option value="gain_muscle">Ganar músculo</option>
                  <option value="performance">Rendimiento</option>
                  <option value="maintain">Mantenerme</option>
                </select>
              </label>
            </div>

            <label className="space-y-1.5 block">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Activity className="h-3.5 w-3.5" />
                Frecuencia de entrenamiento
              </span>
              <select value={trainingFrequency} onChange={e => setTrainingFrequency(e.target.value as Frequency | "")} className={selectCls}>
                <option value="">Sin especificar</option>
                <option value="never">Nunca</option>
                <option value="1-2">1-2 / sem</option>
                <option value="3-4">3-4 / sem</option>
                <option value="5+">5+ / sem</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Contacto de emergencia
                </span>
                <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Nombre" className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400 opacity-0" aria-hidden="true">·</span>
                <input
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="Teléfono"
                  aria-label="Teléfono de emergencia"
                  className={inputCls}
                />
              </label>
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
      <p className="text-sm font-medium text-zinc-100 truncate">{value}</p>
    </div>
  )
}
