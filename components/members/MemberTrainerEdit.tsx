"use client"

import { useState } from "react"
import { UserCheck, Pencil, X } from "lucide-react"
import { assignTrainer } from "@/app/actions/members"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert } from "@/components/ui/alert"

interface TrainerOption {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface Props {
  memberId: string
  initialTrainerId: string | null
  trainers: TrainerOption[]
}

export default function MemberTrainerEdit({ memberId, initialTrainerId, trainers }: Props) {
  const [editing, setEditing]   = useState(false)
  const [selected, setSelected] = useState<string | null>(initialTrainerId)
  const [loading, setLoading]   = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const current = trainers.find(t => t.id === selected)

  async function handleSave(newId: string | null) {
    setLoading(true)
    setFeedback(null)
    const result = await assignTrainer(memberId, newId)
    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setSelected(newId)
      setFeedback({ kind: "success", msg: newId ? "Trainer asignado" : "Trainer removido" })
      setEditing(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Trainer asignado</h3>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setFeedback(null) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            {current ? "Cambiar" : "Asignar"}
          </button>
        )}
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      {!editing ? (
        current ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={current.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{current.full_name?.[0] ?? "T"}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium text-foreground">{current.full_name ?? "Sin nombre"}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-1">Sin trainer asignado</p>
        )
      ) : (
        <div className="space-y-2">
          {trainers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No hay trainers en este gimnasio.</p>
          ) : (
            <>
              {trainers.map(t => (
                <button
                  key={t.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSave(t.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-all border ${
                    selected === t.id
                      ? "border-brand-500/40 bg-brand-500/10 text-foreground"
                      : "border-border bg-muted/30 text-foreground hover:bg-muted/60"
                  } disabled:opacity-50`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={t.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{t.full_name?.[0] ?? "T"}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1">{t.full_name ?? "Sin nombre"}</span>
                  {selected === t.id && <UserCheck className="h-4 w-4 text-brand-500 shrink-0" />}
                </button>
              ))}

              {selected && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSave(null)}
                  className="w-full flex items-center gap-2 rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/5 border border-dashed border-border transition-colors disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Quitar trainer
                </button>
              )}
            </>
          )}
        </div>
      )}

      {feedback && (
        <Alert variant={feedback.kind === "success" ? "success" : "error"}>
          {feedback.msg}
        </Alert>
      )}
    </div>
  )
}
