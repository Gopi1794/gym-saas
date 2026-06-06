"use server"

import Anthropic from "@anthropic-ai/sdk"

interface USDAFood {
  fdcId: number
  description: string
  foodNutrients: { nutrientId: number; value: number }[]
}

function get(food: USDAFood, id: number) {
  return Math.round((food.foodNutrients.find(n => n.nutrientId === id)?.value ?? 0) * 10) / 10
}

export interface USDAResult {
  fdcId: number
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  sugars: number | null
  saturated_fat: number | null
  potassium: number | null
  calcium: number | null
  magnesium: number | null
  zinc: number | null
  iron: number | null
  vitamin_b12: number | null
}

async function translateToEnglish(query: string): Promise<string> {
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [{
      role: "user",
      content: `Translate this food name to English for a USDA database search. Reply with ONLY the English translation, nothing else: "${query}"`,
    }],
  })
  return (msg.content[0] as { type: string; text: string }).text.trim()
}

async function translateNames(names: string[]): Promise<string[]> {
  const client = new Anthropic()
  const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n")
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Traducí estos nombres de alimentos del inglés al español rioplatense, en formato conciso (sin explicaciones). Devolvé exactamente ${names.length} líneas numeradas con el mismo formato:\n\n${list}`,
    }],
  })

  const text = (msg.content[0] as { type: string; text: string }).text
  const lines = text.split("\n").filter(l => /^\d+\./.test(l.trim()))
  return lines.map(l => l.replace(/^\d+\.\s*/, "").trim())
}

export async function searchUSDA(query: string): Promise<USDAResult[]> {
  const key = process.env.USDA_API_KEY
  if (!key) throw new Error("USDA_API_KEY no está configurada en .env.local")

  const englishQuery = await translateToEnglish(query)
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: englishQuery, dataType: ["Foundation", "SR Legacy"], pageSize: 12 }),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Error USDA ${res.status}: ${await res.text().catch(() => "")}`)

  const data = await res.json() as { foods: USDAFood[] }
  const foods = data.foods ?? []
  if (foods.length === 0) return []

  const englishNames = foods.map(f => f.description)
  const spanishNames = await translateNames(englishNames)

  return foods.map((f, i) => ({
    fdcId:         f.fdcId,
    name:          spanishNames[i] ?? f.description,
    calories:      get(f, 1008),
    protein:       get(f, 1003),
    carbs:         get(f, 1005),
    fat:           get(f, 1004),
    fiber:         get(f, 1079),
    sodium:        get(f, 1093),
    sugars:        get(f, 2000) || null,
    saturated_fat: get(f, 1258) || null,
    potassium:     get(f, 1092) || null,
    calcium:       get(f, 1087) || null,
    magnesium:     get(f, 1090) || null,
    zinc:          get(f, 1095) || null,
    iron:          get(f, 1089) || null,
    vitamin_b12:   get(f, 1178) || null,
  }))
}
