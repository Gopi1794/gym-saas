import { describe, it, expect } from "vitest"
import { computeDailyTotals } from "./nutrition-totals"

const chicken = { calories: 165, protein: 31, carbs: 0, fat: 3.6 } // por 100g

const plan = {
  nutrition_meals: [
    {
      id: "meal-1",
      nutrition_meal_items: [
        { food_id: "food-1", foods: chicken },
      ],
    },
  ],
}

describe("computeDailyTotals", () => {
  it("suma las comidas planificadas tildadas según los gramos reales", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-1", actual_grams: 200 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(330) // 165 * 2
    expect(result.protein).toBe(62)   // 31 * 2
  })

  it("suma los quick logs (fotos) sobre las comidas planificadas", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-1", actual_grams: 100 }] }]
    const quickTotals = { calories: 300, protein: 20, carbs: 40, fat: 10 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(465) // 165 + 300
    expect(result.protein).toBe(51)   // 31 + 20
  })

  it("ignora logs de comidas que no existen en el plan actual", () => {
    const mealLogs = [{ meal_id: "meal-inexistente", items: [{ food_id: "food-1", actual_grams: 100 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(0)
  })

  it("ignora items que no existen en la comida del plan", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-inexistente", actual_grams: 100 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(0)
  })

  it("funciona sin plan activo — solo suma quick logs", () => {
    const quickTotals = { calories: 500, protein: 30, carbs: 50, fat: 15 }
    const result = computeDailyTotals(null, [], quickTotals)
    expect(result).toEqual(quickTotals)
  })
})
