export type NutritionTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodNutrition = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export type NutritionProfileInput = {
  weight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  training_frequency: string | null
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

export function emptyNutritionTotals(): NutritionTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export function addNutritionTotals(left: NutritionTotals, right: NutritionTotals): NutritionTotals {
  return {
    calories: roundToOne(left.calories + right.calories),
    protein: roundToOne(left.protein + right.protein),
    carbs: roundToOne(left.carbs + right.carbs),
    fat: roundToOne(left.fat + right.fat),
  }
}

export function nutritionTotalsForFood(food: FoodNutrition, quantityGrams: number): NutritionTotals {
  const factor = quantityGrams / 100
  return {
    calories: roundToOne(Number(food.calories ?? 0) * factor),
    protein: roundToOne(Number(food.protein ?? 0) * factor),
    carbs: roundToOne(Number(food.carbs ?? 0) * factor),
    fat: roundToOne(Number(food.fat ?? 0) * factor),
  }
}

export function getMissingNutritionProfileFields(profile: NutritionProfileInput | null): string[] {
  if (!profile) return ["peso", "altura", "fecha de nacimiento", "frecuencia de entrenamiento"]

  const missing: string[] = []
  if (!profile.weight_kg || profile.weight_kg <= 0) missing.push("peso")
  if (!profile.height_cm || profile.height_cm <= 0) missing.push("altura")
  if (!profile.date_of_birth) missing.push("fecha de nacimiento")
  if (!profile.training_frequency) missing.push("frecuencia de entrenamiento")
  return missing
}

export function validateNutritionTarget(totalCalories: number, targetCalories: number) {
  const difference = Math.round(targetCalories - totalCalories)
  const tolerance = Math.max(75, Math.round(targetCalories * 0.04))

  return {
    difference,
    tolerance,
    isWithinTarget: Math.abs(difference) <= tolerance,
  }
}