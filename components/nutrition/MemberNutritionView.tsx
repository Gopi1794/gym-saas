"use client"

import { useState, useTransition, useOptimistic } from "react"
import { Apple, CheckCircle2, Circle, Droplets, Plus, Minus, Flame, TrendingDown } from "lucide-react"
import type { NutritionPlan, Meal } from "@/app/actions/nutrition"
import { calcMacros, calcPlanMacros } from "@/lib/nutrition"
import { toggleMealLog, setWaterToday } from "@/app/actions/nutrition-tracking"
import { showToast } from "nextjs-toast-notify"

interface Props {
  plan: NutritionPlan | null
  checkedMealIds: string[]   // meals already logged today
  waterGlasses: number       // glasses logged today
  streak: number
  today: string              // ISO date string "YYYY-MM-DD"
}

const GOAL_LABELS = {
  volumen: "Volumen",
  definicion: "Definición",
  mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición",
  rendimiento: "Rendimiento deportivo",
  perdida_moderada: "Pérdida moderada",
  otro: "Otro",
}

// ── Macro ring (SVG) ──────────────────────────────────────────
function MacroRing({
  label, value, target, unit, color, trackColor,
}: {
  label: string; value: number; target: number | null
  unit: string; color: string; trackColor: string
}) {
  const r = 26, cx = 32, cy = 32
  const circ = 2 * Math.PI * r
  const pct = target ? Math.min(value / target, 1) : 0
  const over = target ? value > target * 1.05 : false
  const dash = circ * Math.max(0.02, pct)
  const strokeColor = over ? "#ef4444" : color

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="5" />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={strokeColor} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-black leading-none" style={{ color: strokeColor }}>
            {Math.round(value)}
          </span>
          <span className="text-[9px] text-zinc-500">{unit}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      {target && <p className="text-[10px] text-zinc-600">de {target}</p>}
    </div>
  )
}

// ── Water tracker ─────────────────────────────────────────────
function WaterTracker({ initial }: { initial: number }) {
  const [glasses, setGlasses] = useState(initial)
  const [, startTransition] = useTransition()
  const TARGET = 8

  function update(n: number) {
    const next = Math.max(0, Math.min(12, n))
    const prev = glasses
    setGlasses(next)
    startTransition(async () => {
      try {
        await setWaterToday(next)
        if (next === TARGET && prev < TARGET)
          showToast.success("¡Meta de agua alcanzada! 💧", { duration: 3000, position: "top-right", transition: "bounceIn" })
      } catch {
        setGlasses(prev)
        showToast.error("No se pudo guardar el agua", { duration: 3000, position: "top-right" })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Agua</span>
        </div>
        <span className="text-sm font-bold text-blue-400">{glasses}<span className="text-xs font-medium text-zinc-500">/{TARGET} vasos</span></span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => update(glasses - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex flex-1 gap-1">
          {Array.from({ length: TARGET }).map((_, i) => (
            <button
              key={i}
              onClick={() => update(i < glasses ? i : i + 1)}
              className={`h-6 flex-1 rounded-full transition-colors ${i < glasses ? "bg-blue-400" : "bg-zinc-200 dark:bg-zinc-700"}`}
            />
          ))}
        </div>
        <button onClick={() => update(glasses + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Meal card with check-off ──────────────────────────────────
function MealCard({ meal, checked, today }: { meal: Meal; checked: boolean; today: string }) {
  const [isChecked, setIsChecked] = useOptimistic(checked)
  const [, startTransition] = useTransition()
  const macros = calcMacros(meal.nutrition_meal_items)

  function handleToggle() {
    const next = !isChecked
    startTransition(async () => {
      setIsChecked(next)
      try {
        await toggleMealLog(meal.id, today)
        if (next) showToast.success(`${meal.name} completada ✓`, { duration: 2500, position: "top-right", transition: "bounceIn" })
      } catch {
        showToast.error("No se pudo guardar", { duration: 3000, position: "top-right" })
      }
    })
  }

  return (
    <div className={`rounded-2xl border bg-white transition-colors dark:bg-zinc-900 ${isChecked ? "border-emerald-500/40 dark:border-emerald-500/30" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <button onClick={handleToggle} className="shrink-0 text-zinc-400 hover:text-emerald-400 transition-colors">
          {isChecked
            ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            : <Circle className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <span className={`font-semibold ${isChecked ? "text-zinc-500 line-through dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-50"}`}>
            {meal.name}
          </span>
          {meal.time_label && <span className="ml-2 text-sm text-zinc-500">{meal.time_label}</span>}
        </div>
        <span className="shrink-0 text-sm font-bold text-brand-400">{Math.round(macros.calories)} kcal</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {meal.nutrition_meal_items.map(item => {
          const ratio = item.quantity_grams / 100
          const cal = Math.round(item.foods.calories * ratio)
          const portion = item.foods.household_unit && item.foods.grams_per_unit
            ? `${(item.quantity_grams / item.foods.grams_per_unit).toFixed(1)} ${item.foods.household_unit}`
            : `${item.quantity_grams}g`
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2">
              <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{item.foods.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{portion}</span>
              <span className="shrink-0 hidden sm:inline text-xs text-zinc-400">{cal} kcal</span>
            </div>
          )
        })}
        {meal.nutrition_meal_items.length === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-500">Sin alimentos</p>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function MemberNutritionView({ plan, checkedMealIds, waterGlasses, streak, today }: Props) {
  if (!plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi nutrición</h1>
          <p className="text-muted-foreground">Tu plan nutricional asignado por el entrenador</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
          <Apple className="h-8 w-8 text-zinc-600" />
          <p className="font-medium text-zinc-400">Todavía no tenés un plan nutricional</p>
          <p className="text-sm text-zinc-600">Hablá con tu entrenador para que te asigne uno</p>
        </div>
      </div>
    )
  }

  const meals = plan.nutrition_meals ?? []
  const totals = calcPlanMacros(meals)
  const remaining = plan.target_calories ? Math.max(0, plan.target_calories - totals.calories) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi nutrición</h1>
          <p className="text-muted-foreground">{plan.name} · {GOAL_LABELS[plan.goal]}</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-bold text-orange-400">{streak}</span>
            <span className="text-xs text-orange-400/70">días</span>
          </div>
        )}
      </div>

      {/* Macro rings */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Macros del plan</p>
          {remaining !== null && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <TrendingDown className="h-3.5 w-3.5" />
              <span><span className="font-bold text-zinc-900 dark:text-zinc-50">{Math.round(remaining)}</span> kcal restantes</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-around">
          <MacroRing label="Calorías" value={totals.calories} target={plan.target_calories} unit="kcal" color="#FF2222" trackColor="#3f3f46" />
          <MacroRing label="Proteínas" value={totals.protein} target={plan.target_protein} unit="g" color="#60a5fa" trackColor="#3f3f46" />
          <MacroRing label="Carbos" value={totals.carbs} target={plan.target_carbs} unit="g" color="#fbbf24" trackColor="#3f3f46" />
          <MacroRing label="Grasas" value={totals.fat} target={plan.target_fat} unit="g" color="#34d399" trackColor="#3f3f46" />
        </div>
      </div>

      {/* Water */}
      <WaterTracker initial={waterGlasses} />

      {/* Meals */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Comidas del día</p>
        <div className="space-y-3">
          {meals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              checked={checkedMealIds.includes(meal.id)}
              today={today}
            />
          ))}
          {meals.length === 0 && (
            <p className="text-center text-zinc-500 py-8">Tu entrenador aún no cargó comidas en este plan</p>
          )}
        </div>
      </div>
    </div>
  )
}
