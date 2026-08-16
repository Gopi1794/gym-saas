import { describe, it, expect } from "vitest"
import { resolveVariantPrice, resolveVariantCost, calculateSaleTotal, calculateMargin } from "./products"

describe("resolveVariantPrice", () => {
  it("usa el precio de la variante cuando está definido", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: 1500 })).toBe(1500)
  })

  it("cae al precio base del producto cuando la variante no tiene precio propio", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: null })).toBe(1000)
  })
})

describe("resolveVariantCost", () => {
  it("usa el costo de la variante cuando está definido", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: 600 })).toBe(600)
  })

  it("cae al costo base del producto cuando la variante no tiene costo propio", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: null })).toBe(400)
  })
})

describe("calculateSaleTotal", () => {
  it("multiplica precio unitario por cantidad", () => {
    expect(calculateSaleTotal(1500, 3)).toBe(4500)
  })

  it("redondea a 2 decimales", () => {
    expect(calculateSaleTotal(10.005, 3)).toBe(30.02)
  })
})

describe("calculateMargin", () => {
  it("calcula la ganancia total de la venta", () => {
    expect(calculateMargin(1500, 900, 2)).toBe(1200)
  })

  it("puede ser negativo si se vende a pérdida — no es un caso de error", () => {
    expect(calculateMargin(500, 900, 1)).toBe(-400)
  })

  it("es cero cuando precio y costo son iguales", () => {
    expect(calculateMargin(1000, 1000, 5)).toBe(0)
  })
})
