"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calcNutritionTargets, CALORIE_MISMATCH_THRESHOLD } from "@/lib/nutrition"
import { getMemberProfileForPlan, getMemberNutritionPlan } from "@/app/actions/nutrition"
import { todayAR, hourAR } from "@/lib/date-ar"
import { computeDailyTotals } from "@/lib/nutrition-totals"
import type { NutritionPlan } from "@/app/actions/nutrition"

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

export async function getTodayConsumedMacros(
  memberId: string,
  date: string
): Promise<{ calories: number; protein: number; carbs: number; fat: number }> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_logs" as never)
    .select("nutrition_log_items(actual_grams, foods(calories, protein, carbs, fat))")
    .eq("member_id", memberId)
    .eq("log_date", date)

  if (!data) return { calories: 0, protein: 0, carbs: 0, fat: 0 }

  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const log of data as unknown as {
    nutrition_log_items: { actual_grams: number; foods: { calories: number; protein: number; carbs: number; fat: number } }[]
  }[]) {
    for (const item of log.nutrition_log_items ?? []) {
      const ratio = item.actual_grams / 100
      calories += item.foods.calories * ratio
      protein  += item.foods.protein  * ratio
      carbs    += item.foods.carbs    * ratio
      fat      += item.foods.fat      * ratio
    }
  }
  return {
    calories: Math.round(calories),
    protein:  Math.round(protein),
    carbs:    Math.round(carbs),
    fat:      Math.round(fat),
  }
}

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

async function notifyTrainerOfWeightDrift(
  memberId: string,
  plan: { id: string; gym_id: string; target_calories: number; goal: NutritionPlan["goal"] },
  newProfile: {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
  },
  oldWeight: number | null,
  newWeight: number
): Promise<void> {
  const newTargets = calcNutritionTargets(newProfile, plan.goal)
  if (!newTargets) return

  const diff = Math.abs((plan.target_calories - newTargets.calories) / newTargets.calories)
  if (diff <= CALORIE_MISMATCH_THRESHOLD) return

  const supabase = createClient()
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("trainer_id, full_name")
    .eq("id", memberId)
    .single() as unknown as { data: { trainer_id: string | null; full_name: string | null } | null }

  const admin = createAdminClient()
  let recipientIds: string[]

  if (memberProfile?.trainer_id) {
    recipientIds = [memberProfile.trainer_id]
  } else {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("gym_id", plan.gym_id)
      .eq("role", "admin")
    recipientIds = (admins ?? []).map((a: { id: string }) => a.id)
  }

  if (recipientIds.length === 0) return

  const dedupKey = `weight_drift:${plan.id}:${plan.target_calories}`
  const memberName = memberProfile?.full_name ?? "un socio"

  // notifications_dedup_idx es un índice PARCIAL (where dedup_key is not null)
  // — Postgres no lo usa para ON CONFLICT salvo que la sentencia repita el
  // mismo predicado, y el onConflict de supabase-js no permite expresarlo
  // ("there is no unique or exclusion constraint matching the ON CONFLICT
  // specification"). Insert por destinatario en vez de upsert en lote: un
  // insert batch es atómico, así que si UN destinatario ya tenía la
  // notificación, aborta el insert completo y ningún otro la recibe.
  for (const userId of recipientIds) {
    try {
      const { error } = await admin
        .from("notifications" as never)
        .insert({
          user_id: userId,
          type: "weight_drift",
          title: `Peso actualizado: ${memberName}`,
          body: oldWeight != null
            ? `Pasó de ${oldWeight} a ${newWeight} kg. El objetivo de su plan quedó desactualizado.`
            : `Registró ${newWeight} kg. El objetivo de su plan quedó desactualizado.`,
          metadata: {
            plan_id: plan.id,
            member_id: memberId,
            old_weight: oldWeight,
            new_weight: newWeight,
            old_target: plan.target_calories,
            new_target: newTargets.calories,
          },
          dedup_key: dedupKey,
        } as never)

      // 23505 = unique_violation: ya se notificó por este mismo drift, es el
      // caso esperado. Cualquier otro error se loguea — fue lo que permitió
      // encontrar este bug en primer lugar.
      if (error && error.code !== "23505") {
        console.error("No se pudo notificar el drift de peso:", error.message)
      }
    } catch (err) {
      console.error("No se pudo notificar el drift de peso:", err)
    }
  }
}

export async function logWeight(weightKg: number, notes?: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Plan primero: es el chequeo más barato, y la mayoría de los registros de
  // peso no tienen un plan activo esperando este aviso. Evita un fetch de
  // perfil de más en el camino más frecuente.
  const { data: activePlan } = await supabase
    .from("nutrition_plans" as never)
    .select("id, gym_id, target_calories, goal")
    .eq("member_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as {
      data: { id: string; gym_id: string; target_calories: number | null; goal: NutritionPlan["goal"] } | null
    }
  const needsDriftCheck = !!activePlan?.target_calories

  const profileBefore = needsDriftCheck ? await getMemberProfileForPlan(user.id) : null
  const oldWeight = profileBefore?.weight_kg ?? null

  const today = new Date().toISOString().split("T")[0]
  await supabase
    .from("weight_logs" as never)
    .upsert({ member_id: user.id, log_date: today, weight_kg: weightKg, notes: notes ?? null } as never, { onConflict: "member_id,log_date" })
  // Also update the profile snapshot
  await supabase.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id)
  revalidatePath("/nutricion")
  revalidatePath("/progress")

  if (activePlan && profileBefore) {
    try {
      await notifyTrainerOfWeightDrift(
        user.id,
        activePlan as { id: string; gym_id: string; target_calories: number; goal: NutritionPlan["goal"] },
        { ...profileBefore, weight_kg: weightKg },
        oldWeight,
        weightKg
      )
    } catch (err) {
      console.error("No se pudo notificar el drift de peso nutricional:", err)
    }
  }
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

