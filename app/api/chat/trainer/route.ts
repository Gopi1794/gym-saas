import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { generatePlan } from "@/app/actions/generate-plan"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Sos un asistente especializado ÚNICAMENTE en crear planes de entrenamiento para el gym.

TUS ÚNICAS CAPACIDADES:
1. Crear un plan desde una descripción del miembro/objetivo
2. Convertir un plan en texto/documento en un plan estructurado

REGLAS ESTRICTAS:
- No respondés preguntas de nutrición, medicina, motivación ni ningún otro tema
- No tenés conversación general
- Si el mensaje no es sobre crear o importar un plan, respondés: "Solo puedo ayudarte a crear o importar planes de entrenamiento."
- Cuando tengas suficiente información para crear un plan, llamás al tool create_plan
- Si el trainer pegó texto de un plan, llamás al tool create_plan con mode "document"
- Pedís solo la información MÍNIMA necesaria: miembro y objetivo/deporte
- No hacés preguntas innecesarias sobre equipamiento, lesiones, etc. — creás el plan con lo que tenés

TONO: Conciso y profesional. Máximo 2 oraciones por respuesta fuera de la creación del plan.`

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, gym_id, full_name")
    .eq("id", user.id)
    .single() as { data: { role: string; gym_id: string; full_name: string } | null }

  if (!profile || !["admin", "trainer"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 })
  }

  // Get members list for context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from("profiles")
    .select("id, full_name")
    .eq("gym_id", profile.gym_id)
    .eq("role", "member")
    .order("full_name") as { data: { id: string; full_name: string }[] | null }

  const body = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[]
  }

  const tools: Anthropic.Tool[] = [
    {
      name: "create_plan",
      description: "Crea un plan de entrenamiento en la base de datos. Llamá este tool cuando tengas suficiente información.",
      input_schema: {
        type: "object" as const,
        properties: {
          mode: {
            type: "string",
            enum: ["describe", "document"],
            description: "'describe' si el trainer describió el plan, 'document' si pegó texto de un plan existente",
          },
          member_name: {
            type: "string",
            description: "Nombre del miembro (para buscar su ID). Null si es plantilla.",
          },
          sport: { type: "string", description: "Deporte o actividad principal (solo para mode=describe)" },
          goal: { type: "string", description: "Objetivo del plan (solo para mode=describe)" },
          days_of_week: {
            type: "array",
            items: { type: "number" },
            description: "Días de la semana: 0=Lunes...6=Domingo (solo para mode=describe)",
          },
          document_text: {
            type: "string",
            description: "Texto del plan a importar (solo para mode=document)",
          },
          extra_notes: { type: "string", description: "Notas adicionales opcionales" },
        },
        required: ["mode"],
      },
    },
  ]

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: body.messages,
  })

  // Handle tool use
  if (response.stop_reason === "tool_use") {
    const toolUse = response.content.find((b) => b.type === "tool_use")
    if (!toolUse || toolUse.type !== "tool_use") {
      return Response.json({ reply: "Error interno al procesar la solicitud." })
    }

    const input = toolUse.input as {
      mode: "describe" | "document"
      member_name?: string
      sport?: string
      goal?: string
      days_of_week?: number[]
      document_text?: string
      extra_notes?: string
    }

    // Resolve member ID from name
    let memberId: string | null = null
    if (input.member_name && members) {
      const match = members.find((m) =>
        m.full_name?.toLowerCase().includes(input.member_name!.toLowerCase())
      )
      memberId = match?.id ?? null
    }

    const planInput = input.mode === "document"
      ? {
          mode: "document" as const,
          memberId,
          documentText: input.document_text ?? "",
          gymId: profile.gym_id,
          trainerId: user.id,
        }
      : {
          mode: "describe" as const,
          memberId,
          sport: input.sport ?? "",
          goal: input.goal ?? "",
          daysOfWeek: input.days_of_week ?? [0, 2, 4],
          notes: input.extra_notes ?? "",
          gymId: profile.gym_id,
          trainerId: user.id,
        }

    const result = await generatePlan(planInput)

    if (!result.ok) {
      return Response.json({ reply: `No pude crear el plan: ${result.error}` })
    }

    // Ask Claude to generate a confirmation message
    const confirmResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      tools,
      messages: [
        ...body.messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Plan creado exitosamente con ID: ${result.planId}`,
          }],
        },
      ],
    })

    const replyText = confirmResponse.content.find((b) => b.type === "text")?.text ?? "Plan creado."

    return Response.json({ reply: replyText, planId: result.planId })
  }

  const replyText = response.content.find((b) => b.type === "text")?.text ?? ""
  return Response.json({ reply: replyText })
}
