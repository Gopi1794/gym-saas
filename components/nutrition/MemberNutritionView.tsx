import { Apple } from "lucide-react"
import type { NutritionPlan, Meal } from "@/app/actions/nutrition"
import { calcMacros, calcPlanMacros } from "@/lib/nutrition"

interface Props {
  plan: NutritionPlan | null
}

function MacroChip({
  label, value, target, unit, color, barColor,
}: {
  label: string; value: number; target: number | null; unit: string; color: string; barColor: string
}) {
  const pct = target ? Math.min((value / target) * 100, 100) : 0
  const over = target ? value > target * 1.05 : false
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className={`text-xl font-black leading-none ${color}`}>
        {Math.round(value)}<span className="ml-0.5 text-[11px] font-medium text-zinc-500">{unit}</span>
      </p>
      {target && (
        <p className="text-[10px] text-zinc-500">de {target}{unit}</p>
      )}
      <p className="mt-1.5 text-[11px] text-zinc-500">{label}</p>
      {target && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${over ? "bg-red-500" : barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function MealRow({ meal }: { meal: Meal }) {
  const macros = calcMacros(meal.nutrition_meal_items)
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{meal.name}</span>
          {meal.time_label && <span className="ml-2 text-sm text-zinc-500">{meal.time_label}</span>}
        </div>
        <span className="text-sm font-bold text-brand-400">{Math.round(macros.calories)} kcal</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {meal.nutrition_meal_items.map(item => {
          const ratio = item.quantity_grams / 100
          const cal = Math.round(item.foods.calories * ratio)
          const prot = (item.foods.protein * ratio).toFixed(1)
          const carbs = (item.foods.carbs * ratio).toFixed(1)
          const fat = (item.foods.fat * ratio).toFixed(1)
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{item.foods.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{item.quantity_grams}g</span>
              <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500">
                <span>{cal} kcal</span>
                <span className="text-blue-400">{prot}g P</span>
                <span className="text-amber-400">{carbs}g C</span>
                <span className="text-emerald-400">{fat}g G</span>
              </div>
              <span className="sm:hidden text-xs text-zinc-500">{cal} kcal</span>
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

export default function MemberNutritionView({ plan }: Props) {
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

  const GOAL_LABELS = {
    volumen: "Volumen",
    definicion: "Definición",
    mantenimiento: "Mantenimiento",
    otro: "Otro",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi nutrición</h1>
        <p className="text-muted-foreground">
          {plan.name} · Objetivo: {GOAL_LABELS[plan.goal]}
        </p>
      </div>

      {/* Daily totals */}
      <div className="grid grid-cols-4 gap-3">
        <MacroChip label="Calorías" value={totals.calories} target={plan.target_calories} unit="kcal" color="text-brand-400" barColor="bg-brand-500" />
        <MacroChip label="Proteínas" value={totals.protein} target={plan.target_protein} unit="g" color="text-blue-400" barColor="bg-blue-500" />
        <MacroChip label="Carbos" value={totals.carbs} target={plan.target_carbs} unit="g" color="text-amber-400" barColor="bg-amber-500" />
        <MacroChip label="Grasas" value={totals.fat} target={plan.target_fat} unit="g" color="text-emerald-400" barColor="bg-emerald-500" />
      </div>

      {plan.notes && (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {plan.notes}
        </div>
      )}

      <div className="space-y-3">
        {meals.map(meal => <MealRow key={meal.id} meal={meal} />)}
        {meals.length === 0 && (
          <p className="text-center text-zinc-500 py-8">Tu entrenador aún no cargó comidas en este plan</p>
        )}
      </div>
    </div>
  )
}
