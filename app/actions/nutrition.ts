"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calcTmb, calcNutritionTargets, missingTargetFields, validateNutritionSafety, defaultNutritionSettingsForGoal } from "@/lib/nutrition"

// ── Types ──────────────────────────────────────────────────────

export type Food = {
  id: string
  gym_id: string | null
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  household_unit: string | null
  grams_per_unit: number | null
  sugars: number | null
  saturated_fat: number | null
  potassium: number | null
  calcium: number | null
  magnesium: number | null
  zinc: number | null
  iron: number | null
  vitamin_b12: number | null
}

export type MealItem = {
  id: string
  meal_id: string
  food_id: string
  quantity_grams: number
  foods: Food
}

export type Meal = {
  id: string
  plan_id: string
  name: string
  time_label: string | null
  order_index: number
  nutrition_meal_items: MealItem[]
}

export type NutritionPlan = {
  id: string
  gym_id: string
  member_id: string
  created_by: string | null
  name: string
  goal: "volumen" | "definicion" | "mantenimiento" | "recomposicion" | "rendimiento" | "perdida_moderada" | "otro"
  notes: string | null
  is_active: boolean
  created_at: string
  target_calories: number | null
  target_protein:  number | null
  target_carbs:    number | null
  target_fat:      number | null
  calorie_adjustment_pct: number | null
  protein_per_kg:         number | null
  fat_per_kg:              number | null
  needs_review:            boolean
  needs_review_reason:     string | null
  profiles?: { full_name: string | null; avatar_url: string | null }
  nutrition_meals?: Meal[]
}

export type GymNutritionDefaults = {
  gym_id: string
  volumen_pct: number; volumen_protein: number
  rendimiento_pct: number; rendimiento_protein: number
  mantenimiento_protein: number
  recomposicion_protein: number
  perdida_moderada_pct: number; perdida_moderada_protein: number
  definicion_pct: number; definicion_protein: number
}

const DEFAULT_GYM_NUTRITION_DEFAULTS: Omit<GymNutritionDefaults, "gym_id"> = {
  volumen_pct: 12, volumen_protein: 1.8,
  rendimiento_pct: 8, rendimiento_protein: 1.8,
  mantenimiento_protein: 1.7,
  recomposicion_protein: 2.0,
  perdida_moderada_pct: -10, perdida_moderada_protein: 2.0,
  definicion_pct: -18, definicion_protein: 2.2,
}

// ── Food library ───────────────────────────────────────────────

export async function getFoods(gymId: string): Promise<Food[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("foods" as never)
    .select("*")
    .or(`gym_id.is.null,gym_id.eq.${gymId}`)
    .order("name")
  return (data ?? []) as unknown as Food[]
}

export async function createFood(gymId: string, food: Omit<Food, "id" | "gym_id">): Promise<Food> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("foods" as never)
    .insert({ ...food, gym_id: gymId } as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Food
}

export async function updateFood(id: string, food: Partial<Omit<Food, "id" | "gym_id">>) {
  const supabase = createClient()
  const { error } = await supabase.from("foods" as never).update(food as never).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/alimentos")
}

export async function deleteFood(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("foods" as never).delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/alimentos")
}

// ── Nutrition plans ────────────────────────────────────────────

export async function getNutritionPlans(gymId: string): Promise<NutritionPlan[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_plans" as never)
    .select("*, profiles!nutrition_plans_member_id_fkey(full_name, avatar_url)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
  return (data ?? []) as unknown as NutritionPlan[]
}

export async function getNutritionPlan(id: string): Promise<NutritionPlan | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_plans" as never)
    .select(`
      *,
      profiles!nutrition_plans_member_id_fkey(full_name, avatar_url),
      nutrition_meals(
        *,
        nutrition_meal_items(*, foods(*))
      )
    `)
    .eq("id", id)
    .single()
  if (!data) return null
  const plan = data as unknown as NutritionPlan
  if (plan.nutrition_meals) {
    plan.nutrition_meals.sort((a, b) => a.order_index - b.order_index)
  }
  return plan
}

export async function getMemberNutritionPlan(memberId: string): Promise<NutritionPlan | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_plans" as never)
    .select(`
      *,
      nutrition_meals(
        *,
        nutrition_meal_items(*, foods(*))
      )
    `)
    .eq("member_id", memberId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const plan = data as unknown as NutritionPlan
  if (plan.nutrition_meals) {
    plan.nutrition_meals.sort((a, b) => a.order_index - b.order_index)
  }
  return plan
}

