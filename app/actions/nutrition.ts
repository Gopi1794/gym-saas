"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// ── Types ──────────────────────────────────────────────────────

export type Food = {
  id: string
  gym_id: string | null
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
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
  goal: "volumen" | "definicion" | "mantenimiento" | "otro"
  notes: string | null
  is_active: boolean
  created_at: string
  target_calories: number | null
  target_protein:  number | null
  target_carbs:    number | null
  target_fat:      number | null
  profiles?: { full_name: string | null; avatar_url: string | null }
  nutrition_meals?: Meal[]
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

export async function createFood(gymId: string, food: Omit<Food, "id" | "gym_id">) {
  const supabase = createClient()
  const { error } = await supabase.from("foods" as never).insert({ ...food, gym_id: gymId } as never)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/alimentos")
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
    .select("weight_kg, height_cm, date_of_birth, gender, training_frequency")
    .eq("id", memberId)
    .single()
  return data as {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
  } | null
}

export async function createNutritionPlan(
  gymId: string,
  memberId: string,
  name: string,
  goal: NutritionPlan["goal"],
  notes?: string,
  targets?: { calories: number; protein: number; carbs: number; fat: number } | null
) {
  const supabase = createClient()
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
      target_calories: targets?.calories ?? null,
      target_protein:  targets?.protein  ?? null,
      target_carbs:    targets?.carbs    ?? null,
      target_fat:      targets?.fat      ?? null,
    } as never)
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/nutricion")
  return (data as unknown as { id: string }).id
}

export async function updateNutritionPlan(id: string, updates: Partial<Pick<NutritionPlan, "name" | "goal" | "notes" | "is_active">>) {
  const supabase = createClient()
  const { error } = await supabase.from("nutrition_plans" as never).update(updates as never).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/nutricion")
  revalidatePath(`/nutricion/${id}`)
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

