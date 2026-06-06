"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Trash2, User, ChevronRight, Apple, Zap } from "lucide-react"
import { showToast } from "nextjs-toast-notify"
import { createNutritionPlan, deleteNutritionPlan, getMemberProfileForPlan } from "@/app/actions/nutrition"
import type { NutritionPlan } from "@/app/actions/nutrition"
import { calcNutritionTargets } from "@/lib/nutrition"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getInitials } from "@/lib/utils"

interface Member { id: string; full_name: string | null; avatar_url?: string | null }

interface Props {
  gymId: string
  plans: NutritionPlan[]
  members: Member[]
}

const GOAL_LABELS: Record<string, string> = {
  volumen: "Volumen",
  definicion: "Definición",
  mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición",
  rendimiento: "Rendimiento deportivo",
  perdida_moderada: "Pérdida moderada",
  otro: "Otro",
}

const GOAL_COLORS: Record<string, string> = {
  volumen: "bg-blue-500/15 text-blue-400",
  definicion: "bg-brand-500/15 text-brand-400",
  mantenimiento: "bg-emerald-500/15 text-emerald-400",
  recomposicion: "bg-purple-500/15 text-purple-400",
  rendimiento: "bg-orange-500/15 text-orange-400",
  perdida_moderada: "bg-yellow-500/15 text-yellow-400",
  otro: "bg-zinc-500/15 text-zinc-400",
}

const GOAL_DESCRIPTIONS: Record<string, string> = {
  volumen: "Para ganar masa muscular con un superávit calórico moderado.",
  definicion: "Para perder grasa conservando músculo con déficit agresivo y alta proteína.",
  mantenimiento: "Para mantener el peso y composición corporal actual.",
  recomposicion: "Para perder grasa y ganar músculo a la vez. Ideal para nivel intermedio.",
  rendimiento: "Para atletas y deportistas que priorizan performance sobre estética.",
  perdida_moderada: "Déficit suave, ideal para principiantes o quienes toleran poco déficit.",
  otro: "",
}

type Targets = { calories: number; protein: number; carbs: number; fat: number } | null

export default function NutritionPlansPanel({ gymId, plans: initialPlans, members }: Props) {
  const router = useRouter()
  const [plans, setPlans] = useState(initialPlans)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ memberId: "", name: "", goal: "mantenimiento" as NutritionPlan["goal"], notes: "" })
  const [suggestedTargets, setSuggestedTargets] = useState<Targets>(null)
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)

  async function handleMemberOrGoalChange(memberId: string, goal: NutritionPlan["goal"]) {
    if (!memberId) { setSuggestedTargets(null); return }
    setLoadingTargets(true)
    try {
      const profile = await getMemberProfileForPlan(memberId)
      if (profile) {
        setSuggestedTargets(calcNutritionTargets(profile, goal))
      } else {
        setSuggestedTargets(null)
      }
    } finally {
      setLoadingTargets(false)
    }
  }

  function handleCreate() {
    if (!form.memberId || !form.name.trim()) return
    startTransition(async () => {
      try {
        const id = await createNutritionPlan(gymId, form.memberId, form.name, form.goal, form.notes || undefined, suggestedTargets)
        showToast.success("Plan nutricional creado", { duration: 3000, position: "top-right", transition: "bounceIn" })
        setShowCreate(false)
        router.push(`/nutricion/${id}`)
        router.refresh()
      } catch {
        showToast.error("No se pudo crear el plan", { duration: 4000, position: "top-right" })
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingPlanId(id)
  }

  function confirmDelete() {
    if (!deletingPlanId) return
    const id = deletingPlanId
    setDeletingPlanId(null)
    startTransition(async () => {
      try {
        await deleteNutritionPlan(id)
        setPlans(prev => prev.filter(p => p.id !== id))
        showToast.success("Plan eliminado", { duration: 3000, position: "top-right", transition: "bounceIn" })
      } catch {
        showToast.error("No se pudo eliminar el plan", { duration: 4000, position: "top-right" })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
          <Apple className="h-8 w-8 text-zinc-600" />
          <p className="font-medium text-zinc-400">No hay planes nutricionales</p>
          <p className="text-sm text-zinc-600">Creá el primer plan para un socio</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(plan => (
            <div key={plan.id} className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={plan.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-zinc-200 dark:bg-zinc-700">
                  {getInitials(plan.profiles?.full_name ?? null)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{plan.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${GOAL_COLORS[plan.goal]}`}>
                    {GOAL_LABELS[plan.goal]}
                  </span>
                  {!plan.is_active && (
                    <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">Inactivo</span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500">
                  <User className="h-3 w-3 shrink-0" />
                  {plan.profiles?.full_name ?? "Socio"}
                  {plan.target_calories && (
                    <span className="ml-2 text-xs text-zinc-400">· {plan.target_calories} kcal/día</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="rounded-lg p-2 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link href={`/nutricion/${plan.id}`} className="flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Ver plan
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <h2 className="mb-5 text-lg font-bold text-zinc-900 dark:text-zinc-50">Nuevo plan nutricional</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Socio</label>
                <select
                  value={form.memberId}
                  onChange={e => {
                    const id = e.target.value
                    setForm(f => ({ ...f, memberId: id }))
                    handleMemberOrGoalChange(id, form.goal)
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Seleccioná un socio…</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Nombre del plan</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Plan volumen — Junio"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Objetivo</label>
                <select
                  value={form.goal}
                  onChange={e => {
                    const goal = e.target.value as NutritionPlan["goal"]
                    setForm(f => ({ ...f, goal }))
                    handleMemberOrGoalChange(form.memberId, goal)
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="volumen">Volumen</option>
                  <option value="definicion">Definición</option>
                  <option value="recomposicion">Recomposición</option>
                  <option value="rendimiento">Rendimiento deportivo</option>
                  <option value="perdida_moderada">Pérdida moderada</option>
                  <option value="otro">Otro</option>
                </select>
                {GOAL_DESCRIPTIONS[form.goal] && (
                  <p className="mt-1.5 text-xs text-zinc-500">{GOAL_DESCRIPTIONS[form.goal]}</p>
                )}
              </div>

              {/* Auto-calculated targets */}
              {loadingTargets && (
                <p className="text-xs text-zinc-500 text-center py-2">Calculando targets…</p>
              )}
              {suggestedTargets && !loadingTargets && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Targets calculados automáticamente (Mifflin-St Jeor)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-base font-black text-brand-400">{suggestedTargets.calories}</p>
                      <p className="text-[10px] text-zinc-500">kcal</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-blue-400">{suggestedTargets.protein}g</p>
                      <p className="text-[10px] text-zinc-500">Prot.</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-amber-400">{suggestedTargets.carbs}g</p>
                      <p className="text-[10px] text-zinc-500">Carbs</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-emerald-400">{suggestedTargets.fat}g</p>
                      <p className="text-[10px] text-zinc-500">Grasas</p>
                    </div>
                  </div>
                </div>
              )}
              {form.memberId && !suggestedTargets && !loadingTargets && (
                <p className="text-xs text-zinc-500">No se pudieron calcular targets — el socio no tiene datos de peso/altura/edad/género completos.</p>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Restricciones, observaciones…"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !form.memberId || !form.name.trim()}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Creando…" : "Crear plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!deletingPlanId} onOpenChange={open => { if (!open) setDeletingPlanId(null) }}>
        <DialogContent className="sm:max-w-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-50">¿Eliminar plan nutricional?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Se van a eliminar todas las comidas y alimentos del plan. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeletingPlanId(null)}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