export async function getMemberProfileForPlan(memberId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("profiles")
    .select("weight_kg, height_cm, date_of_birth, gender, training_frequency, daily_activity, metabolic_reference, goal")
    .eq("id", memberId)
    .single()
  return data as {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
    daily_activity: "sedentary" | "moderate" | "active" | null
    metabolic_reference: "male" | "female" | null
    goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  } | null
}

export async function createNutritionPlan(
  gymId: string,
  memberId: string,
  name: string,
  goal: NutritionPlan["goal"],
  calorieAdjustmentPct: number,
  proteinPerKg: number,
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient()

  const profile = await getMemberProfileForPlan(memberId)
  const targets = profile ? calcNutritionTargets(profile, goal, { calorieAdjustmentPct, proteinPerKg }) : null

  if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const tmb = profile ? calcTmb(profile) : null
  const safety = tmb != null
    ? validateNutritionSafety(targets, tmb, calorieAdjustmentPct, proteinPerKg)
    : { needsReview: false, reason: null }
  const fatPerKg = targets.fat / (profile!.weight_kg as number)

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("nutrition_plans" as never)
    .insert({
      gym_id: gymId,
      member_id: memberId,
      created_by: user?.id,
      name,
      goal,
      notes: notes ?? null,
      target_calories: targets.calories,
      target_protein:  targets.protein,
      target_carbs:    targets.carbs,
      target_fat:      targets.fat,
      calorie_adjustment_pct: calorieAdjustmentPct,
      protein_per_kg: proteinPerKg,
      fat_per_kg: fatPerKg,
      needs_review: safety.needsReview,
      needs_review_reason: safety.reason,
    } as never)
    .select("id")
    .single()
  if (error) return { error: error.message }
  revalidatePath("/nutricion")
  return { id: (data as unknown as { id: string }).id }
}

export async function updateNutritionPlan(id: string, updates: Partial<Pick<NutritionPlan, "name" | "goal" | "notes" | "is_active">>) {
  const supabase = createClient()
  const { error } = await supabase.from("nutrition_plans" as never).update(updates as never).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/nutricion")
  revalidatePath(`/nutricion/${id}`)
}

export async function recalculateNutritionPlanTargets(
  planId: string,
  overrides?: { calorieAdjustmentPct: number; proteinPerKg: number }
): Promise<{ error: string } | { success: true; targets: { calories: number; protein: number; carbs: number; fat: number } }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: plan } = await supabase
    .from("nutrition_plans" as never)
    .select("gym_id, member_id, goal, target_calories, calorie_adjustment_pct, protein_per_kg")
    .eq("id", planId)
    .single() as unknown as {
      data: {
        gym_id: string; member_id: string; goal: NutritionPlan["goal"]; target_calories: number | null
        calorie_adjustment_pct: number | null; protein_per_kg: number | null
      } | null
    }

  if (!plan || plan.gym_id !== (me as any).gym_id) {
    return { error: "El plan no pertenece a tu gym" }
  }

  const profile = await getMemberProfileForPlan(plan.member_id)

  // Sin overrides explícitos (botón "Actualizar" de siempre): reusa los
  // valores YA guardados en el plan, no vuelve a los defaults del objetivo.
  // Un plan viejo (de antes de esta migración) tiene estas columnas en
  // null — calcNutritionTargets cae a defaultNutritionSettingsForGoal en
  // ese caso, igual que se comportaba antes de este cambio.
  const calorieAdjustmentPct = overrides?.calorieAdjustmentPct ?? plan.calorie_adjustment_pct ?? undefined
  const proteinPerKg = overrides?.proteinPerKg ?? plan.protein_per_kg ?? undefined
  const resolvedOverrides = calorieAdjustmentPct != null && proteinPerKg != null
    ? { calorieAdjustmentPct, proteinPerKg }
    : undefined

  const targets = profile ? calcNutritionTargets(profile, plan.goal, resolvedOverrides) : null

  if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const tmb = profile ? calcTmb(profile) : null
  const goalDefaults = defaultNutritionSettingsForGoal(plan.goal)
  const finalPct = resolvedOverrides?.calorieAdjustmentPct ?? goalDefaults.calorieAdjustmentPct
  const finalProtein = resolvedOverrides?.proteinPerKg ?? goalDefaults.proteinPerKg
  const safety = tmb != null
    ? validateNutritionSafety(targets, tmb, finalPct, finalProtein)
    : { needsReview: false, reason: null }
  const fatPerKg = targets.fat / (profile!.weight_kg as number)

  const { data: updated, error } = await supabase
    .from("nutrition_plans" as never)
    .update({
      target_calories: targets.calories,
      target_protein:  targets.protein,
      target_carbs:    targets.carbs,
      target_fat:      targets.fat,
      calorie_adjustment_pct: finalPct,
      protein_per_kg: finalProtein,
      fat_per_kg: fatPerKg,
      needs_review: safety.needsReview,
      needs_review_reason: safety.reason,
    } as never)
    .eq("id", planId)
    .select("id")

  if (error) return { error: error.message }

  // Si RLS bloqueó el update, Supabase no tira error pero tampoco devuelve filas.
  if (!updated || updated.length === 0) {
    return { error: "No se pudo actualizar el plan (sin permiso o no existe)" }
  }

  // El drift quedó resuelto: las notificaciones sobre el objetivo viejo ya no
  // aplican. Cliente admin porque la policy de DELETE de notifications es
  // "solo tus propias filas" (user_id = auth.uid()) — quien recalcula no
  // siempre es quien fue notificado (puede ser un admin distinto, o el drift
  // pudo haber avisado a varios admins a la vez).
  if (plan.target_calories != null) {
    const admin = createAdminClient()
    await admin
      .from("notifications" as never)
      .delete()
      .eq("type", "weight_drift")
      .eq("dedup_key", `weight_drift:${planId}:${plan.target_calories}`)
  }

  revalidatePath(`/nutricion/${planId}`)
  revalidatePath("/nutricion")
  return { success: true, targets }
}

