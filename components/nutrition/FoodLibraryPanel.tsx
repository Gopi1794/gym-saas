"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Search, X } from "lucide-react"
import { createFood, updateFood, deleteFood } from "@/app/actions/nutrition"
import type { Food } from "@/app/actions/nutrition"

interface Props {
  gymId: string
  initialFoods: Food[]
}

const EMPTY: Omit<Food, "id" | "gym_id"> = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0 }

export default function FoodLibraryPanel({ gymId, initialFoods }: Props) {
  const [foods, setFoods] = useState(initialFoods)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [isPending, startTransition] = useTransition()

  const filtered = foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))

  function openCreate() {
    setForm(EMPTY)
    setEditing(null)
    setCreating(true)
  }

  function openEdit(food: Food) {
    setForm({ name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat })
    setCreating(false)
    setEditing(food)
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  function handleSave() {
    if (!form.name.trim()) return
    startTransition(async () => {
      if (creating) {
        await createFood(gymId, form)
      } else if (editing) {
        await updateFood(editing.id, form)
      }
      // Optimistic local update
      if (creating) {
        setFoods(prev => [...prev, { ...form, id: crypto.randomUUID(), gym_id: gymId }].sort((a, b) => a.name.localeCompare(b.name)))
      } else if (editing) {
        setFoods(prev => prev.map(f => f.id === editing.id ? { ...f, ...form } : f))
      }
      closeModal()
    })
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este alimento?")) return
    startTransition(async () => {
      await deleteFood(id)
      setFoods(prev => prev.filter(f => f.id !== id))
    })
  }

  const isCustom = (food: Food) => food.gym_id !== null

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar alimento…"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
              <th className="px-4 py-3 text-left font-semibold text-zinc-500 dark:text-zinc-400">Alimento</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Cal.</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Prot.</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Carbs</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Grasas</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  {query ? "No hay resultados" : "Sin alimentos cargados"}
                </td>
              </tr>
            )}
            {filtered.map(food => (
              <tr key={food.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{food.name}</span>
                  {!isCustom(food) && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">global</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.calories}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.protein}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.carbs}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.fat}g</td>
                <td className="px-4 py-3">
                  {isCustom(food) && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(food)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(food.id)} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {creating ? "Nuevo alimento" : "Editar alimento"}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Pechuga de pollo cocida"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <p className="text-xs text-zinc-500">Valores por cada 100g</p>
              <div className="grid grid-cols-2 gap-3">
                {(["calories", "protein", "carbs", "fat"] as const).map(field => (
                  <div key={field}>
                    <label className="mb-1 block text-xs font-semibold text-zinc-500 capitalize">
                      {field === "calories" ? "Calorías (kcal)" : field === "protein" ? "Proteínas (g)" : field === "carbs" ? "Carbohidratos (g)" : "Grasas (g)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={form[field]}
                      onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !form.name.trim()}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
