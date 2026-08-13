import type { MealItem, Meal, NutritionPlan } from "@/app/actions/nutrition"

export function calcMacros(items: MealItem[]) {
  return items.reduce(
    (acc, item) => {
      const ratio = item.quantity_grams / 100
      return {
        calories: acc.calories + item.foods.calories * ratio,
        protein:  acc.protein  + item.foods.protein  * ratio,
        carbs:    acc.carbs    + item.foods.carbs     * ratio,
        fat:      acc.fat      + item.foods.fat       * ratio,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export function calcPlanMacros(meals: Meal[]) {
  const all = meals.flatMap(m => m.nutrition_meal_items)
  return calcMacros(all)
}

// ── Mifflin-St Jeor ───────────────────────────────────────────
// Returns { calories, protein, carbs, fat } daily targets
// or null if required data is missing.

type MemberProfile = {
  weight_kg:          number | null
  height_cm:          number | null
  date_of_birth:      string | null       // ISO date "YYYY-MM-DD"
  gender:             "male" | "female" | "other" | null
  training_frequency: "never" | "1-2" | "3-4" | "5+" | null
  goal?:              string | null
}

const ACTIVITY_FACTOR: Record<string, number> = {
  never: 1.2,
  "1-2": 1.375,
  "3-4": 1.55,
  "5+":  1.725,
}

function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function calcNutritionTargets(
  profile: MemberProfile,
  goal: NutritionPlan["goal"]
): { calories: number; protein: number; carbs: number; fat: number } | null {
  const { weight_kg, height_cm, date_of_birth, gender, training_frequency } = profile
  if (!weight_kg || !height_cm || !date_of_birth) return null

  const age = ageFromDob(date_of_birth)
  if (age < 10 || age > 100) return null

  // gender null/other → average of male (+5) and female (-161) intercepts = -78
  const intercept = gender === "male" ? 5 : gender === "female" ? -161 : -78
  const tmb = 10 * weight_kg + 6.25 * height_cm - 5 * age + intercept

  const factor = ACTIVITY_FACTOR[training_frequency ?? "3-4"] ?? 1.55
  const tdee = Math.round(tmb * factor)

  // Goal adjustments
  let targetCalories: number
  let proteinPerKg: number
  let fatPerKg: number

  switch (goal) {
    case "volumen":
      targetCalories = Math.round(tdee * 1.12)
      proteinPerKg   = 1.8
      fatPerKg       = 1.0
      break
    case "definicion":
      targetCalories = Math.round(tdee * 0.82)
      proteinPerKg   = 2.2
      fatPerKg       = 0.8
      break
    case "recomposicion":
      targetCalories = tdee
      proteinPerKg   = 2.5
      fatPerKg       = 0.8
      break
    case "rendimiento":
      targetCalories = Math.round(tdee * 1.08)
      proteinPerKg   = 1.8
      fatPerKg       = 1.0
      break
    case "perdida_moderada":
      targetCalories = Math.round(tdee * 0.90)
      proteinPerKg   = 2.0
      fatPerKg       = 0.9
      break
    case "mantenimiento":
    default:
      targetCalories = tdee
      proteinPerKg   = 1.7
      fatPerKg       = 0.9
      break
  }

  const protein = Math.round(proteinPerKg * weight_kg)
  const fat     = Math.round(fatPerKg * weight_kg)
  // Remaining calories go to carbs (1g protein = 4 kcal, 1g fat = 9 kcal, 1g carbs = 4 kcal)
  const carbsKcal = targetCalories - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(carbsKcal / 4))

  return { calories: targetCalories, protein, carbs, fat }
}

export const CALORIE_MISMATCH_THRESHOLD = 0.10

export function missingTargetFields(
  profile: { weight_kg: number | null; height_cm: number | null; date_of_birth: string | null } | null
): string[] {
  return [
    !profile?.weight_kg && "peso",
    !profile?.height_cm && "altura",
    !profile?.date_of_birth && "fecha de nacimiento",
  ].filter(Boolean) as string[]
}

export const NUTRITION_GOALS = [
  { value: "volumen",          label: "Volumen",               hint: "+12%" },
  { value: "rendimiento",      label: "Rendimiento deportivo",  hint: "+8%" },
  { value: "mantenimiento",    label: "Mantenimiento",          hint: null },
  { value: "recomposicion",    label: "Recomposición",          hint: "proteína alta" },
  { value: "perdida_moderada", label: "Pérdida moderada",       hint: "−10%" },
  { value: "definicion",       label: "Definición",             hint: "−18%" },
] as const

// Para el select del formulario de creación — el % ayuda a decidir
export const NUTRITION_GOAL_OPTIONS: { value: NutritionPlan["goal"]; label: string }[] = NUTRITION_GOALS.map(g => ({
  value: g.value,
  label: g.hint ? `${g.label} (${g.hint})` : g.label,
}))

// Para mostrar en cualquier lugar de solo lectura (editor, panel de adherencia,
// vista del socio) — sin el %. Mostrarle a un socio que su plan es un déficit
// del 18% es una decisión de producto aparte, no algo que se hereda gratis
// de esta constante.
export const NUTRITION_GOAL_LABELS: Partial<Record<NutritionPlan["goal"], string>> = Object.fromEntries(
  NUTRITION_GOALS.map(g => [g.value, g.label])
)

// ── Adherencia ──────────────────────────────────────────────────
// Compartido entre el panel de trainers (NutritionAdherencePanel) y la
// tarjeta de nutrición en el detalle de un socio (members/[id]) — antes
// vivía duplicado solo en el panel.

export function getAdherenceStatus(daysLogged: number, lastLog: string | null) {
  if (daysLogged === 0 || !lastLog) return { label: "Sin registros", color: "bg-zinc-800 text-zinc-500" }
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const isRecent = lastLog === today || lastLog === yesterday
  if (daysLogged >= 5 && isRecent) return { label: "Al día", color: "bg-emerald-500/15 text-emerald-400" }
  if (daysLogged >= 3) return { label: "Regular", color: "bg-amber-500/15 text-amber-400" }
  return { label: "Atrasado", color: "bg-red-500/15 text-red-400" }
}

export function relativeLogDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Hoy"
  if (dateStr === yesterday) return "Ayer"
  const diff = Math.round((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000)
  return `Hace ${diff} días`
}
