import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { selectAgent, AGENTS } from "@/lib/chat/agents"

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
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count: recentCount } = await supabase
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
  const body = await req.json() as { messages: { role: "user" | "assistant"; content: string }[] }
  const messages = body.messages.slice(-HISTORY_LIMIT)

  if (!messages.length) {
    return new Response("Bad Request", { status: 400 })
  }

  // ── 5. Routing multi-agente ─────────────────────────────────────────────────
  const agentId = selectAgent(messages)
  const agent   = AGENTS[agentId]

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

  const systemPrompt = agent.buildSystemPrompt(ctx.join("\n"))

  // ── 7. Log del mensaje del usuario (antes de llamar a la API) ───────────────
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  if (lastUserMessage) {
    void supabase
      .from("chat_logs" as never)
      .insert({
        user_id: user.id,
        gym_id:  profile.gym_id,
        role:    "user",
        agent:   agentId,
        content: lastUserMessage.content,
      } as never)
  }

  // ── 8. Llamada a Claude con streaming ───────────────────────────────────────
  const stream = anthropic.messages.stream({
    model:      "claude-haiku-3-5-20241022",
    max_tokens: 1024,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages,
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
          void supabase
            .from("chat_logs" as never)
            .insert({
              user_id: user.id,
              gym_id:  profile.gym_id,
              role:    "assistant",
              agent:   agentId,
              content: assistantContent,
            } as never)
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
