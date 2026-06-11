import { NextRequest } from "next/server"

export const maxDuration = 60
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generatePlan } from "@/app/actions/generate-plan"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Sos un asistente especializado en crear planes de entrenamiento Y planes nutricionales para el gym.

TUS CAPACIDADES:
1. Crear un plan de entrenamiento desde una descripción del miembro/objetivo
2. Convertir un plan en texto/documento en un plan estructurado
3. Crear un plan nutricional con macros calculados automáticamente para un miembro
4. Agregar comidas con alimentos y cantidades a un plan nutricional
5. Eliminar un plan nutricional completo
6. Eliminar comidas específicas o todas las comidas de un plan
7. Buscar los planes de un miembro (para obtener el plan_id)
8. Ver el plan de entrenamiento actual de un miembro (días y ejercicios)
9. Agregar ejercicios a un día del plan de entrenamiento de un miembro — si el ejercicio no existe en la biblioteca, lo crea automáticamente

FLUJO PARA AGREGAR EJERCICIOS AL PLAN:
- Si el usuario pide agregar ejercicio(s) al plan de un miembro, primero llamás get_member_training_plan para ver si tiene plan y cuáles días existen
- Luego llamás add_exercises_to_plan_day con el día correcto (0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb)
- El sistema busca el ejercicio en la biblioteca del gym; si no existe, lo crea automáticamente antes de agregarlo al plan
- Para ejercicios timed (planchas, cardio, etc.) usás duration_seconds en lugar de reps
- El usuario te da SOLO el nombre del ejercicio y el día. VOS completás todos los campos técnicos usando tu conocimiento de fitness: category, muscle_groups, sets, reps, rest_seconds, is_timed. No le preguntás nada al usuario — actuás directo.

FLUJO PARA PLANES NUTRICIONALES:
- Cuando creás un plan nutricional, el sistema te devuelve el plan_id entre corchetes
- Después de crear el plan, preguntás: "¿Querés que arme las comidas del día?"
- Si el usuario dice que sí, llamás al tool add_meals_to_plan usando el plan_id del historial
- Generás comidas apropiadas para el objetivo (volumen = 5 comidas abundantes, definición = 4-5 comidas controladas)
- Para cada alimento usás food_name en inglés (para buscar en USDA) y food_name_es en español

FLUJO PARA ELIMINAR:
- Si el usuario quiere eliminar un plan o comidas y no tenés el plan_id en el historial, llamás primero a get_member_plans para obtenerlo
- Para eliminar comidas específicas usás delete_meals_from_plan con los nombres exactos
- Para eliminar todas las comidas de un plan, llamás delete_meals_from_plan sin meal_names

CONFIRMACIÓN ANTES DE BORRAR (OBLIGATORIO):
- Antes de llamar a delete_nutrition_plan o delete_meals_from_plan, SIEMPRE preguntás al usuario confirmación explícita
- Ejemplo: "¿Confirmás que querés eliminar el plan 'X' de Gabriel Gómez? Esta acción no se puede deshacer."
- Solo ejecutás el tool DESPUÉS de que el usuario diga "sí", "confirmo", "dale" o equivalente
- Si el usuario no confirma o dice "no", cancelás sin hacer nada

REGLAS:
- No respondés preguntas de medicina, motivación ni temas ajenos al gym
- No tenés conversación general
- Si el mensaje no es sobre crear o gestionar planes, respondés: "Solo puedo ayudarte a crear planes de entrenamiento o nutrición."
- No hacés preguntas innecesarias — actuás con lo que tenés

