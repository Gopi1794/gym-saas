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
  if (!weight_kg || !height_cm || !date_of_birth || !gender || gender === "other") return null

  const age = ageFromDob(date_of_birth)
  if (age < 10 || age > 100) return null

  // Mifflin-St Jeor TMB
  const tmb =
    gender === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

  const factor = ACTIVITY_FACTOR[training_frequency ?? "3-4"] ?? 1.55
  const tdee = Math.round(tmb * factor)

  // Goal adjustments
  let targetCalories: number
  let proteinPerKg: number
  let fatPerKg: number

  switch (goal) {
    case "volumen":
      targetCalories = Math.round(tdee * 1.12)   // +12% surplus
      proteinPerKg   = 1.8
      fatPerKg       = 1.0
      break
    case "definicion":
      targetCalories = Math.round(tdee * 0.82)   // -18% deficit
      proteinPerKg   = 2.2                        // high protein preserves muscle
      fatPerKg       = 0.8
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
