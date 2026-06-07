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

// ── Meal logging ────────────────────────────────────────────────

export type MealLog = {
  meal_id: string
  log_id: string
  items: { food_id: string; actual_grams: number }[]
}

export async function getMealLogsForDate(memberId: string, date: string): Promise<MealLog[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_logs" as never)
    .select("id, meal_id, nutrition_log_items(food_id, actual_grams)")
    .eq("member_id", memberId)
    .eq("log_date", date)

  if (!data) return []

  return (data as unknown as {
    id: string
    meal_id: string
    nutrition_log_items: { food_id: string; actual_grams: number }[]
  }[]).map(row => ({
    meal_id: row.meal_id,
    log_id: row.id,
    items: row.nutrition_log_items ?? [],
  }))
}

export async function logMealWithItems(
  mealId: string,
  date: string,
  items: { food_id: string; actual_grams: number }[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: log, error: logError } = await supabase
    .from("nutrition_logs" as never)
    .upsert(
      { member_id: user.id, meal_id: mealId, log_date: date } as never,
      { onConflict: "member_id,meal_id,log_date" }
    )
    .select("id")
    .single()

  if (logError || !log) throw new Error("Failed to save log")

  const logId = (log as { id: string }).id

  await supabase.from("nutrition_log_items" as never).delete().eq("log_id", logId)

  if (items.length > 0) {
    await supabase.from("nutrition_log_items" as never).insert(
      items.map(item => ({ log_id: logId, food_id: item.food_id, actual_grams: item.actual_grams } as never))
    )
  }

  revalidatePath("/nutricion")
}

export async function removeMealLog(mealId: string, date: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("nutrition_logs" as never)
    .delete()
    .eq("member_id", user.id)
    .eq("meal_id", mealId)
    .eq("log_date", date)

  revalidatePath("/nutricion")
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

// ── Adherence report (trainer view) ───────────────────────────

export type AdherenceEntry = {
  plan_id: string
  plan_name: string
  goal: string
  member_id: string
  member_name: string
  avatar_url: string | null
  days_logged: number
  last_log: string | null
  target_calories: number | null
}

export async function getAdherenceReport(gymId: string): Promise<AdherenceEntry[]> {
  const supabase = createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]

  const { data: plans } = await supabase
    .from("nutrition_plans" as never)
    .select("id, name, goal, member_id, target_calories, profiles!nutrition_plans_member_id_fkey(full_name, avatar_url)")
    .eq("gym_id", gymId)
    .eq("is_active", true)

  if (!plans || (plans as unknown[]).length === 0) return []

  const memberIds = (plans as { member_id: string }[]).map(p => p.member_id)

  const { data: logs } = await supabase
    .from("nutrition_logs" as never)
    .select("member_id, log_date")
    .in("member_id", memberIds)
    .gte("log_date", sevenDaysAgo)

  const logsByMember: Record<string, Set<string>> = {}
  for (const log of (logs ?? []) as { member_id: string; log_date: string }[]) {
    if (!logsByMember[log.member_id]) logsByMember[log.member_id] = new Set()
    logsByMember[log.member_id].add(log.log_date)
  }

  return (plans as unknown as {
    id: string; name: string; goal: string; member_id: string; target_calories: number | null
    profiles: { full_name: string | null; avatar_url: string | null } | null
  }[]).map(p => {
    const memberLogs = logsByMember[p.member_id] ?? new Set<string>()
    const dates = [...memberLogs].sort()
    return {
      plan_id: p.id,
      plan_name: p.name,
      goal: p.goal,
      member_id: p.member_id,
      member_name: p.profiles?.full_name ?? "Socio",
      avatar_url: p.profiles?.avatar_url ?? null,
      days_logged: memberLogs.size,
      last_log: dates[dates.length - 1] ?? null,
      target_calories: p.target_calories,
    }
  }).sort((a, b) => a.days_logged - b.days_logged)
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
