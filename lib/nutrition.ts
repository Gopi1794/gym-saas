import type { MealItem, Meal, NutritionPlan, GymNutritionDefaults } from "@/app/actions/nutrition"

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

export type MemberProfile = {
  weight_kg:           number | null
  height_cm:           number | null
  date_of_birth:       string | null       // ISO date "YYYY-MM-DD"
  gender:              "male" | "female" | "other" | null
  training_frequency:  "never" | "1-2" | "3-4" | "5+" | null
  daily_activity:      "sedentary" | "moderate" | "active" | null
  metabolic_reference: "male" | "female" | null
  goal?:               string | null
}

// Actividad × frecuencia. La fila "moderate" es idéntica, valor por valor, a
// la tabla 1D que existía antes de este cambio — así un perfil sin
// daily_activity (cae a "moderate" más abajo) calcula exactamente lo mismo
// que calculaba antes.
const ACTIVITY_FACTOR: Record<string, Record<string, number>> = {
  sedentary: { never: 1.2, "1-2": 1.3,   "3-4": 1.45,  "5+": 1.6   },
  moderate:  { never: 1.2, "1-2": 1.375, "3-4": 1.55,  "5+": 1.725 },
  active:    { never: 1.3, "1-2": 1.45,  "3-4": 1.65,  "5+": 1.8   },
}

function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Metabolismo basal (Mifflin-St Jeor). Separado de calcNutritionTargets
// porque validateNutritionSafety necesita el TMB de forma independiente del
// resto del cálculo (para chequear que el objetivo final no quede por
// debajo de él).
export function calcTmb(
  profile: Pick<MemberProfile, "weight_kg" | "height_cm" | "date_of_birth" | "gender" | "metabolic_reference">
): number | null {
  const { weight_kg, height_cm, date_of_birth, gender, metabolic_reference } = profile
  if (!weight_kg || !height_cm || !date_of_birth) return null

  const age = ageFromDob(date_of_birth)
  if (age < 10 || age > 100) return null

  // gender 'male'/'female' manda siempre. Si no, hace falta que el trainer
  // haya elegido una referencia metabólica explícita — nunca se promedia
  // un intercepto (antes esto hacía "-78" para 'other', un promedio sin
  // base fisiológica).
  let intercept: number
  if (gender === "male") intercept = 5
  else if (gender === "female") intercept = -161
  else if (metabolic_reference === "male") intercept = 5
  else if (metabolic_reference === "female") intercept = -161
  else return null

  return 10 * weight_kg + 6.25 * height_cm - 5 * age + intercept
}

// Defaults de proteína/ajuste calórico/grasa por objetivo. Punto de partida
// configurable — gym_nutrition_defaults (por gym) y calcNutritionTargets's
// `overrides` (por plan) pueden reemplazar calorieAdjustmentPct/proteinPerKg;
// fatPerKg siempre sale de acá (no se expone como input, ver spec sección 4).
export function defaultNutritionSettingsForGoal(goal: NutritionPlan["goal"]): {
  calorieAdjustmentPct: number
  proteinPerKg: number
  fatPerKg: number
} {
  switch (goal) {
    case "volumen":          return { calorieAdjustmentPct: 12,  proteinPerKg: 1.8, fatPerKg: 1.0 }
    case "definicion":       return { calorieAdjustmentPct: -18, proteinPerKg: 2.2, fatPerKg: 0.8 }
    case "recomposicion":    return { calorieAdjustmentPct: 0,   proteinPerKg: 2.0, fatPerKg: 0.8 }
    case "rendimiento":      return { calorieAdjustmentPct: 8,   proteinPerKg: 1.8, fatPerKg: 1.0 }
    case "perdida_moderada": return { calorieAdjustmentPct: -10, proteinPerKg: 2.0, fatPerKg: 0.9 }
    case "mantenimiento":
    default:                 return { calorieAdjustmentPct: 0,   proteinPerKg: 1.7, fatPerKg: 0.9 }
  }
}

