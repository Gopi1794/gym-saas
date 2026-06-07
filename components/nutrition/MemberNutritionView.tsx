"use client"

import { useState, useTransition } from "react"
import { Apple, CheckCircle2, Circle, Droplets, Plus, Minus, Flame, TrendingDown, X } from "lucide-react"
import type { NutritionPlan, Meal } from "@/app/actions/nutrition"
import type { MealLog, WeightLog } from "@/app/actions/nutrition-tracking"
import { calcMacros } from "@/lib/nutrition"
import { logMealWithItems, removeMealLog, setWaterToday } from "@/app/actions/nutrition-tracking"
import { showToast } from "nextjs-toast-notify"
import WeightChart from "@/components/nutrition/WeightChart"

interface Props {
  plan: NutritionPlan | null
  mealLogs: MealLog[]
  waterGlasses: number
  streak: number
  today: string
  weightHistory: WeightLog[]
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

// ── Macro icon paths (viewBox 0 0 24 24) ────────────────────────
const MACRO_ICONS = {
  flame:   "M12,2 C10,7 8,10 8,14 C8,17.3 9.7,19.9 12,21 C14.3,19.9 16,17.3 16,14 C16,10 14,7 12,2 Z",
  protein: "M3,7 L7,7 L7,17 L3,17 Z M7,11 L17,11 L17,13 L7,13 Z M17,7 L21,7 L21,17 L17,17 Z",
  carbs:   "M12,3 L20.5,8 L20.5,16 L12,21 L3.5,16 L3.5,8 Z",
  fat:     "M12,3 C8,7 4,12 4,16 C4,20 7.6,22 12,22 C16.4,22 20,20 20,16 C20,12 16,7 12,3 Z",
}

// ── Animated macro ring (liquid fill + LED glow) ─────────────────
function MacroRing({ label, value, target, unit, color, icon, uid }: {
  label: string; value: number; target: number | null; unit: string
  color: string; icon: keyof typeof MACRO_ICONS; uid: string
}) {
  const dim = 88, ringR = 34, cx = 44, cy = 44, sw = 7
  const circ = 2 * Math.PI * ringR
  const pct = target ? Math.min(value / target, 1) : 0
  const dash = circ * Math.max(0.02, pct)
  const liq = ringR - sw / 2 - 1
  const fy = cy + liq - Math.max(0.04, pct) * 2 * liq
  const amp = liq * 0.12
  const W = liq * 2 * 3

  let wp = `M${cx - liq},${fy}`
  for (let i = 0; i < 6; i++) {
    const segW = W / 6
    const qx = (cx - liq) + i * segW + segW / 2
    const qy = fy + (i % 2 === 0 ? -amp : amp)
    const ex = (cx - liq) + (i + 1) * segW
    wp += ` Q${qx},${qy} ${ex},${fy}`
  }
  wp += ` L${cx - liq + W},${cy + liq} L${cx - liq},${cy + liq} Z`

  const particles = [
    { px: cx - liq * 0.3, sy: cy + liq * 0.5,  ey: cy - liq * 0.3, pr: 1.2, dur: "2.6s", begin: "0s"   },
    { px: cx + liq * 0.3, sy: cy + liq * 0.65, ey: cy - liq * 0.4, pr: 0.9, dur: "3.2s", begin: "0.9s" },
    { px: cx - liq * 0.1, sy: cy + liq * 0.75, ey: cy - liq * 0.2, pr: 0.7, dur: "2.4s", begin: "1.5s" },
  ]

  const iconScale = (liq * 0.62) / 12
  const it = cx - 12 * iconScale

  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          <defs>
            <clipPath id={`${uid}cl`}><circle cx={cx} cy={cy} r={liq} /></clipPath>
            <filter id={`${uid}gl`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={`${uid}ha`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <circle cx={cx} cy={cy} r={liq} fill={`${color}12`} />

          <g clipPath={`url(#${uid}cl)`}>
            <g>
              <animateTransform attributeName="transform" type="translate"
                from="0,0" to={`${-(liq * 2)},0`} dur="3s" repeatCount="indefinite" />
              <path d={wp} fill={`${color}55`} />
            </g>
            <g>
              <animateTransform attributeName="transform" type="translate"
                from={`${-liq},0`} to={`${-(liq * 3)},0`} dur="4.2s" repeatCount="indefinite" />
              <path d={wp} fill={`${color}28`} />
            </g>
            {particles.map((p, i) => (
              <circle key={i} cx={p.px} cy={p.sy} r={p.pr} fill={color} opacity="0">
                <animate attributeName="cy" from={`${p.sy}`} to={`${p.ey}`} dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.9;0.6;0" keyTimes="0;0.1;0.75;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="r" values={`${p.pr};${p.pr * 0.5};0`} keyTimes="0;0.7;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
              </circle>
            ))}
          </g>

          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#27272a" strokeWidth={sw} className="stroke-zinc-200 dark:stroke-zinc-800" />
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
            strokeWidth={sw + 2} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}ha)`} opacity="0.4" />
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
            strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}gl)`} />

