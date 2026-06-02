"use server"

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic()

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

type GeneratedExercise = {
  exercise_id: string
  sets: number
  reps: number
  reps_max: number | null
  rest_seconds: number
  duration_seconds: number | null
  notes: string | null
}

type GeneratedDay = {
  day_of_week: number
  exercises: GeneratedExercise[]
}

type GeneratedPlan = {
  plan_name: string
  description: string
  days: GeneratedDay[]
}

export type GeneratePlanInput =
  | {
      mode: "describe"
      memberId: string | null
      sport: string
      goal: string
      daysOfWeek: number[]
      notes: string
      gymId: string
      trainerId: string
    }
  | {
      mode: "document"
      memberId: string | null
      documentText: string
      gymId: string
      trainerId: string
    }

export type GeneratePlanResult =
  | { ok: true; planId: string }
  | { ok: false; error: string }

function buildExerciseList(exercises: { id: string; name: string; category: string; is_timed: boolean }[]) {
  return exercises
    .map((e) => `${e.id} | ${e.name} | ${e.category}${e.is_timed ? " | timed" : ""}`)
    .join("\n")
}

function buildPrompt(input: GeneratePlanInput, exerciseList: string): string {
  const schema = `Respondé ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "plan_name": "string",
  "description": "string (1-2 oraciones)",
  "days": [
    {
      "day_of_week": 0,
      "exercises": [
        {
          "exercise_id": "uuid exacto de la lista",
          "sets": 4,
          "reps": 5,
          "reps_max": null,
          "rest_seconds": 180,
          "duration_seconds": null,
          "notes": "@ 75-80% 1RM o texto libre"
        }
      ]
    }
  ]
}`

  const rules = `REGLAS:
- Usá SOLO los exercise_id de la lista de arriba
- Para ejercicios de fuerza con % de carga, poné en notes: "@ 75-80% 1RM"
- Para ejercicios timed usá duration_seconds (en segundos)
- Para rangos de reps usá reps_max (ej: reps: 6, reps_max: 8)
- rest_seconds: 90-120 para hiit/cardio, 120-180 para fuerza, 60 para accesorios
- day_of_week: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
- Elegí los ejercicios más parecidos de la lista disponible`

  if (input.mode === "describe") {
    const selectedDays = input.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")
    return `Sos un entrenador personal experto. Generá un plan de entrenamiento semanal en JSON.

EJERCICIOS DISPONIBLES (usá SOLO estos IDs exactos):
${exerciseList}

PERFIL DEL MIEMBRO:
- Deporte/actividad: ${input.sport}
- Objetivo: ${input.goal}
- Días: ${selectedDays} (day_of_week: ${input.daysOfWeek.join(", ")})
${input.notes ? `- Notas: ${input.notes}` : ""}

${rules}

${schema}`
  }

  return `Sos un entrenador personal experto. Analizá el siguiente plan de entrenamiento y convertilo al formato JSON especificado, mapeando cada ejercicio al ID más cercano de la lista disponible.

EJERCICIOS DISPONIBLES (usá SOLO estos IDs exactos):
${exerciseList}

PLAN A CONVERTIR:
${input.documentText}

${rules}
- Inferí los días de la semana del contexto (Lunes=0, Martes=1, etc.)
- Si el plan menciona porcentajes de carga, conservalos en el campo notes

${schema}`
}

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: exercises } = await (supabase as any)
    .from("exercises")
    .select("id, name, category, is_timed")
    .order("name") as { data: { id: string; name: string; category: string; is_timed: boolean }[] | null }

  if (!exercises?.length) return { ok: false, error: "No hay ejercicios en el catálogo" }

  const exerciseList = buildExerciseList(exercises)
  const prompt = buildPrompt(input, exerciseList)

  let generated: GeneratedPlan
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5-20241022",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { ok: false, error: "La IA no devolvió JSON válido" }
    generated = JSON.parse(jsonMatch[0])
  } catch {
    return { ok: false, error: "Error al generar el plan con IA" }
  }

  // Validate exercise IDs — drop any hallucinated ones
  const validIds = new Set(exercises.map((e) => e.id))
  for (const day of generated.days) {
    day.exercises = day.exercises.filter((ex) => validIds.has(ex.exercise_id))
  }
  generated.days = generated.days.filter((d) => d.exercises.length > 0)

  if (!generated.days.length) return { ok: false, error: "La IA no pudo mapear ejercicios del catálogo" }

  // Create plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error: planError } = await (supabase as any)
    .from("workout_plans")
    .insert({
      name: generated.plan_name,
      description: generated.description || null,
      is_template: !input.memberId,
      gym_id: input.gymId,
      created_by: input.trainerId,
      assigned_to: input.memberId || null,
    })
    .select("id")
    .single() as { data: { id: string } | null; error: unknown }

  if (planError || !plan) return { ok: false, error: "No se pudo crear el plan" }

  // Create days and exercises
  for (const day of generated.days) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: planDay } = await (supabase as any)
      .from("workout_plan_days")
      .insert({ plan_id: plan.id, day_of_week: day.day_of_week })
      .select("id")
      .single() as { data: { id: string } | null }

    if (!planDay) continue

    await (supabase as any).from("workout_plan_exercises").insert(
      day.exercises.map((ex, i) => ({
        day_id: planDay.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? 10,
        reps_max: ex.reps_max ?? null,
        rest_seconds: ex.rest_seconds ?? 90,
        duration_seconds: ex.duration_seconds ?? null,
        notes: ex.notes ?? null,
        order_index: i,
      }))
    )
  }

  return { ok: true, planId: plan.id }
}
