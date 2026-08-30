export type UsdaFoodNutrient = {
  nutrientId: number
  value: number | null
}

export type UsdaCoreNutrients = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

function nutrientValue(nutrients: UsdaFoodNutrient[], nutrientId: number) {
  const value = nutrients.find((nutrient) => nutrient.nutrientId === nutrientId)?.value
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function getUsdaCoreNutrients(nutrients: UsdaFoodNutrient[]): UsdaCoreNutrients | null {
  const calories = nutrientValue(nutrients, 1008)
  const protein = nutrientValue(nutrients, 1003)
  const carbs = nutrientValue(nutrients, 1005)
  const fat = nutrientValue(nutrients, 1004)

  if (calories === null || calories <= 0 || protein === null || carbs === null || fat === null) {
    return null
  }

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: nutrientValue(nutrients, 1079) ?? 0,
    sodium: nutrientValue(nutrients, 1093) ?? 0,
  }
}