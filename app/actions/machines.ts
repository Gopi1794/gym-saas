"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ── Tipos ────────────────────────────────────────────────────────────────────

export type MachineExercise = {
  id: string
  name: string
  category: string
  image_url: string | null
  muscle_groups: string[]
  is_timed: boolean
}

export type MachineWithExercises = {
  id: string
  name: string
  description: string | null
  qr_identifier: string
  exercises: MachineExercise[]
}

export type ScanResult =
  | { found: false }
  | {
      found: true
      machine: { id: string; name: string }
      exercises: MachineExercise[]
      todayExercises: { wpeId: string; exerciseId: string; sets: number; reps: number; reps_max: number | null }[]
    }

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getMachines(gymId: string): Promise<MachineWithExercises[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("machines" as any)
    .select("id, name, description, qr_identifier, machine_exercises(exercise_id, exercises(id, name, category, image_url, muscle_groups, is_timed))")
    .eq("gym_id", gymId)
    .order("name") as any

  return (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    qr_identifier: m.qr_identifier,
    exercises: (m.machine_exercises ?? []).map((me: any) => me.exercises).filter(Boolean),
  }))
}

export async function scanMachineQR(qrIdentifier: string, userId: string): Promise<ScanResult> {
  const supabase = createClient()

  // Buscar la máquina
  const { data: machine } = await (supabase
    .from("machines" as any)
    .select("id, name, machine_exercises(exercises(id, name, category, image_url, muscle_groups, is_timed))")
    .eq("qr_identifier", qrIdentifier)
    .single() as any)

  if (!machine) return { found: false }

  const exercises: MachineExercise[] = (machine.machine_exercises ?? [])
    .map((me: any) => me.exercises)
    .filter(Boolean)

  // Obtener los ejercicios de hoy del miembro
  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", userId)
    .single()

  // Plan asignado al miembro
  const { data: plan } = await (supabase
    .from("workout_plans" as never)
    .select("id")
    .eq("assigned_to", userId)
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as any)

  let todayExercises: { wpeId: string; exerciseId: string; sets: number; reps: number; reps_max: number | null }[] = []

  if (plan) {
    const dow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
    const { data: day } = await (supabase
      .from("workout_plan_days" as any)
      .select("workout_plan_exercises(id, sets, reps, reps_max, exercise_id)")
      .eq("plan_id", plan.id)
      .eq("day_of_week", dow)
      .maybeSingle() as any)

    if (day) {
      todayExercises = (day.workout_plan_exercises ?? []).map((wpe: any) => ({
        wpeId: wpe.id,
        exerciseId: wpe.exercise_id,
        sets: wpe.sets,
        reps: wpe.reps,
        reps_max: wpe.reps_max,
      }))
    }
  }

  return { found: true, machine: { id: machine.id, name: machine.name }, exercises, todayExercises }
}

export async function addExerciseToTodayPlan(userId: string, exerciseId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { data: plan } = await (supabase
    .from("workout_plans" as never)
    .select("id")
    .eq("assigned_to", userId)
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as any)

  if (!plan) return { success: false, error: "No tenés un plan asignado" }

  const dow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  // Obtener o crear el día de la semana
  let { data: day } = await (supabase
    .from("workout_plan_days" as any)
    .select("id, workout_plan_exercises(order_index)")
    .eq("plan_id", plan.id)
    .eq("day_of_week", dow)
    .maybeSingle() as any)

  if (!day) {
    const { data: newDay } = await (supabase
      .from("workout_plan_days" as any)
      .insert({ plan_id: plan.id, day_of_week: dow })
      .select("id")
      .single() as any)
    day = { id: newDay.id, workout_plan_exercises: [] }
  }

  const maxOrder = Math.max(0, ...(day.workout_plan_exercises ?? []).map((e: any) => e.order_index))

  const { error } = await (supabase
    .from("workout_plan_exercises" as any)
    .insert({
      plan_day_id: day.id,
      exercise_id: exerciseId,
      sets: 3,
      reps: 10,
      rest_seconds: 60,
      order_index: maxOrder + 1,
      phase: "main",
    }) as any)

  if (error) return { success: false, error: error.message }

  revalidatePath("/entrenamiento")
  return { success: true }
}

// ── Mutaciones admin ─────────────────────────────────────────────────────────

export async function createMachine(gymId: string, name: string, description: string): Promise<{ id: string } | null> {
  const supabase = createClient()
  const { data, error } = await (supabase
    .from("machines" as any)
    .insert({ gym_id: gymId, name, description: description || null })
    .select("id")
    .single() as any)
  if (error) return null
  revalidatePath("/entrenamiento")
  return data
}

export async function deleteMachine(machineId: string): Promise<void> {
  const supabase = createClient()
  await (supabase.from("machines" as any).delete().eq("id", machineId) as any)
  revalidatePath("/entrenamiento")
}

export async function setMachineExercises(machineId: string, exerciseIds: string[]): Promise<void> {
  const supabase = createClient()
  await (supabase.from("machine_exercises" as any).delete().eq("machine_id", machineId) as any)
  if (exerciseIds.length > 0) {
    await (supabase
      .from("machine_exercises" as any)
      .insert(exerciseIds.map((eid) => ({ machine_id: machineId, exercise_id: eid }))) as any)
  }
  revalidatePath("/entrenamiento")
}
