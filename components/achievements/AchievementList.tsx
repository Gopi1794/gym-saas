"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Target, Trash2, Trophy } from "lucide-react"
import { deleteAchievement } from "@/app/actions/achievements"
import { describeCondition, formatCount } from "@/lib/achievements/describe"
import { cn } from "@/lib/utils"
import AchievementForm from "./AchievementForm"
import AchievementMedal from "./AchievementMedal"
import type { Achievement } from "@/types"

type Props = {
  items: Achievement[]
}

function ActionButton({
  label,
  tone = "neutral",
  size,
  disabled,
  onClick,
  children,
}: {
  label: string
  tone?: "neutral" | "danger"
  size: "touch" | "compact"
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-xl text-zinc-500 transition-colors focus-visible:rounded-xl disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400",
        // 44px on the touch (card) layout, tighter in the table where a mouse is the norm
        size === "touch" ? "h-11 w-11" : "h-10 w-10",
        tone === "danger"
          ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          : "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
      )}
    >
      {children}
    </button>
  )
}

function XpBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
      +{formatCount(value)} XP
    </span>
  )
}

const primaryButtonClass =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:rounded-xl"

export default function AchievementList({ items }: Props) {
  const router = useRouter()
  const [editItem, setEditItem] = useState<Achievement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
  }

  function handleNew() {
    setEditItem(null)
    setShowForm(true)
  }

  function handleEdit(item: Achievement) {
    setEditItem(item)
    setShowForm(true)
  }

  function handleFormSuccess() {
    closeForm()
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Seguro que querés eliminar este logro? También se eliminará de todos los usuarios que lo ganaron.")) {
      return
    }

    setDeleteError(null)
    setDeletingId(id)
    try {
      const result = await deleteAchievement(id)
      if (!result.ok) throw new Error(result.error)
      // The form would otherwise keep editing a row that no longer exists.
      if (editItem?.id === id) closeForm()
      router.refresh()
    } catch {
      setDeleteError("No pudimos eliminar el logro. Probá de nuevo en unos segundos.")
    } finally {
      setDeletingId(null)
    }
  }

  const isEditing = (item: Achievement) => showForm && editItem?.id === item.id

  const rowActions = (item: Achievement, size: "touch" | "compact") => (
    <>
      <ActionButton label={`Editar ${item.name}`} size={size} onClick={() => handleEdit(item)}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label={`Eliminar ${item.name}`}
        tone="danger"
        size={size}
        disabled={deletingId === item.id}
        onClick={() => handleDelete(item.id)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </ActionButton>
    </>
  )

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length} {items.length === 1 ? "logro" : "logros"}
          </p>
          <button type="button" onClick={handleNew} className={primaryButtonClass}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo logro
          </button>
        </div>
      )}

      {showForm && (
        <AchievementForm
          key={editItem?.id ?? "new"}
          mode={editItem ? "edit" : "create"}
          item={editItem ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={closeForm}
        />
      )}

      {deleteError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {deleteError}
        </p>
      )}

      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Todavía no hay logros
          </h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Los logros se desbloquean solos cuando un miembro cumple la meta que
            elijas, y le suman XP. Empezá creando el primero.
          </p>
          <button type="button" onClick={handleNew} className={cn(primaryButtonClass, "mt-5")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo logro
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Cards: below lg */}
          <ul className="space-y-3 lg:hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900",
                  isEditing(item) && "border-brand-500/60 ring-1 ring-brand-500/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <AchievementMedal icon={item.icon} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 break-words text-sm text-zinc-500 dark:text-zinc-400">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <p className="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <Target
                    className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  />
                  {describeCondition(item)}
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <XpBadge value={item.xp_reward} />
                  <div className="-my-1.5 -mr-2 flex items-center">{rowActions(item, "touch")}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Table: from lg up (the sidebar takes 240px from md, so a table at md has no room) */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Logro
                  </th>
                  <th scope="col" className="w-[32%] px-3 py-3 text-left font-semibold">
                    Cómo se gana
                  </th>
                  <th scope="col" className="w-28 px-3 py-3 text-left font-semibold">
                    Recompensa
                  </th>
                  <th scope="col" className="w-24 px-3 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40",
                      isEditing(item) && "bg-brand-50/60 dark:bg-brand-500/5",
                    )}
                  >
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <AchievementMedal icon={item.icon} size="md" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words font-semibold text-zinc-900 dark:text-zinc-50">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-2 break-words text-xs text-zinc-500 dark:text-zinc-400">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-zinc-700 dark:text-zinc-300">
                      {describeCondition(item)}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <XpBadge value={item.xp_reward} />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center justify-end">{rowActions(item, "compact")}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
