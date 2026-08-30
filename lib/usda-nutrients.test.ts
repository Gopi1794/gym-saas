import { describe, expect, it } from "vitest"
import { getUsdaCoreNutrients } from "./usda-nutrients"

const completeNutrients = [
  { nutrientId: 1008, value: 165 },
  { nutrientId: 1003, value: 31 },
  { nutrientId: 1005, value: 0 },
  { nutrientId: 1004, value: 3.6 },
  { nutrientId: 1079, value: 0 },
  { nutrientId: 1093, value: 74 },
]

describe("getUsdaCoreNutrients", () => {
  it("maps the USDA nutrient ids used by SR Legacy", () => {
    expect(getUsdaCoreNutrients(completeNutrients)).toEqual({
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
      sodium: 74,
    })
  })

  it("rejects incomplete or zero-calorie nutrient responses", () => {
    expect(getUsdaCoreNutrients(completeNutrients.filter((nutrient) => nutrient.nutrientId !== 1008))).toBeNull()
    expect(getUsdaCoreNutrients(completeNutrients.map((nutrient) => nutrient.nutrientId === 1008 ? { ...nutrient, value: 0 } : nutrient))).toBeNull()
  })
})