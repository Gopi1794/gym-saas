"use client"

import { useState } from "react"
import { Pencil, Check, X } from "lucide-react"
import { updatePaymentNotes } from "@/app/actions/members"

interface Props {
  paymentId: string
  initialNotes: string | null
  editable: boolean
}

export default function PaymentNoteInline({ paymentId, initialNotes, editable }: Props) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await updatePaymentNotes(paymentId, notes)
    setSaving(false)
    if (!res.error) setEditing(false)
  }

  if (!editing) {
    if (!initialNotes && !editable) return null
    return (
      <div className="flex items-start gap-1.5 mt-1">
        <p className="flex-1 text-xs text-muted-foreground">
          {initialNotes || (editable ? "Sin nota" : "")}
        </p>
        {editable && (
          <button
            onClick={() => setEditing(true)}
            aria-label="Editar nota"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-1.5">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        autoFocus
        className="w-full rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs text-foreground focus:border-brand-500/50 focus:outline-none resize-none"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 min-h-[28px] text-xs text-white disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Guardar
        </button>
        <button
          onClick={() => { setEditing(false); setNotes(initialNotes ?? "") }}
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 min-h-[28px] text-xs text-muted-foreground"
        >
          <X className="h-3 w-3" /> Cancelar
        </button>
      </div>
    </div>
  )
}
