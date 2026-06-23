import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { selectAgent, AGENTS } from "@/lib/chat/agents"
import { getMemberNutritionPlan } from "@/app/actions/nutrition"
import { getMealLogsForDate, getQuickLogTotalsForDate } from "@/app/actions/nutrition-tracking"

const anthropic = new Anthropic()

// ── Constantes de seguridad ──────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000   // 1 minuto
const RATE_LIMIT_MAX        = 10      // mensajes por ventana
const HISTORY_LIMIT         = 20      // últimos N mensajes enviados a Claude

// ── Labels para el system prompt ─────────────────────────────────────────────
const GOAL_LABELS: Record<string, string> = {
  lose_weight: "perder peso",
  gain_muscle: "ganar músculo",
  performance: "mejorar rendimiento deportivo",
  maintain:    "mantener el peso actual",
}

const FREQ_LABELS: Record<string, string> = {
  never: "no entrenaba antes",
  "1-2": "1-2 veces por semana",
  "3-4": "3-4 veces por semana",
  "5+":  "5 o más veces por semana",
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  // ── 1. Autenticación ────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // ── 2. Verificar rol (contexto desde sesión, nunca del cliente) ─────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, gym_id, goal, weight_kg, height_cm, gender, date_of_birth, medical_conditions, training_frequency, membership_type, total_xp")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "member") {
    return new Response("Forbidden", { status: 403 })
  }

  // ── 3. Rate limiting (vía chat_logs en Supabase — funciona multi-instancia) ─
  const adminDb = createAdminClient()
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count: recentCount } = await adminDb
    .from("chat_logs" as never)
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", windowStart)

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ error: "Demasiados mensajes. Esperá un momento antes de seguir." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    )
  }

  // ── 4. Parsear y limitar historial ──────────────────────────────────────────
  const body = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[]
    image?: { data: string; mediaType: string } | null
  }
  const messages = body.messages.slice(-HISTORY_LIMIT)
  const image = body.image ?? null

  if (!messages.length) {
    return new Response("Bad Request", { status: 400 })
  }

  // ── 5. Routing multi-agente ─────────────────────────────────────────────────
  // Si hay imagen forzamos el agente de nutrición
  const agentId = image ? "nutrition" : selectAgent(messages)
  const agent   = AGENTS[agentId]

  // ── 5b. Contexto nutricional (solo si agente = nutrition) ───────────────────
  let nutritionContext = ""
  if (agentId === "nutrition") {
    const today = new Date().toISOString().split("T")[0]
    const plan = await getMemberNutritionPlan(user.id)

    if (!plan) {
      nutritionContext = "\n\nESTADO NUTRICIONAL: El miembro no tiene plan nutricional asignado. El trainer puede crearle uno."
    } else {
      const [mealLogs, quickTotals] = await Promise.all([
        getMealLogsForDate(user.id, today),
        getQuickLogTotalsForDate(user.id, today),
      ])

      // Valores de foods son por 100g → ratio = actual_grams / 100
      let totalCal = quickTotals.calories, totalProt = quickTotals.protein
      let totalCarbs = quickTotals.carbs, totalFat = quickTotals.fat
      for (const log of mealLogs) {
        const meal = plan.nutrition_meals?.find(m => m.id === log.meal_id)
        if (!meal) continue
        for (const logItem of log.items) {
          const mealItem = meal.nutrition_meal_items?.find(i => i.food_id === logItem.food_id)
          if (!mealItem?.foods) continue
          const f = mealItem.foods
          const r = logItem.actual_grams / 100
          totalCal   += (f.calories ?? 0) * r
          totalProt  += (f.protein  ?? 0) * r
          totalCarbs += (f.carbs    ?? 0) * r
          totalFat   += (f.fat      ?? 0) * r
        }
      }

      const round = (n: number) => Math.round(n)
      const tc = plan.target_calories ?? 0
      const tp = plan.target_protein  ?? 0
      const tch = plan.target_carbs   ?? 0
      const tf = plan.target_fat      ?? 0

      const mealsLogged = mealLogs.length
      const totalMeals  = plan.nutrition_meals?.length ?? 0
      const mealNames   = plan.nutrition_meals
        ?.map(m => `${m.name}${m.time_label ? ` (${m.time_label})` : ""}`)
        .join(", ") ?? "—"

      nutritionContext = `

PLAN NUTRICIONAL ACTIVO: "${plan.name}" — objetivo: ${plan.goal}
TARGETS DEL DÍA: ${tc} kcal | ${tp}g proteína | ${tch}g carbos | ${tf}g grasa
CONSUMIDO HOY: ${round(totalCal)} kcal | ${round(totalProt)}g proteína | ${round(totalCarbs)}g carbos | ${round(totalFat)}g grasa
FALTANTE HOY: ${Math.max(0, tc - round(totalCal))} kcal | ${Math.max(0, tp - round(totalProt))}g proteína | ${Math.max(0, tch - round(totalCarbs))}g carbos | ${Math.max(0, tf - round(totalFat))}g grasa
COMIDAS REGISTRADAS HOY: ${mealsLogged} de ${totalMeals}
COMIDAS DEL PLAN: ${mealNames}`
    }
  }

  // ── 6. Construir contexto del miembro (solo desde servidor) ─────────────────
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const ctx: string[] = []
  if (profile.full_name)          ctx.push(`- Nombre: ${profile.full_name}`)
  if (age)                         ctx.push(`- Edad: ${age} años`)
  if (profile.gender)              ctx.push(`- Género: ${profile.gender === "male" ? "Masculino" : profile.gender === "female" ? "Femenino" : "Otro"}`)
  if (profile.weight_kg)           ctx.push(`- Peso: ${profile.weight_kg} kg`)
  if (profile.height_cm)           ctx.push(`- Altura: ${profile.height_cm} cm`)
  if (profile.goal)                ctx.push(`- Objetivo: ${GOAL_LABELS[profile.goal] ?? profile.goal}`)
  if (profile.training_frequency)  ctx.push(`- Frecuencia: ${FREQ_LABELS[profile.training_frequency] ?? profile.training_frequency}`)
  if (profile.medical_conditions)  ctx.push(`- Condiciones médicas / lesiones: ${profile.medical_conditions}`)
  if (profile.membership_type)     ctx.push(`- Membresía: ${profile.membership_type}`)
  ctx.push(`- XP acumulado: ${profile.total_xp ?? 0}`)

  const systemPrompt = agent.buildSystemPrompt(ctx.join("\n") + nutritionContext)

  // ── 7. Log del mensaje del usuario (antes de llamar a la API) ───────────────
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  if (lastUserMessage) {
    adminDb
      .from("chat_logs" as never)
      .insert({
        user_id: user.id,
        gym_id:  profile.gym_id,
        role:    "user",
        agent:   agentId,
        content: lastUserMessage.content,
      } as never)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error("[member-chat] log user msg:", error)
      })
  }

  // ── 8. Construir mensajes para Claude (multimodal si hay imagen) ─────────────
  type ApiMessage =
    | { role: "user" | "assistant"; content: string }
    | { role: "user"; content: ({ type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "text"; text: string })[] }

  const apiMessages: ApiMessage[] = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === "user" && image) {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: m.content || "¿Qué alimentos ves en esta foto y cuántas calorías tiene?" },
        ],
      }
    }
    return m
  })

  const photoInstruction = image
    ? "\n\nCUANDO EL USUARIO MANDE UNA FOTO DE COMIDA: analizá el plato e incluí al FINAL de tu respuesta (después del texto) este bloque exacto con tus estimaciones:\n[FOOD_LOG]{\"description\":\"nombre del plato\",\"calories\":0,\"protein\":0,\"carbs\":0,\"fat\":0}[/FOOD_LOG]\nUnidades: calories en kcal, protein/carbs/fat en gramos enteros. Si no podés identificar la comida claramente, omití el bloque."
    : ""

  const finalSystemPrompt = systemPrompt + photoInstruction

  // ── 9. Llamada a Claude con streaming ───────────────────────────────────────
  const stream = anthropic.messages.stream({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [{ type: "text", text: finalSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: apiMessages as never,
  })

  // ── 9. Stream al cliente + log de la respuesta del asistente ─────────────────
  const readable = new ReadableStream({
    async start(controller) {
      let assistantContent = ""
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            assistantContent += event.delta.text
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
        controller.close()

        // Log de respuesta del asistente (fire-and-forget)
        if (assistantContent) {
          adminDb
            .from("chat_logs" as never)
            .insert({
              user_id: user.id,
              gym_id:  profile.gym_id,
              role:    "assistant",
              agent:   agentId,
              content: assistantContent,
            } as never)
            .then(({ error }: { error: unknown }) => {
              if (error) console.error("[member-chat] log assistant msg:", error)
            })
        }
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
