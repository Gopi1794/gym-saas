"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

type Member = { id: string; full_name: string | null }

interface Props {
  templateId: string
  members: Member[]
}

// clone_workout_plan_for_member es SECURITY INVOKER — corre con los
// permisos del trainer que llama, las RLS de workout_plans y compañía ya
// permiten SELECT de templates e INSERT en las 4 tablas para admin/trainer
// del mismo gym, así que no hace falta Server Action ni cliente admin acá
// (mismo patrón directo que ya usa NewPlanButton con .insert()).
export default function AssignTemplateButton({ templateId, members }: Props) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState(members[0]?.id ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId) return
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await (supabase.rpc("clone_workout_plan_for_member" as never, {
      p_template_id: templateId,
      p_member_id: memberId,
    } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

    if (rpcError) {
      setLoading(false)
      setError(rpcError.message)
      return
    }

    setOpen(false)
    router.push(`/planes/${data}`)
  }

  if (members.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full border-zinc-700 text-zinc-400 hover:text-zinc-100"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Asignar a miembro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Asignar plantilla</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAssign} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Miembro *</label>
            <select
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? "Sin nombre"}
                </option>
              ))}
            </select>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <Button
            type="submit"
            disabled={loading || !memberId}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white"
          >
            {loading ? "Asignando…" : "Asignar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
