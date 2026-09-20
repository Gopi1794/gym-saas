export type ProductMacros = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type OpenFoodFactsProduct = {
  barcode: string
  name: string
  brand: string | null
  quantityLabel: string | null
  servingLabel: string | null
  servingQuantity: number | null
  imageUrl: string | null
  macrosPer100: ProductMacros
}

type OpenFoodFactsPayload = {
  status?: number | string
  product?: {
    code?: string
    product_name?: string
    product_name_es?: string
    abbreviated_product_name?: string
    brands?: string
    quantity?: string
    serving_size?: string
    serving_quantity?: number | string
    serving_quantity_unit?: string
    image_front_small_url?: string
    image_front_url?: string
    nutriments?: Record<string, unknown>
  }
}

function finiteNonNegative(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  return cleaned || null
}

export function normalizeBarcode(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, "")
  return /^\d{8,14}$/.test(normalized) ? normalized : null
}

export function parseOpenFoodFactsProduct(
  rawPayload: unknown,
  requestedBarcode: string,
): OpenFoodFactsProduct | null {
  if (!rawPayload || typeof rawPayload !== "object") return null

  const payload = rawPayload as OpenFoodFactsPayload
  if (!payload.product || payload.status === 0 || payload.status === "0") return null

  const product = payload.product
  const nutriments = product.nutriments ?? {}
  const caloriesFromKcal = finiteNonNegative(nutriments["energy-kcal_100g"])
  const energyKj = finiteNonNegative(nutriments["energy-kj_100g"] ?? nutriments.energy_100g)
  const calories = caloriesFromKcal ?? (energyKj === null ? null : energyKj / 4.184)
  const protein = finiteNonNegative(nutriments.proteins_100g)
  const carbs = finiteNonNegative(nutriments.carbohydrates_100g)
  const fat = finiteNonNegative(nutriments.fat_100g)

  if (calories === null || protein === null || carbs === null || fat === null) return null

  const name = cleanText(product.product_name_es)
    ?? cleanText(product.product_name)
    ?? cleanText(product.abbreviated_product_name)
  if (!name) return null

  const servingUnit = cleanText(product.serving_quantity_unit)?.toLowerCase()
  const rawServingQuantity = finiteNonNegative(product.serving_quantity)
  const servingQuantity = rawServingQuantity !== null && (!servingUnit || servingUnit === "g" || servingUnit === "ml")
    ? rawServingQuantity
    : null

  return {
    barcode: cleanText(product.code) ?? requestedBarcode,
    name,
    brand: cleanText(product.brands),
    quantityLabel: cleanText(product.quantity),
    servingLabel: cleanText(product.serving_size),
    servingQuantity,
    imageUrl: cleanText(product.image_front_small_url) ?? cleanText(product.image_front_url),
    macrosPer100: { calories, protein, carbs, fat },
  }
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateProductConsumption(product: OpenFoodFactsProduct, quantity: number): ProductMacros {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) {
    throw new Error("Invalid product quantity")
  }

  const ratio = quantity / 100
  return {
    calories: Math.round(product.macrosPer100.calories * ratio),
    protein: round(product.macrosPer100.protein * ratio, 1),
    carbs: round(product.macrosPer100.carbs * ratio, 1),
    fat: round(product.macrosPer100.fat * ratio, 1),
  }
}
