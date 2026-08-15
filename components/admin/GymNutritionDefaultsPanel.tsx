"use client"

import { useState, useEffect } from "react"
import { sileo } from "sileo"
import { getGymNutritionDefaults, saveGymNutritionDefaults } from "@/app/actions/nutrition"
import type { GymNutritionDefaults } from "@/app/actions/nutrition"

interface Props { gymId: string }

type Row = { key: keyof Omit<GymNutritionDefaults, "gym_id">; label: string; unit: string }

const PCT_ROWS: Row[] = [
  { key: "volumen_pct",          label: "Volumen — ajuste",          unit: "%" },
  { key: "rendimiento_pct",      label: "Rendimiento — ajuste",      unit: "%" },
  { key: "perdida_moderada_pct", label: "Pérdida moderada — ajuste", unit: "%" },
  { key: "definicion_pct",       label: "Definición — ajuste",       unit: "%" },
]

const PROTEIN_ROWS: Row[] = [
  { key: "volumen_protein",          label: "Volumen — proteína",          unit: "g/kg" },
  { key: "rendimiento_protein",      label: "Rendimiento — proteína",      unit: "g/kg" },
  { key: "mantenimiento_protein",    label: "Mantenimiento — proteína",    unit: "g/kg" },
  { key: "recomposicion_protein",    label: "Recomposición — proteína",    unit: "g/kg" },
  { key: "perdida_moderada_protein", label: "Pérdida moderada — proteína", unit: "g/kg" },
  { key: "definicion_protein",       label: "Definición — proteína",       unit: "g/kg" },
]

export default function GymNutritionDefaultsPanel({ gymId }: Props) {
  const [defaults, setDefaults] = useState<GymNutritionDefaults | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGymNutritionDefaults(gymId).then(setDefaults)
  }, [gymId])

  function setField(key: Row["key"], value: number) {
    setDefaults(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function handleSave() {
    if (!defaults) return
    setSaving(true)
    try {
      const { gym_id: _gym_id, ...updates } = defaults
      const result = await saveGymNutritionDefaults(gymId, updates)
      if ("error" in result) {
        sileo.error({ title: "No se pudo guardar", description: result.error, duration: 4000 })
        return
      }
      sileo.success({ title: "Valores guardados", description: "Los nuevos planes van a usar estos defaults.", duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  if (!defaults) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ajuste calórico por objetivo</p>
        <p className="mb-4 text-xs text-zinc-500">
          Punto de partida al crear un plan — el trainer puede cambiarlo para un socio puntual sin afectar esta configuración.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PCT_ROWS.map(row => (
            <div key={row.key}>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">{row.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" step="1"
                  value={defaults[row.key]}
                  onChange={e => setField(row.key, Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-xs text-zinc-500">{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Proteína por objetivo</p>
        <p className="mb-4 text-xs text-zinc-500">Gramos de proteína por kilo de peso corporal.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PROTEIN_ROWS.map(row => (
            <div key={row.key}>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">{row.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" step="0.1"
                  value={defaults[row.key]}
                  onChange={e => setField(row.key, Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-xs text-zinc-500">{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  )
}
