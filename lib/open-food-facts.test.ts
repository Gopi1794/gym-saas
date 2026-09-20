import { describe, expect, it } from "vitest"
import { calculateProductConsumption, normalizeBarcode, parseOpenFoodFactsProduct } from "./open-food-facts"

describe("normalizeBarcode", () => {
  it("accepts GTIN values and removes visual separators", () => {
    expect(normalizeBarcode("779-1234 567890")).toBe("7791234567890")
  })

  it("rejects non-numeric and implausible barcodes", () => {
    expect(normalizeBarcode("ABC123")).toBeNull()
    expect(normalizeBarcode("1234")).toBeNull()
  })
})

describe("parseOpenFoodFactsProduct", () => {
  it("normalizes complete nutrients per 100 grams", () => {
    const product = parseOpenFoodFactsProduct({
      status: 1,
      product: {
        code: "7791234567890",
        product_name_es: "Yogur natural",
        brands: "Marca argentina",
        serving_quantity: 190,
        serving_quantity_unit: "g",
        nutriments: {
          "energy-kcal_100g": 75,
          proteins_100g: 4,
          carbohydrates_100g: 9,
          fat_100g: 2.5,
        },
      },
    }, "7791234567890")

    expect(product).toMatchObject({
      name: "Yogur natural",
      servingQuantity: 190,
      macrosPer100: { calories: 75, protein: 4, carbs: 9, fat: 2.5 },
    })
  })

  it("rejects products with incomplete core macros", () => {
    expect(parseOpenFoodFactsProduct({
      status: 1,
      product: {
        product_name: "Producto incompleto",
        nutriments: { "energy-kcal_100g": 100, proteins_100g: 2 },
      },
    }, "7791234567890")).toBeNull()
  })

  it("rejects malformed API responses", () => {
    expect(parseOpenFoodFactsProduct(null, "7791234567890")).toBeNull()
    expect(parseOpenFoodFactsProduct("not-json", "7791234567890")).toBeNull()
  })
})

describe("calculateProductConsumption", () => {
  it("calculates the consumed amount instead of returning values per 100 grams", () => {
    const result = calculateProductConsumption({
      barcode: "7791234567890",
      name: "Yogur",
      brand: null,
      quantityLabel: null,
      servingLabel: null,
      servingQuantity: null,
      imageUrl: null,
      macrosPer100: { calories: 75, protein: 4, carbs: 9, fat: 2.5 },
    }, 190)

    expect(result).toEqual({ calories: 143, protein: 7.6, carbs: 17.1, fat: 4.8 })
  })
})