TONO: Conciso y profesional. Máximo 2 oraciones por respuesta fuera de crear planes.`

// ── Macro calculation ─────────────────────────────────────────

type MemberProfile = {
  weight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  training_frequency: string | null
}

function calculateNutritionTargets(
  profile: MemberProfile | null,
  goal: string,
  overrideCalories?: number
) {
  const weight = Number(profile?.weight_kg ?? 75)
  const height = Number(profile?.height_cm ?? 170)
  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000))
    : 25

  const bmr = 10 * weight + 6.25 * height - 5 * age + 5
  const activityMap: Record<string, number> = {
    never: 1.2, "1-2": 1.375, "3-4": 1.55, "5+": 1.725,
  }
  const tdee = Math.round(bmr * (activityMap[profile?.training_frequency ?? "3-4"] ?? 1.55))
  const surplusMap: Record<string, number> = {
    volumen: 350, definicion: -400, perdida_moderada: -300,
    mantenimiento: 0, recomposicion: 0, rendimiento: 200,
  }
  const calories = overrideCalories ?? tdee + (surplusMap[goal] ?? 0)
  const proteinMap: Record<string, number> = {
    volumen: 2.0, definicion: 2.2, perdida_moderada: 2.0,
    mantenimiento: 1.8, recomposicion: 2.0, rendimiento: 1.8,
  }
  const protein = Math.round(weight * (proteinMap[goal] ?? 2.0))
  const fat = Math.round((calories * 0.27) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { calories: Math.round(calories), protein, carbs, fat }
}

// ── USDA food import ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findOrImportFood(supabase: any, gymId: string, foodNameEn: string, foodNameEs: string): Promise<string | null> {
  // 1. Search gym library by Spanish name
  const { data: existing } = await supabase
    .from("foods")
    .select("id")
    .ilike("name", `%${foodNameEs}%`)
    .or(`gym_id.is.null,gym_id.eq.${gymId}`)
    .limit(1)
    .maybeSingle()

  if (existing) return (existing as { id: string }).id

  // 2. Fallback: USDA FoodData Central
  const apiKey = process.env.USDA_API_KEY ?? ""
  if (!apiKey) return null

  try {
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: foodNameEn, dataType: ["Foundation", "SR Legacy"], pageSize: 1 }),
    })
    if (!res.ok) return null

    const data = await res.json() as { foods?: { foodNutrients?: { nutrientId: number; value: number }[] }[] }
    const food = data.foods?.[0]
    if (!food) return null

    const get = (id: number) => food.foodNutrients?.find(n => n.nutrientId === id)?.value ?? 0

    const { data: newFood } = await supabase
      .from("foods")
      .insert({
        gym_id: gymId,
        name: foodNameEs,
        calories: get(1008),
        protein: get(1003),
        carbs: get(1005),
        fat: get(1004),
        fiber: get(1079),
        sodium: get(1093),
      })
      .select("id")
      .single()

    return newFood ? (newFood as { id: string }).id : null
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const findMember = (members: { id: string; full_name: string }[] | null, name: string) =>
  members?.find(m => norm(m.full_name ?? "").includes(norm(name))) ?? null

// ── Route ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
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

    const adminDb = createAdminClient()
    const logChat = (role: "user" | "assistant", content: string) => {
      adminDb
        .from("chat_logs" as never)
        .insert({ user_id: user.id, gym_id: profile.gym_id, role, agent: "trainer", content } as never)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error("[trainer-chat] log:", error)
        })
    }

    const respond = (data: { reply: string; planId?: string; nutritionPlanId?: string }) => {
      logChat("assistant", data.reply)
      return Response.json(data)
    }

    const lastUserMsg = [...body.messages].reverse().find(m => m.role === "user")
    if (lastUserMsg) logChat("user", lastUserMsg.content)

    const tools: Anthropic.Tool[] = [
      {
        name: "create_plan",
        description: "Crea un plan de entrenamiento en la base de datos.",
        input_schema: {
          type: "object" as const,
          properties: {
            mode: { type: "string", enum: ["describe", "document"] },
            member_name: { type: "string" },
            sport: { type: "string" },
            goal: { type: "string" },
            days_of_week: { type: "array", items: { type: "number" } },
            document_text: { type: "string" },
            extra_notes: { type: "string" },
          },
          required: ["mode"],
        },
      },
      {
        name: "create_nutrition_plan",
        description: "Crea un plan nutricional con macros calculados automáticamente.",
        input_schema: {
          type: "object" as const,
          properties: {
            member_name: { type: "string", description: "Nombre del miembro" },
            goal: {
              type: "string",
              enum: ["volumen", "definicion", "mantenimiento", "recomposicion", "rendimiento", "perdida_moderada"],
            },
            plan_name: { type: "string" },
            target_calories: { type: "number" },
            notes: { type: "string" },
          },
          required: ["member_name", "goal"],
        },
      },
      {
        name: "get_member_plans",
        description: "Obtiene los planes nutricionales de un miembro para conocer sus IDs.",
        input_schema: {
          type: "object" as const,
          properties: {
            member_name: { type: "string", description: "Nombre del miembro" },
          },
          required: ["member_name"],
        },
      },
      {
        name: "delete_nutrition_plan",
        description: "Elimina un plan nutricional completo junto con todas sus comidas.",
        input_schema: {
          type: "object" as const,
          properties: {
            plan_id: { type: "string", description: "ID del plan a eliminar" },
          },
          required: ["plan_id"],
        },
      },
      {
        name: "delete_meals_from_plan",
        description: "Elimina comidas de un plan nutricional. Si no se especifican nombres, elimina todas.",
        input_schema: {
          type: "object" as const,
          properties: {
            plan_id: { type: "string", description: "ID del plan" },
            meal_names: {
              type: "array",
              items: { type: "string" },
              description: "Nombres de las comidas a eliminar. Si está vacío, elimina todas.",
            },
          },
          required: ["plan_id"],
        },
      },
      {
        name: "get_member_training_plan",
        description: "Obtiene el plan de entrenamiento activo de un miembro con sus días, day_ids y ejercicios actuales.",
        input_schema: {
          type: "object" as const,
          properties: {
            member_name: { type: "string" },
          },
          required: ["member_name"],
        },
      },
      {
        name: "add_exercises_to_plan_day",
        description: "Agrega ejercicios a un día específico del plan de entrenamiento de un miembro. Si el ejercicio no existe en la biblioteca lo crea automáticamente.",
        input_schema: {
          type: "object" as const,
          properties: {
            member_name: { type: "string", description: "Nombre del miembro" },
            day_of_week: { type: "number", description: "0=Domingo 1=Lunes 2=Martes 3=Miércoles 4=Jueves 5=Viernes 6=Sábado" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nombre del ejercicio en español" },
                  category: { type: "string", enum: ["strength", "cardio", "hiit", "mobility", "core", "warmup"], description: "Categoría del ejercicio" },
                  muscle_groups: { type: "array", items: { type: "string" }, description: "Grupos musculares (ej: ['pecho', 'tríceps'])" },
                  sets: { type: "number" },
                  reps: { type: "number", description: "Repeticiones. Omitir si es ejercicio timed." },
                  reps_max: { type: "number", description: "Repetición máxima del rango (ej: 8 si el rango es 6-8)" },
                  rest_seconds: { type: "number" },
                  duration_seconds: { type: "number", description: "Duración en segundos. Usar para ejercicios timed (planchas, cardio)." },
                  notes: { type: "string" },
                },
                required: ["name", "category"],
              },
            },
          },
          required: ["member_name", "day_of_week", "exercises"],
        },
      },
      {
        name: "add_meals_to_plan",
        description: "Agrega comidas estructuradas a un plan nutricional. Busca los alimentos en la biblioteca del gym y si no existen los importa desde USDA automáticamente.",
        input_schema: {
          type: "object" as const,
          properties: {
            plan_id: { type: "string", description: "ID del plan nutricional (está en el historial entre corchetes)" },
            meals: {
              type: "array",
              description: "Lista de comidas del día",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nombre de la comida (ej: Desayuno, Almuerzo, Merienda, Cena)" },
                  time_label: { type: "string", description: "Hora sugerida (ej: 08:00, 13:00)" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        food_name: { type: "string", description: "Nombre en inglés para buscar en USDA (ej: chicken breast, oats, egg)" },
                        food_name_es: { type: "string", description: "Nombre en español para mostrar (ej: Pechuga de pollo, Avena, Huevo)" },
                        quantity_grams: { type: "number", description: "Cantidad en gramos" },
                      },
                      required: ["food_name", "food_name_es", "quantity_grams"],
                    },
                  },
                },
                required: ["name", "items"],
              },
            },
          },
          required: ["plan_id", "meals"],
        },
      },
    ]

    // ── Tool executor ─────────────────────────────────────────
    const executeToolCall = async (name: string, input: unknown): Promise<{ text: string; planId?: string; nutritionPlanId?: string }> => {

      // create_plan
      if (name === "create_plan") {
        const i = input as { mode: "describe" | "document"; member_name?: string; sport?: string; goal?: string; days_of_week?: number[]; document_text?: string; extra_notes?: string }
        let memberId: string | null = null
        if (i.member_name && members) {
          memberId = findMember(members, i.member_name!)?.id ?? null
        }
        const planInput = i.mode === "document"
          ? { mode: "document" as const, memberId, documentText: i.document_text ?? "", gymId: profile.gym_id, trainerId: user.id }
          : { mode: "describe" as const, memberId, sport: i.sport ?? "", goal: i.goal ?? "", daysOfWeek: i.days_of_week ?? [0, 2, 4], notes: i.extra_notes ?? "", gymId: profile.gym_id, trainerId: user.id }
        const result = await generatePlan(planInput)
        if (!result.ok) return { text: `No pude crear el plan: ${result.error}` }
        return { text: `Plan de entrenamiento creado correctamente. [plan_id: ${result.planId}]`, planId: result.planId }
      }

      // create_nutrition_plan
      if (name === "create_nutrition_plan") {
        const i = input as { member_name: string; goal: "volumen" | "definicion" | "mantenimiento" | "recomposicion" | "rendimiento" | "perdida_moderada"; plan_name?: string; target_calories?: number; notes?: string }
        const match = findMember(members ?? null, i.member_name)
        if (!match) return { text: `No encontré al miembro "${i.member_name}" en el gym.` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mp } = await (supabase as any).from("profiles").select("weight_kg, height_cm, date_of_birth, training_frequency").eq("id", match.id).single() as { data: MemberProfile | null }
        const targets = calculateNutritionTargets(mp, i.goal, i.target_calories)
        const goalLabels: Record<string, string> = { volumen: "Volumen", definicion: "Definición", mantenimiento: "Mantenimiento", recomposicion: "Recomposición", rendimiento: "Rendimiento", perdida_moderada: "Pérdida moderada" }
        const planName = i.plan_name ?? `Plan ${goalLabels[i.goal]} — ${match.full_name}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: plan, error } = await (supabase as any).from("nutrition_plans").insert({ gym_id: profile.gym_id, member_id: match.id, name: planName, goal: i.goal, target_calories: targets.calories, target_protein: targets.protein, target_carbs: targets.carbs, target_fat: targets.fat, notes: i.notes ?? null, is_active: true }).select("id").single() as { data: { id: string } | null; error: unknown }
        if (error || !plan) return { text: "No pude crear el plan nutricional. Intentá de nuevo." }
        return { text: `Plan creado para ${match.full_name} [plan_id: ${plan.id}]: ${targets.calories} kcal · ${targets.protein}g proteína · ${targets.carbs}g carbos · ${targets.fat}g grasa. ¿Querés que arme las comidas del día?`, nutritionPlanId: plan.id }
      }

      // add_meals_to_plan
      if (name === "add_meals_to_plan") {
        const i = input as { plan_id: string; meals: { name: string; time_label?: string; items: { food_name: string; food_name_es: string; quantity_grams: number }[] }[] }
        const skippedFoods: string[] = []
        let mealIndex = 0
        for (const meal of i.meals) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: createdMeal } = await (supabase as any).from("nutrition_meals").insert({ plan_id: i.plan_id, name: meal.name, time_label: meal.time_label ?? null, order_index: mealIndex++ }).select("id").single() as { data: { id: string } | null }
          if (!createdMeal) continue
          for (const item of meal.items) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const foodId = await findOrImportFood(supabase as any, profile.gym_id, item.food_name, item.food_name_es)
            if (!foodId) { skippedFoods.push(item.food_name_es); continue }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("nutrition_meal_items").insert({ meal_id: createdMeal.id, food_id: foodId, quantity_grams: item.quantity_grams })
          }
        }
        const warning = skippedFoods.length > 0 ? ` No se encontraron: ${skippedFoods.join(", ")} — agregálos manualmente.` : ""
        return { text: `Listo. ${i.meals.length} comidas agregadas al plan.${warning}`, nutritionPlanId: i.plan_id }
      }

      // get_member_plans
      if (name === "get_member_plans") {
        const i = input as { member_name: string }
        const match = findMember(members ?? null, i.member_name)
        if (!match) return { text: `No encontré al miembro "${i.member_name}".` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: plans } = await (supabase as any).from("nutrition_plans").select("id, name, goal, is_active").eq("member_id", match.id).eq("gym_id", profile.gym_id).order("created_at", { ascending: false }) as { data: { id: string; name: string; goal: string; is_active: boolean }[] | null }
        if (!plans || plans.length === 0) return { text: `${match.full_name} no tiene planes nutricionales.` }
        return { text: `Planes de ${match.full_name}:\n${plans.map(p => `• ${p.name} [plan_id: ${p.id}]${p.is_active ? " (activo)" : ""}`).join("\n")}` }
      }

      // delete_nutrition_plan
      if (name === "delete_nutrition_plan") {
        const i = input as { plan_id: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("nutrition_plans").delete().eq("id", i.plan_id).eq("gym_id", profile.gym_id)
        return { text: error ? "No pude eliminar el plan. Intentá de nuevo." : "Plan eliminado correctamente." }
      }

      // delete_meals_from_plan
      if (name === "delete_meals_from_plan") {
        const i = input as { plan_id: string; meal_names?: string[] }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any).from("nutrition_meals").delete().eq("plan_id", i.plan_id)
        if (i.meal_names && i.meal_names.length > 0) query = query.in("name", i.meal_names)
        const { error } = await query
        if (error) return { text: "No pude eliminar las comidas. Intentá de nuevo." }
        return { text: i.meal_names?.length ? `Comidas eliminadas: ${i.meal_names.join(", ")}.` : "Todas las comidas del plan fueron eliminadas." }
      }

      // get_member_training_plan
      if (name === "get_member_training_plan") {
        const i = input as { member_name: string }
        const match = findMember(members ?? null, i.member_name)
        if (!match) return { text: `No encontré al miembro "${i.member_name}".` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: plan } = await (supabase as any).from("workout_plans").select("id, name").eq("assigned_to", match.id).eq("gym_id", profile.gym_id).eq("is_template", false).order("created_at", { ascending: false }).limit(1).maybeSingle() as { data: { id: string; name: string } | null }
        if (!plan) return { text: `${match.full_name} no tiene un plan de entrenamiento asignado.` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: days } = await (supabase as any).from("workout_plan_days").select("id, day_of_week, workout_plan_exercises(order_index, sets, reps, exercises(name))").eq("plan_id", plan.id).order("day_of_week") as { data: { id: string; day_of_week: number; workout_plan_exercises: { order_index: number; sets: number; reps: number | null; exercises: { name: string } }[] }[] | null }
        const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
        const summary = (days ?? []).map(d => {
          const exList = d.workout_plan_exercises.sort((a, b) => a.order_index - b.order_index).map(e => `  - ${e.exercises.name}${e.reps ? ` ${e.sets}x${e.reps}` : ` ${e.sets} series`}`).join("\n")
          return `${DAY_NAMES[d.day_of_week]} [day_id: ${d.id}]:\n${exList || "  (sin ejercicios)"}`
        }).join("\n\n")
        return { text: `Plan "${plan.name}" de ${match.full_name} [plan_id: ${plan.id}]:\n\n${summary}` }
      }

      // add_exercises_to_plan_day
      if (name === "add_exercises_to_plan_day") {
        const i = input as { member_name: string; day_of_week: number; exercises: { name: string; category: string; muscle_groups?: string[]; sets?: number; reps?: number; reps_max?: number; rest_seconds?: number; duration_seconds?: number; notes?: string }[] }
        const match = findMember(members ?? null, i.member_name)
        if (!match) return { text: `No encontré al miembro "${i.member_name}".` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: plan } = await (supabase as any).from("workout_plans").select("id").eq("assigned_to", match.id).eq("gym_id", profile.gym_id).eq("is_template", false).order("created_at", { ascending: false }).limit(1).maybeSingle() as { data: { id: string } | null }
        if (!plan) return { text: `${match.full_name} no tiene un plan de entrenamiento asignado.` }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let { data: planDay } = await (supabase as any).from("workout_plan_days").select("id").eq("plan_id", plan.id).eq("day_of_week", i.day_of_week).maybeSingle() as { data: { id: string } | null }
        if (!planDay) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newDay } = await (supabase as any).from("workout_plan_days").insert({ plan_id: plan.id, day_of_week: i.day_of_week }).select("id").single() as { data: { id: string } | null }
          planDay = newDay
        }
        if (!planDay) return { text: "No se pudo obtener el día del plan." }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingEx } = await (supabase as any).from("workout_plan_exercises").select("order_index").eq("day_id", planDay.id).order("order_index", { ascending: false }).limit(1) as { data: { order_index: number }[] | null }
        let orderIndex = existingEx?.[0] ? existingEx[0].order_index + 1 : 0
        const added: string[] = [], created: string[] = [], failed: string[] = []
        for (const ex of i.exercises) {
          let exercise: { id: string } | null = null
          const { data: gymEx } = await adminDb.from("exercises" as never).select("id").ilike("name", `%${ex.name}%`).eq("gym_id", profile.gym_id).limit(1).maybeSingle() as { data: { id: string } | null }
          exercise = gymEx
          if (!exercise) {
            const { data: globalEx } = await adminDb.from("exercises" as never).select("id").ilike("name", `%${ex.name}%`).is("gym_id", null).limit(1).maybeSingle() as { data: { id: string } | null }
            exercise = globalEx
          }
          if (!exercise) {
            const { data: newEx } = await adminDb.from("exercises" as never).insert({ gym_id: profile.gym_id, name: ex.name, category: ex.category, muscle_groups: ex.muscle_groups ?? [], is_timed: !!ex.duration_seconds || ex.category === "cardio" } as never).select("id").single() as { data: { id: string } | null }
            exercise = newEx
            if (newEx) created.push(ex.name)
          }
          if (!exercise) { failed.push(ex.name); continue }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (supabase as any).from("workout_plan_exercises").insert({ day_id: planDay.id, exercise_id: exercise.id, sets: ex.sets ?? 3, reps: ex.duration_seconds ? null : (ex.reps ?? 10), reps_max: ex.reps_max ?? null, rest_seconds: ex.rest_seconds ?? 90, duration_seconds: ex.duration_seconds ?? null, notes: ex.notes ?? null, order_index: orderIndex++ })
          if (!insertError) added.push(ex.name); else failed.push(ex.name)
        }
        const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
        let text = `${added.length} ejercicio${added.length !== 1 ? "s" : ""} agregado${added.length !== 1 ? "s" : ""} al ${DAY_NAMES[i.day_of_week]} de ${match.full_name}: ${added.join(", ")}.`
        if (created.length > 0) text += ` (Creados en biblioteca: ${created.join(", ")}.)`
        if (failed.length > 0) text += ` No se pudieron agregar: ${failed.join(", ")}.`
        return { text }
      }

      return { text: "Tool desconocido." }
    }

    // ── Agentic loop (max 5 iterations) ──────────────────────
    let agentMessages: Anthropic.MessageParam[] = [...body.messages]
    let lastPlanId: string | undefined
    let lastNutritionPlanId: string | undefined

    for (let iter = 0; iter < 5; iter++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages: agentMessages,
      })

      if (response.stop_reason !== "tool_use") {
        const replyText = response.content.find(b => b.type === "text")?.text ?? ""
        logChat("assistant", replyText)
        return Response.json({ reply: replyText, planId: lastPlanId, nutritionPlanId: lastNutritionPlanId })
      }

      // Execute all tool_use blocks and collect results
      const toolResultContent: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        const result = await executeToolCall(block.name, block.input)
        if (result.planId) lastPlanId = result.planId
        if (result.nutritionPlanId) lastNutritionPlanId = result.nutritionPlanId
        toolResultContent.push({ type: "tool_result", tool_use_id: block.id, content: result.text })
      }

      // Feed results back into the conversation
      agentMessages = [
        ...agentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResultContent },
      ]
    }

    return respond({ reply: "No pude completar la operación. Intentá de nuevo." })

  } catch (err) {
    console.error("[trainer-chat]", err)
    return Response.json({ reply: "Ocurrió un error interno. Revisá los logs del servidor." }, { status: 500 })
  }
}