// ── Quick log entries (foto → registro rápido) ─────────────────

export type QuickLogEntry = {
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_at?: string
}

export async function saveQuickLogEntry(entry: QuickLogEntry): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles").select("gym_id").eq("id", user.id).single()

  const today = todayAR()

  await supabase.from("quick_log_entries" as never).insert({
    user_id: user.id,
    gym_id: (profile as { gym_id: string | null } | null)?.gym_id ?? null,
    description: entry.description,
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    logged_at: entry.logged_at ?? today,
  } as never)

  revalidatePath("/nutricion")
}

export async function getQuickLogsForDate(userId: string, date: string): Promise<QuickLogEntry[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("quick_log_entries" as never)
    .select("description, calories, protein_g, carbs_g, fat_g, logged_at")
    .eq("user_id", userId)
    .eq("logged_at", date)
    .order("created_at", { ascending: false })

  return (data ?? []) as unknown as QuickLogEntry[]
}

export async function getQuickLogTotalsForDate(
  userId: string,
  date: string
): Promise<{ calories: number; protein: number; carbs: number; fat: number }> {
  const supabase = createClient()
  const { data } = await supabase
    .from("quick_log_entries" as never)
    .select("calories, protein_g, carbs_g, fat_g")
    .eq("user_id", userId)
    .eq("logged_at", date)

  if (!data) return { calories: 0, protein: 0, carbs: 0, fat: 0 }

  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const row of data as { calories: number; protein_g: number; carbs_g: number; fat_g: number }[]) {
    calories += row.calories
    protein  += Number(row.protein_g)
    carbs    += Number(row.carbs_g)
    fat      += Number(row.fat_g)
  }
  return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
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

// ── Calorie threshold alerts ───────────────────────────────────

const CALORIE_OVER_RATIO = 1.0
const CALORIE_UNDER_RATIO = 0.7
const CALORIE_UNDER_HOUR = 21

/**
 * Recalcula el total de calorías del día de un miembro y, si cruza el
 * objetivo de su plan activo, dispara una notificación (una sola vez por
 * umbral por día — dedup vía notifications.dedup_key). Se llama después de
 * CUALQUIER escritura que pueda cambiar el total del día: un quick log por
 * foto (Task 7) o una comida planificada tildada (Task 6).
 */
export async function checkDailyCalorieThreshold(
  memberId: string,
  gymId: string | null
): Promise<{ alertMessage: string | null }> {
  const plan = await getMemberNutritionPlan(memberId)
  if (!plan?.target_calories) return { alertMessage: null }

  const today = todayAR()
  const [mealLogs, quickTotals] = await Promise.all([
    getMealLogsForDate(memberId, today),
    getQuickLogTotalsForDate(memberId, today),
  ])
  const totals = computeDailyTotals(plan, mealLogs, quickTotals)
  const target = plan.target_calories

  let notif: { type: "over" | "under"; title: string; body: string } | null = null

  if (totals.calories > target * CALORIE_OVER_RATIO) {
    notif = {
      type: "over",
      title: "Te pasaste de tu objetivo de hoy",
      body: `Llevás ${Math.round(totals.calories)} kcal, ${Math.round(totals.calories - target)} kcal arriba de tu objetivo de ${target} kcal.`,
    }
  } else if (hourAR() >= CALORIE_UNDER_HOUR && totals.calories < target * CALORIE_UNDER_RATIO) {
    notif = {
      type: "under",
      title: "Te quedaste corto con las calorías de hoy",
      body: `Llevás ${Math.round(totals.calories)} kcal de tu objetivo de ${target} kcal — todavía estás a tiempo de sumar algo más.`,
    }
  }

  if (!notif) return { alertMessage: null }

  const admin = createAdminClient()
  const { error } = await admin.from("notifications" as never).insert({
    user_id: memberId,
    gym_id: gymId,
    type: "calorie_alert",
    title: notif.title,
    body: notif.body,
    metadata: { calorie_type: notif.type, total: Math.round(totals.calories), target },
    dedup_key: `calorie_alert:${notif.type}:${memberId}:${today}`,
  } as never)

  // 23505 = unique_violation en notifications_dedup_idx: ya se avisó hoy para
  // este umbral — no es un error real, pero tampoco hay que repetir el
  // mensaje en el chat (ya se mostró la primera vez que se cruzó).
  if (error) {
    if ((error as { code?: string }).code !== "23505") {
      console.error("[checkDailyCalorieThreshold] notification insert:", error)
    }
    return { alertMessage: null }
  }

  return { alertMessage: notif.body }
}
