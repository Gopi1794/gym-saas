"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Plus } from "lucide-react"
import { deleteAchievement } from "@/app/actions/achievements"
import AchievementForm from "./AchievementForm"
import type { Achievement } from "@/types"
import type { ConditionType } from "@/lib/achievements/types"

const CONDITION_LABELS: Record<ConditionType, string> = {
  total_sessions: "Sesiones totales",
  streak_days: "Racha de días",
  sessions_week: "Sesiones esta semana",
  total_xp: "XP total",
  sessions_category: "Sesiones por categoría",
  total_volume_kg: "Volumen total (kg)",
  total_cardio_minutes: "Minutos de cardio",
}

type Props = {
  items: Achievement[]
}

export default function AchievementList({ items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editItem, setEditItem] = useState<Achievement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleNew() {
    setEditItem(null)
    setShowForm(true)
  }

  function handleEdit(item: Achievement) {
    setEditItem(item)
    setShowForm(true)
  }

  function handleFormSuccess() {
    setShowForm(false)
    setEditItem(null)
    router.refresh()
  }

  function handleDelete(id: string) {
    if (!window.confirm("¿Seguro que querés eliminar este logro? También se eliminará de todos los usuarios que lo ganaron.")) {
      return
    }

    setDeletingId(id)
    startTransition(async () => {
      await deleteAchievement(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  const thClass = "px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider"
  const tdClass = "px-3 py-3 text-sm"

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {items.length === 0
            ? "Sin logros configurados"
            : `${items.length} logro${items.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo logro
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <AchievementForm
          mode={editItem ? "edit" : "create"}
          item={editItem ?? undefined}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-8 text-center">
          <p className="text-sm text-zinc-500">
            Aún no creaste ningún logro. ¡Empezá agregando uno!
          </p>
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/60">
          <table className="w-full">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className={thClass}>Logro</th>
                <th className={thClass}>Condición</th>
                <th className={thClass}>XP</th>
                <th className={thClass + " text-right"}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-zinc-800/30">
                  {/* Name + icon */}
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg" role="img" aria-label={item.name}>
                        {item.icon ?? "🏆"}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-100">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-zinc-500 truncate max-w-[180px]">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Condition */}
                  <td className={tdClass}>
                    <p className="text-zinc-300">
                      {CONDITION_LABELS[item.condition_type]}
                    </p>
                    <p className="text-xs text-zinc-500">
                      ≥ {item.condition_value}
                    </p>
                  </td>

                  {/* XP reward */}
                  <td className={tdClass}>
                    <span className="font-semibold text-brand-400">
                      {item.xp_reward}
                    </span>
                    <span className="ml-1 text-xs text-zinc-500">XP</span>
                  </td>

                  {/* Actions */}
                  <td className={tdClass + " text-right"}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending && deletingId === item.id}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-900/40 hover:text-red-400 disabled:opacity-50"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