          <g transform={`translate(${it},${it}) scale(${iconScale})`} opacity="0.8">
            <path d={MACRO_ICONS[icon]} fill={color} />
          </g>
        </svg>
      </div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-xl font-black leading-none" style={{ color }}>{Math.round(value)}</p>
        {target
          ? <p className="mt-0.5 text-xs text-zinc-500">/ {target} {unit}</p>
          : <p className="mt-0.5 text-xs text-zinc-500">{unit}</p>}
      </div>
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

// ── Meal log modal ────────────────────────────────────────────
function MealLogModal({
  meal,
  mealLog,
  today,
  onClose,
}: {
  meal: Meal
  mealLog: MealLog | null
  today: string
  onClose: () => void
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of meal.nutrition_meal_items) {
      const logged = mealLog?.items.find(l => l.food_id === item.food_id)
      init[item.food_id] = logged ? logged.actual_grams : item.quantity_grams
    }
    return init
  })
  const [saving, startSave] = useTransition()
  const [removing, startRemove] = useTransition()

  const consumed = meal.nutrition_meal_items.reduce((acc, item) => {
    const grams = quantities[item.food_id] ?? item.quantity_grams
    const ratio = grams / 100
    return {
      calories: acc.calories + item.foods.calories * ratio,
      protein: acc.protein + item.foods.protein * ratio,
      carbs: acc.carbs + item.foods.carbs * ratio,
      fat: acc.fat + item.foods.fat * ratio,
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  function handleSave() {
    const items = meal.nutrition_meal_items.map(item => ({
      food_id: item.food_id,
      actual_grams: quantities[item.food_id] ?? item.quantity_grams,
    }))
    startSave(async () => {
      try {
        await logMealWithItems(meal.id, today, items)
        showToast.success(`${meal.name} registrada ✓`, { duration: 2500, position: "top-right", transition: "bounceIn" })
        onClose()
      } catch {
        showToast.error("No se pudo guardar", { duration: 3000, position: "top-right" })
      }
    })
  }

  function handleRemove() {
    startRemove(async () => {
      try {
        await removeMealLog(meal.id, today)
        showToast.success(`${meal.name} desmarcada`, { duration: 2000, position: "top-right" })
        onClose()
      } catch {
        showToast.error("No se pudo desmarcar", { duration: 3000, position: "top-right" })
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-in slide-in-from-bottom-4 sm:fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 className="font-bold text-zinc-50">{meal.name}</h3>
            {meal.time_label && <p className="text-xs text-zinc-500">{meal.time_label}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Food items */}
        <div className="max-h-64 overflow-y-auto px-5 py-4 space-y-5">
          {meal.nutrition_meal_items.map(item => {
            const grams = quantities[item.food_id] ?? item.quantity_grams
            const kcal = Math.round(item.foods.calories * (grams / 100))
            const portion = item.foods.household_unit && item.foods.grams_per_unit
              ? `≈ ${(grams / item.foods.grams_per_unit).toFixed(1)} ${item.foods.household_unit}`
              : null

            return (
              <div key={item.id}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-zinc-200">{item.foods.name}</span>
                  <span className="text-xs text-zinc-500">{kcal} kcal</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantities(q => ({ ...q, [item.food_id]: Math.max(0, (q[item.food_id] ?? item.quantity_grams) - 10) }))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      value={grams}
                      onChange={e => setQuantities(q => ({ ...q, [item.food_id]: Math.max(0, Number(e.target.value)) }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-8 text-center text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">g</span>
                  </div>
                  <button
                    onClick={() => setQuantities(q => ({ ...q, [item.food_id]: (q[item.food_id] ?? item.quantity_grams) + 10 }))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {portion && <p className="mt-1 text-center text-[11px] text-zinc-600">{portion}</p>}
              </div>
            )
          })}
          {meal.nutrition_meal_items.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">Sin alimentos en esta comida</p>
          )}
        </div>

        {/* Macro summary */}
        {meal.nutrition_meal_items.length > 0 && (
          <div className="flex justify-around border-t border-zinc-800 bg-zinc-900/50 px-5 py-3">
            {[
              { label: "Kcal", value: Math.round(consumed.calories) },
              { label: "Prot", value: `${Math.round(consumed.protein)}g` },
              { label: "Carb", value: `${Math.round(consumed.carbs)}g` },
              { label: "Gras", value: `${Math.round(consumed.fat)}g` },
            ].map(m => (
              <div key={m.label} className="text-center">
                <p className="text-sm font-bold text-zinc-100">{m.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{m.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 border-t border-zinc-800 px-5 py-4">
          {mealLog && (
            <button
              onClick={handleRemove}
              disabled={removing || saving}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              {removing ? "..." : "Desmarcar"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || removing}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : mealLog ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Meal card ─────────────────────────────────────────────────
function MealCard({ meal, mealLog, today }: { meal: Meal; mealLog: MealLog | null; today: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const isLogged = mealLog !== null

  // Calories shown: actual consumed if logged with items, plan total otherwise
  const displayMacros = isLogged && mealLog.items.length > 0
    ? meal.nutrition_meal_items.reduce((acc, item) => {
        const logItem = mealLog.items.find(l => l.food_id === item.food_id)
        const grams = logItem ? logItem.actual_grams : 0
        const ratio = grams / 100
        return { ...acc, calories: acc.calories + item.foods.calories * ratio }
      }, { calories: 0 })
    : calcMacros(meal.nutrition_meal_items)

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`w-full rounded-2xl border bg-white text-left transition-colors dark:bg-zinc-900 ${isLogged ? "border-emerald-500/40 dark:border-emerald-500/30" : "border-zinc-200 dark:border-zinc-800"}`}
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          {isLogged
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            : <Circle className="h-5 w-5 shrink-0 text-zinc-400" />}
          <div className="flex-1 min-w-0">
            <span className={`font-semibold ${isLogged ? "text-zinc-500 line-through dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-50"}`}>
              {meal.name}
            </span>
            {meal.time_label && <span className="ml-2 text-sm text-zinc-500">{meal.time_label}</span>}
          </div>
          <span className="shrink-0 text-sm font-bold text-brand-400">{Math.round(displayMacros.calories)} kcal</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {meal.nutrition_meal_items.map(item => {
            const logItem = mealLog?.items.find(l => l.food_id === item.food_id)
            const grams = logItem ? logItem.actual_grams : item.quantity_grams
            const changed = logItem && logItem.actual_grams !== item.quantity_grams
            const portion = item.foods.household_unit && item.foods.grams_per_unit
              ? `${(grams / item.foods.grams_per_unit).toFixed(1)} ${item.foods.household_unit}`
              : `${grams}g`
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{item.foods.name}</span>
                <span className={`shrink-0 text-xs ${changed ? "font-semibold text-amber-400" : "text-zinc-500"}`}>{portion}</span>
                {changed && (
                  <span className="shrink-0 text-[10px] text-zinc-600 line-through">{item.quantity_grams}g</span>
                )}
              </div>
            )
          })}
          {meal.nutrition_meal_items.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">Sin alimentos</p>
          )}
        </div>
      </button>

      {modalOpen && (
        <MealLogModal
          meal={meal}
          mealLog={mealLog}
          today={today}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────
export default function MemberNutritionView({ plan, mealLogs, waterGlasses, streak, today, weightHistory }: Props) {
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

  // Consumed macros based on logged quantities
  const consumed = meals.reduce((acc, meal) => {
    const log = mealLogs.find(l => l.meal_id === meal.id)
    if (!log) return acc

    if (log.items.length > 0) {
      for (const logItem of log.items) {
        const mealItem = meal.nutrition_meal_items.find(mi => mi.food_id === logItem.food_id)
        if (!mealItem) continue
        const ratio = logItem.actual_grams / 100
        acc.calories += mealItem.foods.calories * ratio
        acc.protein += mealItem.foods.protein * ratio
        acc.carbs += mealItem.foods.carbs * ratio
        acc.fat += mealItem.foods.fat * ratio
      }
    } else {
      const mealMacros = calcMacros(meal.nutrition_meal_items)
      acc.calories += mealMacros.calories
      acc.protein += mealMacros.protein
      acc.carbs += mealMacros.carbs
      acc.fat += mealMacros.fat
    }

    return acc
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const hasLogs = mealLogs.length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Mi nutrición</h1>
          <p className="text-muted-foreground">{plan.name} · {GOAL_LABELS[plan.goal] ?? plan.goal}</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-bold text-orange-400">{streak}</span>
            <span className="text-xs text-orange-400/70">días</span>
          </div>
        )}
      </div>

      {/* Macro rings — consumed today vs plan targets */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {hasLogs ? "Consumido hoy" : "Objetivos del plan"}
          </p>
          {plan.target_calories && hasLogs && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  {Math.max(0, Math.round(plan.target_calories - consumed.calories))}
                </span> kcal restantes
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MacroRing label="Calorías"  value={Math.round(consumed.calories)} target={plan.target_calories} unit="kcal" color="#FF2222" icon="flame"   uid="mcal" />
          <MacroRing label="Proteínas" value={Math.round(consumed.protein)}  target={plan.target_protein}  unit="g"    color="#60a5fa" icon="protein" uid="mpro" />
          <MacroRing label="Carbos"    value={Math.round(consumed.carbs)}    target={plan.target_carbs}    unit="g"    color="#fbbf24" icon="carbs"   uid="mcarb" />
          <MacroRing label="Grasas"    value={Math.round(consumed.fat)}      target={plan.target_fat}      unit="g"    color="#34d399" icon="fat"     uid="mfat" />
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
              mealLog={mealLogs.find(l => l.meal_id === meal.id) ?? null}
              today={today}
            />
          ))}
          {meals.length === 0 && (
            <p className="py-8 text-center text-zinc-500">Tu entrenador aún no cargó comidas en este plan</p>
          )}
        </div>
      </div>

      {/* Weight */}
      <WeightChart history={weightHistory} />
    </div>
  )
}