export async function deleteNutritionPlan(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("nutrition_plans" as never).delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/nutricion")
}

// ── Meals ──────────────────────────────────────────────────────

export async function addMeal(planId: string, name: string, timeLabel: string, orderIndex: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("nutrition_meals" as never)
    .insert({ plan_id: planId, name, time_label: timeLabel || null, order_index: orderIndex } as never)
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return (data as unknown as { id: string }).id
}

export async function updateMeal(id: string, name: string, timeLabel: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("nutrition_meals" as never)
    .update({ name, time_label: timeLabel || null } as never)
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteMeal(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("nutrition_meals" as never).delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── Meal items ─────────────────────────────────────────────────

export async function addMealItem(mealId: string, foodId: string, quantityGrams: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("nutrition_meal_items" as never)
    .insert({ meal_id: mealId, food_id: foodId, quantity_grams: quantityGrams } as never)
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return (data as unknown as { id: string }).id
}

export async function updateMealItem(id: string, quantityGrams: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from("nutrition_meal_items" as never)
    .update({ quantity_grams: quantityGrams } as never)
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteMealItem(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("nutrition_meal_items" as never).delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── Food favorites ─────────────────────────────────────────────

export async function getFoodFavorites(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nutrition_food_favorites" as never)
    .select("food_id")
    .eq("user_id", userId)
  return (data ?? []).map((r: { food_id: string }) => r.food_id)
}

export async function addFoodFavorite(userId: string, foodId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("nutrition_food_favorites" as never)
    .upsert({ user_id: userId, food_id: foodId } as never)
}

export async function removeFoodFavorite(userId: string, foodId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("nutrition_food_favorites" as never)
    .delete()
    .eq("user_id", userId)
    .eq("food_id", foodId)
}

// ── Configuración de nutrición por gym ──────────────────────────

export async function getGymNutritionDefaults(gymId: string): Promise<GymNutritionDefaults> {
  const supabase = createClient()
  const { data } = await supabase
    .from("gym_nutrition_defaults" as never)
    .select("*")
    .eq("gym_id", gymId)
    .maybeSingle()
  if (data) return data as unknown as GymNutritionDefaults

  const { data: created } = await supabase
    .from("gym_nutrition_defaults" as never)
    .insert({ gym_id: gymId, ...DEFAULT_GYM_NUTRITION_DEFAULTS } as never)
    .select("*")
    .single()
  return (created as unknown as GymNutritionDefaults) ?? { gym_id: gymId, ...DEFAULT_GYM_NUTRITION_DEFAULTS }
}

export async function saveGymNutritionDefaults(
  gymId: string,
  updates: Omit<GymNutritionDefaults, "gym_id">
): Promise<{ error: string } | { success: true }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as any).role !== "admin" || (me as any).gym_id !== gymId) {
    return { error: "Sin permiso" }
  }

  const { error } = await supabase
    .from("gym_nutrition_defaults" as never)
    .upsert({ gym_id: gymId, ...updates, updated_at: new Date().toISOString() } as never)
  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}

// ── Referencia metabólica del socio ─────────────────────────────

export async function setMemberMetabolicReference(
  memberId: string,
  reference: "male" | "female"
): Promise<{ error: string } | { success: true }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: target } = await supabase.from("profiles").select("gym_id").eq("id", memberId).single()
  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ metabolic_reference: reference } as never)
    .eq("id", memberId)
  if (error) return { error: error.message }
  revalidatePath(`/members/${memberId}`)
  revalidatePath("/nutricion")
  return { success: true }
}

