"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, Pencil, Trash2, Search, X, Download } from "lucide-react"
import { createFood, updateFood, deleteFood } from "@/app/actions/nutrition"
import { searchUSDA } from "@/app/actions/usda"
import type { Food } from "@/app/actions/nutrition"
import type { USDAResult } from "@/app/actions/usda"

interface Props {
  gymId: string
  initialFoods: Food[]
}

const EMPTY: Omit<Food, "id" | "gym_id"> = {
  name: "", calories: 0, protein: 0, carbs: 0, fat: 0,
  fiber: 0, sodium: 0, household_unit: null, grams_per_unit: null,
  sugars: null, saturated_fat: null, potassium: null, calcium: null,
  magnesium: null, zinc: null, iron: null, vitamin_b12: null,
}

export default function FoodLibraryPanel({ gymId, initialFoods }: Props) {
  const [foods, setFoods] = useState(initialFoods)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Omit<Food, "id" | "gym_id">>(EMPTY)
  const [isPending, startTransition] = useTransition()
  const [detail, setDetail] = useState<Food | null>(null)

  // USDA import
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [usdaQuery, setUsdaQuery] = useState("")
  const [usdaResults, setUsdaResults] = useState<USDAResult[]>([])
  const [usdaSearching, setUsdaSearching] = useState(false)
  const [usdaError, setUsdaError] = useState("")
  const [imported, setImported] = useState<Set<number>>(new Set())
  const [editedNames, setEditedNames] = useState<Record<number, string>>({})
  const usdaInputRef = useRef<HTMLInputElement>(null)

  function openUSDA() { setUsdaOpen(true); setUsdaQuery(""); setUsdaResults([]); setUsdaError(""); setImported(new Set()); setEditedNames({}) }
  function closeUSDA() { setUsdaOpen(false) }

  function handleUsdaSearch() {
    if (!usdaQuery.trim()) return
    setUsdaSearching(true)
    setUsdaError("")
    startTransition(async () => {
      try {
        const results = await searchUSDA(usdaQuery.trim())
        setUsdaResults(results)
        if (results.length === 0) setUsdaError("Sin resultados. Probá en inglés (ej: chicken breast, oats, egg).")
      } catch {
        setUsdaError("Error al conectar con USDA. Verificá la API key.")
      } finally {
        setUsdaSearching(false)
      }
    })
  }

  async function handleImport(food: USDAResult & { editedName: string }) {
    try {
      const f: Omit<Food, "id" | "gym_id"> = {
        name: food.editedName.trim() || food.name,
        calories: food.calories, protein: food.protein,
        carbs: food.carbs, fat: food.fat, fiber: food.fiber,
        sodium: food.sodium, household_unit: null, grams_per_unit: null,
        sugars: food.sugars, saturated_fat: food.saturated_fat,
        potassium: food.potassium, calcium: food.calcium,
        magnesium: food.magnesium, zinc: food.zinc,
        iron: food.iron, vitamin_b12: food.vitamin_b12,
      }
      const created = await createFood(gymId, f)
      setFoods(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setImported(prev => new Set([...prev, food.fdcId]))
    } catch (e) {
      console.error("Error al importar alimento:", e)
    }
  }

  const filtered = foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true) }

  function openEdit(food: Food) {
    setForm({
      name: food.name, calories: food.calories, protein: food.protein,
      carbs: food.carbs, fat: food.fat, fiber: food.fiber ?? 0,
      sodium: food.sodium ?? 0, household_unit: food.household_unit ?? null,
      grams_per_unit: food.grams_per_unit ?? null,
      sugars: food.sugars ?? null, saturated_fat: food.saturated_fat ?? null,
      potassium: food.potassium ?? null, calcium: food.calcium ?? null,
      magnesium: food.magnesium ?? null, zinc: food.zinc ?? null,
      iron: food.iron ?? null, vitamin_b12: food.vitamin_b12 ?? null,
    })
    setCreating(false)
    setEditing(food)
  }

  function closeModal() { setCreating(false); setEditing(null) }

  function handleSave() {
    if (!form.name.trim()) return
    startTransition(async () => {
      if (creating) {
        const created = await createFood(gymId, form)
        setFoods(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      } else if (editing) {
        await updateFood(editing.id, form)
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

  const numField = (label: string, field: keyof Omit<Food, "id" | "gym_id" | "name" | "household_unit">, unit = "") => (
    <div key={field}>
      <label className="mb-1 block text-xs font-semibold text-zinc-500">{label}{unit && <span className="ml-1 font-normal">({unit})</span>}</label>
      <input
        type="number" min={0} step={0.1}
        value={(form[field] as number) ?? 0}
        onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
    </div>
  )

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
        <button onClick={openUSDA} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">
          <Download className="h-4 w-4" />Importar USDA
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors">
          <Plus className="h-4 w-4" />Agregar
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
              <th className="px-4 py-3 text-left font-semibold text-zinc-500 dark:text-zinc-400">Alimento</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Cal.</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Prot.</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Carbs</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Grasas</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Fibra</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-500 dark:text-zinc-400">Sodio</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-500 dark:text-zinc-400">Porción</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-500">{query ? "No hay resultados" : "Sin alimentos cargados"}</td></tr>
            )}
            {filtered.map(food => (
              <tr key={food.id} onClick={() => setDetail(food)} className="cursor-pointer border-b border-zinc-100 last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-zinc-900 hover:text-brand-500 dark:text-zinc-50 dark:hover:text-brand-400 transition-colors">{food.name}</span>
                  {!isCustom(food) && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">global</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.calories}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.protein}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.carbs}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.fat}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.fiber ?? 0}g</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{food.sodium ?? 0}mg</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {food.household_unit && food.grams_per_unit ? `${food.household_unit} = ${food.grams_per_unit}g` : "—"}
                </td>
                <td className="px-4 py-3">
                  {isCustom(food) && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(food)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(food.id)} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* USDA Import Modal */}
      {usdaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeUSDA}>
          <div className="flex w-full max-w-2xl flex-col max-h-[85vh] rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Importar desde USDA</h2>
                <p className="text-xs text-zinc-500">Buscá en inglés para mejores resultados (ej: chicken breast, oats, egg)</p>
              </div>
              <button onClick={closeUSDA} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    ref={usdaInputRef}
                    value={usdaQuery}
                    onChange={e => setUsdaQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUsdaSearch()}
                    placeholder="pechuga de pollo, avena, salmón…"
                    autoFocus
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-4 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <button
                  onClick={handleUsdaSearch}
                  disabled={usdaSearching || !usdaQuery.trim()}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {usdaSearching ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {usdaError && <p className="text-center text-sm text-zinc-500 py-6">{usdaError}</p>}
              {!usdaError && usdaResults.length === 0 && !usdaSearching && (
                <p className="text-center text-sm text-zinc-500 py-10">Ingresá un alimento y presioná Buscar</p>
              )}
              <div className="space-y-2">
                {usdaResults.map(food => {
                  const done = imported.has(food.fdcId)
                  return (
                    <div key={food.fdcId} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <div className="flex-1 min-w-0">
                        <input
                          value={editedNames[food.fdcId] ?? food.name}
                          onChange={e => setEditedNames(prev => ({ ...prev, [food.fdcId]: e.target.value }))}
                          disabled={done}
                          className="w-full bg-transparent font-medium text-zinc-900 dark:text-zinc-50 focus:outline-none focus:border-b focus:border-brand-500 disabled:opacity-60"
                        />
                        <p className="text-xs text-zinc-500 mt-0.5">
                          <span className="text-brand-400 font-semibold">{food.calories} kcal</span>
                          <span className="mx-1.5">·</span>P {food.protein}g
                          <span className="mx-1.5">·</span>C {food.carbs}g
                          <span className="mx-1.5">·</span>G {food.fat}g
                          {food.fiber > 0 && <><span className="mx-1.5">·</span>F {food.fiber}g</>}
                        </p>
                      </div>
                      <button
                        onClick={() => !done && handleImport({ ...food, editedName: editedNames[food.fdcId] ?? food.name })}
                        disabled={done || isPending}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          done
                            ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                            : "bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
                        }`}
                      >
                        {done ? "Importado ✓" : "Importar"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual create/edit Modal */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{creating ? "Nuevo alimento" : "Editar alimento"}</h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Pechuga de pollo cocida"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500">Macros por 100g</p>
                <div className="grid grid-cols-2 gap-3">
                  {numField("Calorías", "calories", "kcal")}
                  {numField("Proteínas", "protein", "g")}
                  {numField("Carbohidratos", "carbs", "g")}
                  {numField("Grasas", "fat", "g")}
                  {numField("Fibra", "fiber", "g")}
                  {numField("Sodio", "sodium", "mg")}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500">Porción casera (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Descripción</label>
                    <input
                      value={form.household_unit ?? ""}
                      onChange={e => setForm(f => ({ ...f, household_unit: e.target.value || null }))}
                      placeholder="1 huevo, 1 taza…"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Equivale a (g)</label>
                    <input
                      type="number" min={1}
                      value={form.grams_per_unit ?? ""}
                      onChange={e => setForm(f => ({ ...f, grams_per_unit: parseFloat(e.target.value) || null }))}
                      placeholder="50"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={isPending || !form.name.trim()} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors">
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-150" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/60 shadow-2xl backdrop-blur-2xl ring-1 ring-inset ring-white/5 dark:bg-zinc-900/50 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{detail.name}</h2>
                <p className="text-xs text-zinc-500">Valores por 100g</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Main macros */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Calorías", value: detail.calories, unit: "kcal", color: "text-brand-500" },
                  { label: "Proteínas", value: detail.protein, unit: "g", color: "text-blue-400" },
                  { label: "Carbos", value: detail.carbs, unit: "g", color: "text-amber-400" },
                  { label: "Grasas", value: detail.fat, unit: "g", color: "text-emerald-400" },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                    <p className={`text-lg font-black leading-none ${m.color}`}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{m.unit}</p>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Extended nutrients */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nutrientes adicionales</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Fibra",          value: detail.fiber,         unit: "g"  },
                    { label: "Sodio",          value: detail.sodium,        unit: "mg" },
                    { label: "Azúcares",       value: detail.sugars,        unit: "g"  },
                    { label: "Grasa saturada", value: detail.saturated_fat, unit: "g"  },
                    { label: "Potasio",        value: detail.potassium,     unit: "mg" },
                    { label: "Calcio",         value: detail.calcium,       unit: "mg" },
                    { label: "Magnesio",       value: detail.magnesium,     unit: "mg" },
                    { label: "Zinc",           value: detail.zinc,          unit: "mg" },
                    { label: "Hierro",         value: detail.iron,          unit: "mg" },
                    { label: "Vitamina B12",   value: detail.vitamin_b12,   unit: "µg" },
                  ].filter(n => n.value != null && n.value !== 0).map(n => (
                    <div key={n.label} className="flex items-center justify-between rounded-lg px-3 py-1.5 odd:bg-zinc-50 dark:odd:bg-zinc-800/40">
                      <span className="text-xs text-zinc-500">{n.label}</span>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{n.value}{n.unit}</span>
                    </div>
                  ))}
                </div>
                {[detail.sugars, detail.saturated_fat, detail.potassium, detail.calcium, detail.magnesium, detail.zinc, detail.iron, detail.vitamin_b12].every(v => !v) && (
                  <p className="text-center text-xs text-zinc-500 py-3">Sin datos extendidos — importá desde USDA para obtenerlos</p>
                )}
              </div>

              {/* Portion */}
              {detail.household_unit && detail.grams_per_unit && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-zinc-500">Porción: </span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{detail.household_unit} = {detail.grams_per_unit}g</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {isCustom(detail) && (
              <div className="flex gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <button onClick={() => { openEdit(detail); setDetail(null) }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />Editar
                </button>
                <button onClick={() => { handleDelete(detail.id); setDetail(null) }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
