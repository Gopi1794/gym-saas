"use server"

import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export type InsightType = "positive" | "warning" | "suggestion"

export type WorkoutInsight = {
  type: InsightType
  exercise?: string | null
  text: string
}

export type WorkoutAnalysis = {
  overall: string
  insights: WorkoutInsight[]
}

export type InsightSession = {
  day_name: string
  completed_at: string
  sets: {
    exercise_name: string
    set_number: number
    actual_reps: number | null
    planned_reps: number | null
    weight_kg: number | null
  }[]
}

const GOAL_MAP: Record<string, string> = {
  lose_weight: "bajar de peso",
  gain_muscle: "ganar músculo",
  performance: "mejorar rendimiento",
  maintain: "mantenerse",
}

export async function generateWorkoutInsights(
  sessions: InsightSession[],
  member: { goal: string | null; training_frequency: string | null }
): Promise<WorkoutAnalysis> {
  if (sessions.length === 0) {
    return { overall: "No hay sesiones suficientes para analizar.", insights: [] }
  }

  const summaries = sessions.map(session => {
    const byEx: Record<string, { planned: number; actual: number; weights: number[] }> = {}
    for (const s of session.sets) {
      if (!byEx[s.exercise_name]) byEx[s.exercise_name] = { planned: 0, actual: 0, weights: [] }
      if (s.planned_reps != null) byEx[s.exercise_name].planned += s.planned_reps
      if (s.actual_reps != null) byEx[s.exercise_name].actual += s.actual_reps
      if (s.weight_kg != null) byEx[s.exercise_name].weights.push(s.weight_kg)
    }
    return {
      fecha: new Date(session.completed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      dia: session.day_name,
      ejercicios: Object.entries(byEx).map(([name, d]) => ({
        nombre: name,
        adherencia_pct: d.planned > 0 ? Math.round((d.actual / d.planned) * 100) : null,
        peso_promedio_kg: d.weights.length > 0
          ? Math.round(d.weights.reduce((a, b) => a + b, 0) / d.weights.length * 2) / 2
          : null,
        reps_planificadas: d.planned,
        reps_realizadas: d.actual,
      })),
    }
  })

  const prompt = `Sos un entrenador personal experto analizando el progreso de un miembro.

Objetivo: ${member.goal ? (GOAL_MAP[member.goal] ?? member.goal) : "no especificado"}
Frecuencia objetivo: ${member.training_frequency ?? "no especificada"}

Últimas ${summaries.length} sesiones:
${JSON.stringify(summaries, null, 2)}

Analizá estos datos y respondé SOLO con JSON válido:
{
  "overall": "resumen general del rendimiento en 1-2 oraciones",
  "insights": [
    {
      "type": "positive | warning | suggestion",
      "exercise": "nombre del ejercicio o null si es general",
      "text": "consejo concreto y específico"
    }
  ]
}

Reglas:
- 2 a 4 insights máximo
- "positive": algo que está haciendo bien
- "warning": patrón preocupante (adherencia baja repetida, peso estancado 3+ sesiones, etc.)
- "suggestion": recomendación accionable (bajar el peso 10%, agregar progresión, etc.)
- Español rioplatense informal (voseo), sin tecnicismos innecesarios
- Sé específico: nombrá el ejercicio y los números cuando sea relevante
- No inventes datos que no estén en las sesiones`

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const block = msg.content[0]
  if (block.type !== "text") throw new Error("Unexpected response type")

  const match = block.text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("No JSON in response")

  return JSON.parse(match[0]) as WorkoutAnalysis
}
