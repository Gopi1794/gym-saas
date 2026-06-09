import Link from "next/link"
import { Apple, ArrowRight, Droplets } from "lucide-react"
import type { Meal, NutritionPlan } from "@/app/actions/nutrition"
import { MacroRing } from "@/components/nutrition/MacroRing"

const MACRO_PATHS = {
  protein: "M3,7 L7,7 L7,17 L3,17 Z M7,11 L17,11 L17,13 L7,13 Z M17,7 L21,7 L21,17 L17,17 Z",
  carbs:   "M12,3 L20.5,8 L20.5,16 L12,21 L3.5,16 L3.5,8 Z",
  fat:     "M12,3 C8,7 4,12 4,16 C4,20 7.6,22 12,22 C16.4,22 20,20 20,16 C20,12 16,7 12,3 Z",
}

interface ConsumedMacros {
  calories: number
  protein:  number
  carbs:    number
  fat:      number
}

interface Props {
  plan:          NutritionPlan | null
  streak:        number
  consumed:      ConsumedMacros
  waterGlasses:  number
}

const WATER_TARGET = 10 // 10 × 250 ml = 2.5 L

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("es-AR")
}

function percent(value: number, target: number | null) {
  if (!target || target <= 0) return 0
  return Math.min(value / target, 1)
}

function mealMacros(meal: Meal | null) {
  if (!meal) return null

  return meal.nutrition_meal_items.reduce(
    (acc, item) => {
      const factor = item.quantity_grams / 100
      acc.calories += item.foods.calories * factor
      acc.protein += item.foods.protein * factor
      acc.carbs += item.foods.carbs * factor
      acc.fat += item.foods.fat * factor
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function nextMeal(plan: NutritionPlan) {
  const meals = plan.nutrition_meals ?? []
  if (!meals.length) return null

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const withTime = meals
    .map((meal) => {
      const match = meal.time_label?.match(/(\d{1,2}):(\d{2})/)
      if (!match) return { meal, minutes: null }
      return { meal, minutes: Number(match[1]) * 60 + Number(match[2]) }
    })
    .filter((entry): entry is { meal: Meal; minutes: number } => entry.minutes !== null)

  return withTime.find((entry) => entry.minutes >= currentMinutes)?.meal ?? meals[0]
}


function MacroCard({
  label,
  value,
  target,
  unit,
  color,
  accent,
  iconPath,
}: {
  label: string
  value: number
  target: number | null
  unit: string
  color: string
  accent: string
  iconPath: string
}) {
  const pct = percent(value, target)

  return (
    <div className={`rounded-2xl border ${accent} bg-zinc-50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-zinc-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
      <div className="mb-4 flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[0_0_24px_var(--macro-glow)]" style={{ backgroundColor: `${color}22`, ["--macro-glow" as string]: `${color}55` }}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={color}>
            <path d={iconPath} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{label}</p>
          <p className="mt-1 text-lg font-black tabular-nums" style={{ color }}>
            {formatNumber(value)} <span className="font-semibold text-zinc-700 dark:text-zinc-200">/ {formatNumber(target ?? 0)} {unit}</span>
          </p>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700/55">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MealPreview({ meal }: { meal: Meal | null }) {
  const macros = mealMacros(meal)
  const foods = meal?.nutrition_meal_items.map((item) => item.foods.name).filter(Boolean).slice(0, 3).join(", ")

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700/70 dark:bg-zinc-900/35">
      <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Próxima comida</p>
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400/25 to-emerald-400/20 text-2xl">
          🥗
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-zinc-950 dark:text-white">{meal?.name ?? "Planificá tu próxima comida"}</p>
          <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
            {macros ? `${formatNumber(macros.calories)} kcal • ${formatNumber(macros.protein)}g P • ${formatNumber(macros.carbs)}g C • ${formatNumber(macros.fat)}g G` : "Sin comidas cargadas todavía"}
          </p>
          {foods && <p className="mt-1 truncate text-xs text-zinc-500">{foods}</p>}
        </div>
      </div>
    </div>
  )
}

function WaterTracker({ waterGlasses }: { waterGlasses: number }) {
  const liters = waterGlasses * 0.25

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 dark:border-zinc-700/70 dark:bg-zinc-900/35">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-sky-500/20 text-sky-300">
            <Droplets className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Agua</p>
        </div>
        <span className="text-sm font-black tabular-nums">
          <span className="text-sky-400">{liters.toFixed(1).replace(".", ",")}</span>
          <span className="text-zinc-500 dark:text-zinc-400"> / 2,5 L</span>
        </span>
      </div>
      <div className="grid w-full grid-cols-10 place-items-center">
        {Array.from({ length: WATER_TARGET }, (_, i) => (
          <WaterGlassSvg key={i} filled={i < waterGlasses} />
        ))}
      </div>
    </div>
  )
}

function WaterGlassSvg({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 30"
      className={`h-8 w-5 shrink-0 transition-colors duration-200 ease-out ${
        filled
          ? "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)]"
          : "text-zinc-300 dark:text-zinc-600"
      }`}
    >
      <path
        d="M3.25 3.5h11.5l-1.4 22.25a2 2 0 0 1-2 1.75h-4.7a2 2 0 0 1-2-1.75L3.25 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {filled && (
        <path
          d="M5.25 13.25h7.5l-.75 11.2a1.15 1.15 0 0 1-1.15 1.05h-3.7A1.15 1.15 0 0 1 6 24.45l-.75-11.2Z"
          fill="currentColor"
          opacity="0.72"
        />
      )}
      <path d="M5.2 7.2h7.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export default function NutritionSummaryCard({ plan, streak, consumed, waterGlasses }: Props) {
  if (!plan) {
    return (
      <Link href="/nutricion" className="block active:scale-[0.99] transition-transform duration-150 ease-out">
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-5 dark:border-zinc-700 dark:bg-zinc-900/45">
          <div className="flex items-center gap-4">
            <Apple className="h-5 w-5 shrink-0 text-brand-500" />
            <p className="flex-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Sin plan nutricional asignado</p>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
          </div>
        </div>
      </Link>
    )
  }

  const meal = nextMeal(plan)

  return (
    <Link href="/nutricion" className="group block active:scale-[0.99] transition-transform duration-150 ease-out">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-brand-700/20 dark:bg-zinc-900/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-zinc-950/10 to-transparent dark:via-white/20" />
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Apple className="h-5 w-5 text-brand-500" />
            <h2 className="text-xl font-black text-zinc-950 dark:text-white">Nutrición hoy</h2>
            {streak > 0 && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-black text-orange-300">🔥 {streak}</span>}
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform duration-200 ease-out group-hover:translate-x-1" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
          <MacroRing uid="dash-cal" label="kcal" value={consumed.calories} target={plan.target_calories} unit="" color="#ff1f2d" icon="flame" dim={164} compact />

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MacroCard label="Proteínas"    value={consumed.protein} target={plan.target_protein} unit="g" color="#3b82f6" accent="border-blue-500/25"    iconPath={MACRO_PATHS.protein} />
              <MacroCard label="Carbohidratos" value={consumed.carbs}  target={plan.target_carbs}   unit="g" color="#facc15" accent="border-yellow-500/25"  iconPath={MACRO_PATHS.carbs} />
              <MacroCard label="Grasas"       value={consumed.fat}     target={plan.target_fat}     unit="g" color="#34d399" accent="border-emerald-500/25" iconPath={MACRO_PATHS.fat} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
              <MealPreview meal={meal} />
              <WaterTracker waterGlasses={waterGlasses} />
            </div>
          </div>
        </div>
      </section>
    </Link>
  )
}
