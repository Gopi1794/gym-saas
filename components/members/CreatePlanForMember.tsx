"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

interface CreatePlanForMemberProps {
  memberId: string
  memberName: string
  trainerId: string
  gymId: string
}

export default function CreatePlanForMember({ memberId, memberName, trainerId, gymId }: CreatePlanForMemberProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`Plan de ${memberName}`)
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from("workout_plans")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        is_template: false,
        gym_id: gymId,
        created_by: trainerId,
        assigned_to: memberId,
      })
      .select("id")
      .single() as unknown as { data: { id: string } | null; error: unknown }

    setLoading(false)
    if (!error && data) {
      router.push(`/planes/${data.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-700 hover:bg-brand-800 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Crear plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Nuevo plan para {memberName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Nombre *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1 border-zinc-700 text-zinc-400" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="flex-1 bg-brand-700 hover:bg-brand-800 text-white">
              {loading ? "Creando…" : "Crear y editar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