// Misma tabla que defaultNutritionSettingsForGoal, pero leída desde la
// configuración del gym (editable por el admin) en vez de los hardcodeados
// de arriba. Usada por la UI para precargar los inputs editables al crear
// un plan — ver NutritionPlansPanel.tsx (Task 6).
export function gymDefaultsForGoal(
  defaults: GymNutritionDefaults,
  goal: NutritionPlan["goal"]
): { pct: number; protein: number } {
  switch (goal) {
    case "volumen":          return { pct: defaults.volumen_pct,          protein: defaults.volumen_protein }
    case "rendimiento":      return { pct: defaults.rendimiento_pct,      protein: defaults.rendimiento_protein }
    case "recomposicion":    return { pct: 0,                             protein: defaults.recomposicion_protein }
    case "perdida_moderada": return { pct: defaults.perdida_moderada_pct, protein: defaults.perdida_moderada_protein }
    case "definicion":       return { pct: defaults.definicion_pct,       protein: defaults.definicion_protein }
    case "mantenimiento":
    default:                 return { pct: 0,                             protein: defaults.mantenimiento_protein }
  }
}

export function calcNutritionTargets(
  profile: MemberProfile,
  goal: NutritionPlan["goal"],
  overrides?: { calorieAdjustmentPct?: number; proteinPerKg?: number }
): { calories: number; protein: number; carbs: number; fat: number } | null {
  const tmb = calcTmb(profile)
  if (tmb == null) return null

  const activityRow = ACTIVITY_FACTOR[profile.daily_activity ?? "moderate"] ?? ACTIVITY_FACTOR.moderate
  const factor = activityRow[profile.training_frequency ?? "3-4"] ?? activityRow["3-4"]
  const tdee = Math.round(tmb * factor)

  const defaults = defaultNutritionSettingsForGoal(goal)
  const calorieAdjustmentPct = overrides?.calorieAdjustmentPct ?? defaults.calorieAdjustmentPct
  const proteinPerKg = overrides?.proteinPerKg ?? defaults.proteinPerKg
  const fatPerKg = defaults.fatPerKg

  const targetCalories = Math.round(tdee * (1 + calorieAdjustmentPct / 100))
  const weightKg = profile.weight_kg as number // calcTmb ya validó que no es null/0
  const protein = Math.round(proteinPerKg * weightKg)
  const fat     = Math.round(fatPerKg * weightKg)
  // Remaining calories go to carbs (1g protein = 4 kcal, 1g fat = 9 kcal, 1g carbs = 4 kcal)
  const carbsKcal = targetCalories - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(carbsKcal / 4))

  return { calories: targetCalories, protein, carbs, fat }
}

// Límites de seguridad no bloqueantes — ver spec sección 5. No impide
// guardar el plan; solo marca needs_review para que el trainer lo revise.
export function validateNutritionSafety(
  targets: { calories: number; protein: number },
  tmb: number,
  calorieAdjustmentPct: number,
  proteinPerKg: number
): { needsReview: boolean; reason: string | null } {
  const reasons: string[] = []
  if (targets.calories < tmb) reasons.push("El objetivo calórico queda por debajo del metabolismo basal (TMB).")
  if (targets.calories < 1200) reasons.push("El objetivo calórico queda por debajo de 1200 kcal.")
  if (calorieAdjustmentPct < -25) reasons.push("El déficit supera el 25%.")
  if (calorieAdjustmentPct > 20) reasons.push("El superávit supera el 20%.")
  if (proteinPerKg < 1.2) reasons.push("La proteína queda por debajo de 1.2 g/kg.")
  if (proteinPerKg > 3.0) reasons.push("La proteína supera 3.0 g/kg.")
  return { needsReview: reasons.length > 0, reason: reasons.length > 0 ? reasons.join(" ") : null }
}

export const CALORIE_MISMATCH_THRESHOLD = 0.10

export function missingTargetFields(
  profile: {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender?: "male" | "female" | "other" | null
    metabolic_reference?: "male" | "female" | null
  } | null
): string[] {
  const needsMetabolicReference =
    profile != null &&
    profile.gender !== "male" &&
    profile.gender !== "female" &&
    !profile.metabolic_reference

  return [
    !profile?.weight_kg && "peso",
    !profile?.height_cm && "altura",
    !profile?.date_of_birth && "fecha de nacimiento",
    needsMetabolicReference && "referencia metabólica",
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
