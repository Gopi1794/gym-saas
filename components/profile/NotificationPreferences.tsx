"use client"

import { useState } from "react"
import { Bell, Check, Loader2 } from "lucide-react"
import { updateNotificationHour } from "@/app/actions/profile-settings"

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? "AM" : "PM"
  return { value: i, label: `${h}:00 ${ampm}` }
})

interface Props {
  currentHour: number
}

export default function NotificationPreferences({ currentHour }: Props) {
  const [selected, setSelected] = useState(currentHour)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await updateNotificationHour(selected)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800">
          <Bell className="h-4 w-4 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">Notificaciones de membresía</p>
          <p className="text-xs text-zinc-500">Hora en que recibís el aviso de vencimiento</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selected}
          onChange={(e) => { setSelected(Number(e.target.value)); setSaved(false) }}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          aria-label="Hora de notificación"
        >
          {HOURS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          aria-label="Guardar hora de notificación"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="text-xs text-zinc-600">
        Hora Argentina (UTC−3). Recibirás un aviso 3 días antes de que venza tu membresía.
      </p>
    </div>
  )
}
