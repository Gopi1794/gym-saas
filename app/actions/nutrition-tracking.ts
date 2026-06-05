"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// ── Types ──────────────────────────────────────────────────────

export type NutritionLog = {
  id: string
  member_id: string
  meal_id: string
  log_date: string
}

export type WaterLog = {
  id: string
  member_id: string
  log_date: string
  glasses: number
}

export type WeightLog = {
  id: string
  member_id: string
  log_date: string
  weight_kg: number
  notes: string | null
}

// ── Meal check-off ─────────────────────────────────────────────

export async function toggleMealLog(mealId: string, date: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: existing } = await supabase
    .from("nutrition_logs" as never)
    .select("id")
    .eq("member_id", user.id)
    .eq("meal_id", mealId)
    .eq("log_date", date)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("nutrition_logs" as never)
      .delete()
      .eq("id", (existing as { id: string }).id)
    return false
  } else {
    await supabase
      .from("nutrition_logs" as never)
      .insert({ member_id: user.id, meal_id: mealId, log_date: date } as never)
    return true
  }
}

export async function getMealLogsForDate(memberId: string, date: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_logs" as never)
    .select("meal_id")
    .eq("member_id", memberId)
    .eq("log_date", date)
  return ((data ?? []) as { meal_id: string }[]).map(r => r.meal_id)
}

export async function getNutritionStreak(memberId: string): Promise<number> {
  const supabase = createClient()
  // Get distinct dates with at least one meal logged, last 60 days
  const { data } = await supabase
    .from("nutrition_logs" as never)
    .select("log_date")
    .eq("member_id", memberId)
    .gte("log_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    .order("log_date", { ascending: false })

  if (!data || (data as { log_date: string }[]).length === 0) return 0

  const dates = [...new Set((data as { log_date: string }[]).map(r => r.log_date))].sort().reverse()
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

  // Streak must include today or yesterday
  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

// ── Water log ──────────────────────────────────────────────────

export async function getWaterToday(memberId: string): Promise<number> {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data } = await supabase
    .from("water_logs" as never)
    .select("glasses")
    .eq("member_id", memberId)
    .eq("log_date", today)
    .maybeSingle()
  return (data as { glasses: number } | null)?.glasses ?? 0
}

export async function setWaterToday(glasses: number): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const today = new Date().toISOString().split("T")[0]
  await supabase
    .from("water_logs" as never)
    .upsert({ member_id: user.id, log_date: today, glasses } as never, { onConflict: "member_id,log_date" })
  revalidatePath("/nutricion")
}

// ── Weight log ─────────────────────────────────────────────────

export async function logWeight(weightKg: number, notes?: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const today = new Date().toISOString().split("T")[0]
  await supabase
    .from("weight_logs" as never)
    .upsert({ member_id: user.id, log_date: today, weight_kg: weightKg, notes: notes ?? null } as never, { onConflict: "member_id,log_date" })
  // Also update the profile snapshot
  await supabase.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id)
  revalidatePath("/nutricion")
  revalidatePath("/progress")
}

export async function getWeightHistory(memberId: string, days = 90): Promise<WeightLog[]> {
  const supabase = createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0]
  const { data } = await supabase
    .from("weight_logs" as never)
    .select("*")
    .eq("member_id", memberId)
    .gte("log_date", since)
    .order("log_date", { ascending: true })
  return (data ?? []) as unknown as WeightLog[]
}
