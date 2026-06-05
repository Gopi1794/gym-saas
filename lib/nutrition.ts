import type { MealItem, Meal } from "@/app/actions/nutrition"

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
