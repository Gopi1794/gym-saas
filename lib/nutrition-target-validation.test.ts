import { describe, expect, it } from "vitest"
import {
  addNutritionTotals,
  emptyNutritionTotals,
  getMissingNutritionProfileFields,
  nutritionTotalsForFood,
  validateNutritionTarget,
} from "./nutrition-target-validation"

describe("nutrition target validation", () => {
  it("suma nutrientes usando la cantidad real en gramos", () => {
    const chicken = nutritionTotalsForFood({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }, 150)
    const rice = nutritionTotalsForFood({ calories: 130, protein: 2.7, carbs: 28, fat: 0.3 }, 200)

    expect(addNutritionTotals(chicken, rice)).toEqual({ calories: 507.5, protein: 51.9, carbs: 56, fat: 6 })
  })

  it("acepta una diferencia pequeña y rechaza una brecha calórica importante", () => {
    expect(validateNutritionTarget(2380, 2400).isWithinTarget).toBe(true)
    expect(validateNutritionTarget(2100, 2400)).toMatchObject({ isWithinTarget: false, difference: 300 })
  })

  it("identifica solo los datos corporales faltantes", () => {
    expect(getMissingNutritionProfileFields({ weight_kg: 80, height_cm: null, date_of_birth: null, training_frequency: "3-4" }))
      .toEqual(["altura", "fecha de nacimiento"])
  })

  it("no reporta faltantes cuando el perfil nutricional está completo", () => {
    expect(getMissingNutritionProfileFields({ weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01", training_frequency: "3-4" }))
      .toEqual([])
    expect(emptyNutritionTotals()).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})