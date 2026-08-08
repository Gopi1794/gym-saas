type FoodMacros = { calories: number; protein: number; carbs: number; fat: number }
type MealItemRow = { food_id: string; foods: FoodMacros }
type PlanMeal = { id: string; nutrition_meal_items: MealItemRow[] }
type PlanForTotals = { nutrition_meals?: PlanMeal[] } | null

type MealLogRow = { meal_id: string; items: { food_id: string; actual_grams: number }[] }

/**
 * Total del día = comidas planificadas tildadas (gramos reales * macros por
 * 100g) + quick logs (fotos, ya vienen en valores absolutos). Usado tanto
 * para el contexto que se le pasa a Claude en el chat como para la
 * verificación de umbral de calorías.
 */
export function computeDailyTotals(
  plan: PlanForTotals,
  mealLogs: MealLogRow[],
  quickTotals: FoodMacros
): FoodMacros {
  let totalCal = quickTotals.calories
  let totalProt = quickTotals.protein
  let totalCarbs = quickTotals.carbs
  let totalFat = quickTotals.fat

  for (const log of mealLogs) {
    const meal = plan?.nutrition_meals?.find(m => m.id === log.meal_id)
    if (!meal) continue
    for (const logItem of log.items) {
      const mealItem = meal.nutrition_meal_items?.find(i => i.food_id === logItem.food_id)
      if (!mealItem?.foods) continue
      const f = mealItem.foods
      const r = logItem.actual_grams / 100
      totalCal += (f.calories ?? 0) * r
      totalProt += (f.protein ?? 0) * r
      totalCarbs += (f.carbs ?? 0) * r
      totalFat += (f.fat ?? 0) * r
    }
  }

  return { calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }
}
