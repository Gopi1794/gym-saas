import { describe, expect, it } from "vitest"
import { matchesFoodQuery } from "./food-search"

const food = {
  name: "Vacuno, corazón de cuadril",
  category: "Carnes y derivados",
  subcategory: "Vacuno",
  scientific_name: null,
}

describe("matchesFoodQuery", () => {
  it("matches names without requiring accents", () => {
    expect(matchesFoodQuery(food, "corazon")).toBe(true)
  })

  it("matches ARGENFOODS categories and subcategories", () => {
    expect(matchesFoodQuery(food, "carnes")).toBe(true)
    expect(matchesFoodQuery(food, "vacuno")).toBe(true)
  })

  it("rejects unrelated queries", () => {
    expect(matchesFoodQuery(food, "pescado")).toBe(false)
  })
})
