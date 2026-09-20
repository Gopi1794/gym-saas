import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMemberNutritionPlan } from "@/app/actions/nutrition"
import { nowMinutesOfDayAR } from "@/lib/date-ar"
import { matchMealByTime } from "@/lib/nutrition-photo-match"
import { normalizeBarcode, parseOpenFoodFactsProduct } from "@/lib/open-food-facts"

const OPEN_FOOD_FACTS_FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "abbreviated_product_name",
  "brands",
  "quantity",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "image_front_small_url",
  "image_front_url",
  "nutriments",
].join(",")

export async function GET(
  _request: NextRequest,
  { params }: { params: { barcode: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const barcode = normalizeBarcode(params.barcode)
  if (!barcode) {
    return NextResponse.json({ error: "El código de barras no es válido." }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const userAgent = process.env.OPEN_FOOD_FACTS_USER_AGENT ?? `Voltia/0.1 (${appUrl})`
  // Open Food Facts documents the v2 product endpoint for barcode scanning.
  // Unlike the current v3 field projection, it returns normalized *_100g
  // nutrients consistently, which is the contract required by this flow.
  const endpoint = new URL(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
  endpoint.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS)

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers: { "User-Agent": userAgent },
      next: { revalidate: 86_400 },
    })
  } catch {
    return NextResponse.json(
      { error: "No pudimos consultar Open Food Facts. Intentá nuevamente." },
      { status: 503 },
    )
  }

  if (response.status === 404) {
    return NextResponse.json({ error: "Ese producto todavía no está en Open Food Facts." }, { status: 404 })
  }
  if (response.status === 429 || response.status === 503) {
    return NextResponse.json(
      { error: "Open Food Facts está temporalmente ocupado. Intentá nuevamente en unos segundos." },
      { status: 503, headers: { "Retry-After": response.headers.get("Retry-After") ?? "30" } },
    )
  }
  if (!response.ok) {
    return NextResponse.json({ error: "No pudimos consultar ese producto." }, { status: 502 })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return NextResponse.json(
      { error: "Open Food Facts devolvió una respuesta inválida. Intentá nuevamente." },
      { status: 502 },
    )
  }

  const product = parseOpenFoodFactsProduct(payload, barcode)
  if (!product) {
    return NextResponse.json(
      { error: "Encontramos el producto, pero su información nutricional está incompleta." },
      { status: 422 },
    )
  }

  const plan = await getMemberNutritionPlan(user.id)
  const matchedMeal = plan?.nutrition_meals
    ? matchMealByTime(nowMinutesOfDayAR(), plan.nutrition_meals)
    : null

  return NextResponse.json({
    product,
    mealMatch: {
      mealId: matchedMeal?.id ?? null,
      mealName: matchedMeal?.name ?? null,
    },
    attribution: {
      name: "Open Food Facts",
      url: `https://world.openfoodfacts.org/product/${barcode}`,
    },
  })
}
