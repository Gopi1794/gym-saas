"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, X, Search, ChevronDown, ChevronUp } from "lucide-react"
import {
  addMeal, updateMeal, deleteMeal,
  addMealItem, updateMealItem, deleteMealItem,
  updateNutritionPlan,
} from "@/app/actions/nutrition"
import { calcMacros, calcPlanMacros } from "@/lib/nutrition"
import type { NutritionPlan, Meal, Food } from "@/app/actions/nutrition"

interface Props {
  plan: NutritionPlan
  foods: Food[]
}

function MacroBar({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-black leading-none ${color}`}>{Math.round(grams)}<span className="ml-0.5 text-xs font-medium text-zinc-500">g</span></p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  )
}

function MacroSummary({ meals }: { meals: Meal[] }) {
  const m = calcPlanMacros(meals)
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Totales del día</p>
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-lg font-black leading-none text-brand-400">{Math.round(m.calories)}<span className="ml-0.5 text-xs font-medium text-zinc-500">kcal</span></p>
          <p className="mt-0.5 text-xs text-zinc-500">Calorías</p>
        </div>
        <MacroBar label="Prot." grams={m.protein} color="text-blue-400" />
        <MacroBar label="Carbs" grams={m.carbs} color="text-amber-400" />
        <MacroBar label="Grasas" grams={m.fat} color="text-emerald-400" />
      </div>
    </div>
  )
}

function FoodPicker({ foods, onAdd }: { foods: Food[]; onAdd: (foodId: string, grams: number) => void }) {
  const [query, setQuery] = useState("")
  const [grams, setGrams] = useState(100)
  const [selected, setSelected] = useState<Food | null>(null)

  const filtered = foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)

  function confirm() {
    if (!selected) return
    onAdd(selected.id, grams)
    setSelected(null)
    setQuery("")
    setGrams(100)
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null) }}
          placeholder="Buscar alimento…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
        />
      </div>

      {query && !selected && filtered.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {filtered.map(f => (
            <li key={f.id}>
              <button
                onClick={() => { setSelected(f); setQuery(f.name) }}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
              >
                <span className="text-zinc-900 dark:text-zinc-50">{f.name}</span>
                <span className="shrink-0 text-zinc-500">{f.calories} kcal</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-400">{selected.name}</div>
          <input
            type="number"
            min={1}
            value={grams}
            onChange={e => setGrams(parseInt(e.target.value) || 100)}
            className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
          />
          <span className="text-xs text-zinc-500">g</span>
          <button onClick={confirm} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors">
            Agregar
          </button>
        </div>
      )}
    </div>
  )
}

function MealCard({ meal, foods, onDelete }: { meal: Meal; foods: Food[]; onDelete: () => void }) {
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(meal.nutrition_meal_items)
  const [expanded, setExpanded] = useState(true)
  const [addingFood, setAddingFood] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(meal.name)
  const [timeLabel, setTimeLabel] = useState(meal.time_label ?? "")

  const macros = calcMacros(items)

  function handleAddFood(foodId: string, grams: number) {
    startTransition(async () => {
      const id = await addMealItem(meal.id, foodId, grams)
      const food = foods.find(f => f.id === foodId)!
      setItems(prev => [...prev, { id, meal_id: meal.id, food_id: foodId, quantity_grams: grams, foods: food }])
      setAddingFood(false)
    })
  }

  function handleRemoveItem(id: string) {
    startTransition(async () => {
      await deleteMealItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  function handleUpdateGrams(id: string, grams: number) {
    startTransition(async () => {
      await updateMealItem(id, grams)
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity_grams: grams } : i))
    })
  }

  function handleSaveName() {
    startTransition(async () => {
      await updateMeal(meal.id, name, timeLabel)
      setEditingName(false)
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Meal header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <button onClick={() => setExpanded(e => !e)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
            />
            <input
              value={timeLabel}
              onChange={e => setTimeLabel(e.target.value)}
              placeholder="08:00"
              className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            />
            <button onClick={handleSaveName} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-500">OK</button>
            <button onClick={() => setEditingName(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="flex flex-1 items-center gap-2 text-left min-w-0">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{name}</span>
            {timeLabel && <span className="shrink-0 text-xs text-zinc-500">{timeLabel}</span>}
          </button>
        )}

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-brand-400">{Math.round(macros.calories)} kcal</span>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
          {items.length === 0 && (
            <p className="text-center text-sm text-zinc-500 py-4">Sin alimentos. Agregá uno abajo.</p>
          )}
          {items.map(item => {
            const ratio = item.quantity_grams / 100
            const cal = Math.round(item.foods.calories * ratio)
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{item.foods.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">{cal} kcal</span>
                <input
                  type="number"
                  min={1}
                  value={item.quantity_grams}
                  onChange={e => handleUpdateGrams(item.id, parseFloat(e.target.value) || 100)}
                  className="w-16 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-xs text-zinc-500">g</span>
                <button onClick={() => handleRemoveItem(item.id)} className="rounded-lg p-1 text-zinc-400 hover:text-red-500 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}

          {addingFood ? (
            <FoodPicker foods={foods} onAdd={handleAddFood} />
          ) : (
            <button
              onClick={() => setAddingFood(true)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:border-brand-500 hover:text-brand-400 dark:border-zinc-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar alimento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function NutritionPlanEditor({ plan, foods }: Props) {
  const [, startTransition] = useTransition()
  const [meals, setMeals] = useState<Meal[]>(plan.nutrition_meals ?? [])
  const [isActive, setIsActive] = useState(plan.is_active)

  function handleAddMeal() {
    startTransition(async () => {
      const name = `Comida ${meals.length + 1}`
      const id = await addMeal(plan.id, name, "", meals.length)
      setMeals(prev => [...prev, { id, plan_id: plan.id, name, time_label: null, order_index: prev.length, nutrition_meal_items: [] }])
    })
  }

  function handleDeleteMeal(id: string) {
    if (!confirm("¿Eliminar esta comida?")) return
    startTransition(async () => {
      await deleteMeal(id)
      setMeals(prev => prev.filter(m => m.id !== id))
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const next = !isActive
      await updateNutritionPlan(plan.id, { is_active: next })
      setIsActive(next)
    })
  }

  return (
    <div className="space-y-4">
      {/* Plan meta */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm text-zinc-500">Objetivo: <span className="font-semibold text-zinc-900 dark:text-zinc-50 capitalize">{plan.goal}</span></p>
          {plan.notes && <p className="text-sm text-zinc-500 mt-0.5">{plan.notes}</p>}
        </div>
        <button
          onClick={handleToggleActive}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-zinc-500/15 text-zinc-500 hover:bg-zinc-500/25"}`}
        >
          {isActive ? "Activo" : "Inactivo"}
        </button>
      </div>

      {meals.length > 0 && <MacroSummary meals={meals} />}

      {meals.map(meal => (
        <MealCard
          key={meal.id}
          meal={meal}
          foods={foods}
          onDelete={() => handleDeleteMeal(meal.id)}
        />
      ))}

      <button
        onClick={handleAddMeal}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-4 text-sm font-medium text-zinc-500 hover:border-brand-500 hover:text-brand-400 dark:border-zinc-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Agregar comida
      </button>
    </div>
  )
}
