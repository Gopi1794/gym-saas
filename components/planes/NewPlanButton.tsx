"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

type Member = { id: string; full_name: string | null }

interface NewPlanButtonProps {
  trainerId: string
  gymId: string
  members?: Member[]
  defaultMode?: "template" | "member"
}

const LEVELS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
]

export default function NewPlanButton({ trainerId, gymId, members = [], defaultMode = "template" }: NewPlanButtonProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"template" | "member">(defaultMode)

  useEffect(() => { setMode(defaultMode) }, [defaultMode])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [level, setLevel] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function resetForm() {
    setName("")
    setDescription("")
    setLevel(null)
    setAssignedTo("")
    setMode("template")
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (mode === "member" && !assignedTo) return
    setLoading(true)

    const { data, error } = await (supabase
      .from("workout_plans" as never)
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        is_template: mode === "template",
        gym_id: gymId,
        created_by: trainerId,
        level,
        assigned_to: mode === "member" ? assignedTo : null,
      } as never)
      .select("id")
      .single() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

    setLoading(false)
    if (!error && data) {
      setOpen(false)
      resetForm()
      router.push(`/planes/${data.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Nuevo plan</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {/* Mode selector */}
          {members.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("template")}
                className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                  mode === "template"
                    ? "border-brand-500 bg-brand-700/20 text-brand-400"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                Plantilla base
              </button>
              <button
                type="button"
                onClick={() => setMode("member")}
                className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                  mode === "member"
                    ? "border-brand-500 bg-brand-700/20 text-brand-400"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                Para un miembro
              </button>
            </div>
          )}

          {/* Member selector */}
          {mode === "member" && (
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Miembro *</label>
              <select
                required
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              >
                <option value="">Seleccioná un miembro…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? "Sin nombre"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Nombre *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Full body avanzado"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Nivel</label>
            <div className="flex gap-2">
              {LEVELS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(level === opt.value ? null : opt.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    level === opt.value
                      ? "border-brand-700 bg-brand-700/20 text-brand-400"
                      : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                mode === "member"
                  ? "Notas sobre el plan de este miembro…"
                  : "Para qué tipo de cliente es esta plantilla…"
              }
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-400"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || (mode === "member" && !assignedTo)}
              className="flex-1 bg-brand-700 hover:bg-brand-800 text-white"
            >
              {loading ? "Creando…" : "Crear y editar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
