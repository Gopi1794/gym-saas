import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"
import { EMPTY_FOOD_FACETS } from "@/lib/food-library"

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// Importado después de los vi.mock — createClient/createAdminClient adentro
// de nutrition.ts tienen que resolver a los mocks de arriba, no a los
// módulos reales (que necesitan cookies()/env vars que no existen en test).
import {
  getFoodsPage,
  getMemberProfileForPlan,
  createNutritionPlan,
  recalculateNutritionPlanTargets,
  getGymNutritionDefaults,
  saveGymNutritionDefaults,
  setMemberMetabolicReference,
} from "./nutrition"

const COMPLETE_PROFILE = {
  weight_kg: 80,
  height_cm: 180,
  date_of_birth: "1990-06-15",
  gender: "male" as const,
  training_frequency: "3-4" as const,
  daily_activity: "moderate" as const,
  metabolic_reference: null,
  goal: "gain_muscle" as const,
}

const INCOMPLETE_PROFILE = {
  weight_kg: null,
  height_cm: 180,
  date_of_birth: "1990-06-15",
  gender: "male" as const,
  training_frequency: "3-4" as const,
  daily_activity: null,
  metabolic_reference: null,
  goal: null,
}

function mockUser(id: string | null) {
  return { data: { user: id ? { id } : null } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getMemberProfileForPlan", () => {
  it("devuelve el perfil completo, incluidos daily_activity y metabolic_reference", async () => {
    const supabase = createMockSupabase([{ data: COMPLETE_PROFILE, error: null }])
    mockCreateClient.mockReturnValue(supabase)

    const result = await getMemberProfileForPlan("member-1")

    expect(result).toEqual(COMPLETE_PROFILE)
    expect(supabase.chains[0].select).toHaveBeenCalledWith(
      "weight_kg, height_cm, date_of_birth, gender, training_frequency, daily_activity, metabolic_reference, goal"
    )
    expect(supabase.chains[0].eq).toHaveBeenCalledWith("id", "member-1")
  })

  it("devuelve null si el socio no existe", async () => {
    const supabase = createMockSupabase([{ data: null, error: null }])
    mockCreateClient.mockReturnValue(supabase)

    expect(await getMemberProfileForPlan("nope")).toBeNull()
  })
})

describe("createNutritionPlan", () => {
  it("con perfil completo, inserta el plan con los targets y valores calculados", async () => {
    const supabase = createMockSupabase([
      { data: COMPLETE_PROFILE, error: null }, // getMemberProfileForPlan
      { data: { id: "plan-1" }, error: null }, // insert
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createNutritionPlan("gym-1", "member-1", "Plan volumen", "volumen", 12, 1.8, "notas")

    expect(result).toEqual({ id: "plan-1" })
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({
      gym_id: "gym-1",
      member_id: "member-1",
      created_by: "trainer-1",
      name: "Plan volumen",
      goal: "volumen",
      notes: "notas",
      calorie_adjustment_pct: 12,
      protein_per_kg: 1.8,
      needs_review: false,
      needs_review_reason: null,
    })
  })

  it("con perfil incompleto, no inserta nada y devuelve los campos faltantes", async () => {
    const supabase = createMockSupabase([{ data: INCOMPLETE_PROFILE, error: null }])
    mockCreateClient.mockReturnValue(supabase)

    const result = await createNutritionPlan("gym-1", "member-1", "Plan", "volumen", 12, 1.8)

    expect(result).toEqual({ error: "Faltan datos del socio para calcular el objetivo: peso." })
    expect(supabase.from).toHaveBeenCalledTimes(1) // solo la lectura del perfil, ningún insert
  })

  it("marca needs_review cuando el ajuste pedido es un déficit agresivo (>25%)", async () => {
    const supabase = createMockSupabase([
      { data: COMPLETE_PROFILE, error: null },
      { data: { id: "plan-2" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    await createNutritionPlan("gym-1", "member-1", "Plan agresivo", "definicion", -30, 2.2)

    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.needs_review).toBe(true)
    expect(insertPayload.needs_review_reason).toContain("25%")
  })

  it("si el insert falla, devuelve el mensaje de error de Supabase", async () => {
    const supabase = createMockSupabase([
      { data: COMPLETE_PROFILE, error: null },
      { data: null, error: { message: "duplicate key" } },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createNutritionPlan("gym-1", "member-1", "Plan", "volumen", 12, 1.8)

    expect(result).toEqual({ error: "duplicate key" })
  })
})

describe("recalculateNutritionPlanTargets", () => {
  const PLAN_WITH_STORED_OVERRIDE = {
    gym_id: "gym-1",
    member_id: "member-1",
    goal: "definicion" as const,
    target_calories: 2000,
    calorie_adjustment_pct: -18,
    protein_per_kg: 2.2,
  }

  const PLAN_LEGACY_NO_OVERRIDE = {
    gym_id: "gym-1",
    member_id: "member-1",
    goal: "definicion" as const,
    target_calories: 2000,
    calorie_adjustment_pct: null,
    protein_per_kg: null,
  }

  it("sin usuario autenticado, devuelve error sin tocar la base", async () => {
    const supabase = createMockSupabase([])
    supabase.auth.getUser.mockResolvedValue(mockUser(null))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recalculateNutritionPlanTargets("plan-1")

    expect(result).toEqual({ error: "No autenticado" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("sin overrides y con valores ya guardados en el plan, los reutiliza (no vuelve a 0)", async () => {
    // Regresión directa del bug encontrado en la revisión final: antes,
    // finalPct caía a un 0 literal en vez de reusar/derivar el valor real,
    // lo que en una segunda recalculación convertía un plan de déficit en
    // uno de mantenimiento. Ver app/actions/nutrition.ts:327-329.
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null }, // me
      { data: PLAN_WITH_STORED_OVERRIDE, error: null }, // plan
      { data: COMPLETE_PROFILE, error: null }, // getMemberProfileForPlan
      { data: [{ id: "plan-1" }], error: null }, // update
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)
    mockCreateAdminClient.mockReturnValue(createMockSupabase([{ data: null, error: null }]))

    const result = await recalculateNutritionPlanTargets("plan-1")

    expect("success" in result && result.success).toBe(true)
    const updatePayload = (supabase.chains[3].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload.calorie_adjustment_pct).toBe(-18)
    expect(updatePayload.protein_per_kg).toBe(2.2)
  })

  it("plan viejo sin valores guardados (columnas null): usa el default del objetivo, no 0", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
      { data: PLAN_LEGACY_NO_OVERRIDE, error: null },
      { data: COMPLETE_PROFILE, error: null },
      { data: [{ id: "plan-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)
    mockCreateAdminClient.mockReturnValue(createMockSupabase([{ data: null, error: null }]))

    await recalculateNutritionPlanTargets("plan-1")

    // "definicion" por defecto es -18% / 2.2 g/kg (defaultNutritionSettingsForGoal) — nunca 0.
    const updatePayload = (supabase.chains[3].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload.calorie_adjustment_pct).toBe(-18)
    expect(updatePayload.protein_per_kg).toBe(2.2)
  })

  it("con overrides explícitos, los usa por sobre lo guardado en el plan", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
      { data: PLAN_WITH_STORED_OVERRIDE, error: null },
      { data: COMPLETE_PROFILE, error: null },
      { data: [{ id: "plan-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)
    mockCreateAdminClient.mockReturnValue(createMockSupabase([{ data: null, error: null }]))

    await recalculateNutritionPlanTargets("plan-1", { calorieAdjustmentPct: -5, proteinPerKg: 1.5 })

    const updatePayload = (supabase.chains[3].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload.calorie_adjustment_pct).toBe(-5)
    expect(updatePayload.protein_per_kg).toBe(1.5)
  })

  it("con rol distinto de admin/trainer, devuelve error sin buscar el plan", async () => {
    const supabase = createMockSupabase([{ data: { role: "member", gym_id: "gym-1" }, error: null }])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recalculateNutritionPlanTargets("plan-1")

    expect(result).toEqual({ error: "Sin permiso" })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it("con un plan de otro gym, devuelve error", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { ...PLAN_WITH_STORED_OVERRIDE, gym_id: "gym-2" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recalculateNutritionPlanTargets("plan-1")

    expect(result).toEqual({ error: "El plan no pertenece a tu gym" })
  })
})

describe("getGymNutritionDefaults", () => {
  it("si ya existe una fila para el gym, la devuelve tal cual", async () => {
    const existing = { gym_id: "gym-1", volumen_pct: 15, volumen_protein: 2.0 }
    const supabase = createMockSupabase([{ data: existing, error: null }])
    mockCreateClient.mockReturnValue(supabase)

    const result = await getGymNutritionDefaults("gym-1")

    expect(result).toEqual(existing)
    expect(supabase.from).toHaveBeenCalledTimes(1) // no dispara el insert
  })

  it("si no existe fila, inserta los defaults y los devuelve", async () => {
    const created = { gym_id: "gym-1", volumen_pct: 12, volumen_protein: 1.8 }
    const supabase = createMockSupabase([
      { data: null, error: null }, // select: no existe
      { data: created, error: null }, // insert
    ])
    mockCreateClient.mockReturnValue(supabase)

    const result = await getGymNutritionDefaults("gym-1")

    expect(result).toEqual(created)
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({ gym_id: "gym-1", volumen_pct: 12, definicion_pct: -18 })
  })
})

describe("saveGymNutritionDefaults", () => {
  const UPDATES = {
    volumen_pct: 15, volumen_protein: 2.0,
    rendimiento_pct: 8, rendimiento_protein: 1.8,
    mantenimiento_protein: 1.7,
    recomposicion_protein: 2.0,
    perdida_moderada_pct: -10, perdida_moderada_protein: 2.0,
    definicion_pct: -20, definicion_protein: 2.3,
  }

  it("con un admin del mismo gym, guarda los valores", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: null, error: null }, // upsert
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await saveGymNutritionDefaults("gym-1", UPDATES)

    expect(result).toEqual({ success: true })
    const upsertPayload = (supabase.chains[1].upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertPayload).toMatchObject({ gym_id: "gym-1", ...UPDATES })
  })

  it("sin usuario autenticado, devuelve error", async () => {
    const supabase = createMockSupabase([])
    supabase.auth.getUser.mockResolvedValue(mockUser(null))
    mockCreateClient.mockReturnValue(supabase)

    expect(await saveGymNutritionDefaults("gym-1", UPDATES)).toEqual({ error: "No autenticado" })
  })

  it("con un rol que no es admin, devuelve error", async () => {
    const supabase = createMockSupabase([{ data: { role: "trainer", gym_id: "gym-1" }, error: null }])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await saveGymNutritionDefaults("gym-1", UPDATES)).toEqual({ error: "Sin permiso" })
  })

  it("con un admin de otro gym, devuelve error", async () => {
    const supabase = createMockSupabase([{ data: { role: "admin", gym_id: "gym-2" }, error: null }])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await saveGymNutritionDefaults("gym-1", UPDATES)).toEqual({ error: "Sin permiso" })
  })
})

describe("setMemberMetabolicReference", () => {
  it("con un trainer del mismo gym que el socio, guarda la referencia", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null }, // me
      { data: { gym_id: "gym-1" }, error: null }, // target
      { data: null, error: null }, // update
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await setMemberMetabolicReference("member-1", "female")

    expect(result).toEqual({ success: true })
    expect(supabase.chains[2].update).toHaveBeenCalledWith({ metabolic_reference: "female" })
  })

  it("con un socio de otro gym, devuelve error", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { gym_id: "gym-2" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await setMemberMetabolicReference("member-1", "male")).toEqual({ error: "Miembro no pertenece a tu gym" })
  })

  it("con rol distinto de admin/trainer, devuelve error", async () => {
    const supabase = createMockSupabase([{ data: { role: "member", gym_id: "gym-1" }, error: null }])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await setMemberMetabolicReference("member-1", "male")).toEqual({ error: "Sin permiso" })
  })
})

describe("getFoodsPage", () => {
  const FACETS = {
    all: 60,
    mine: 5,
    uncategorized: 2,
    categories: { "Carnes y derivados": 10, "Misceláneos": 3 },
  }
  const row = (id: string) => ({ id, gym_id: null, name: `Food ${id}`, calories: 100 })

  it("calls the search_foods RPC with the args derived from the params and returns the parsed page", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({
      data: { total: 60, rows: [row("f1"), row("f2")], facets: FACETS },
      error: null,
    })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "pollo", chip: "otros", page: 2 })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("search_foods", {
      p_gym_id: "gym-1",
      p_query: "pollo",
      p_categories: ["Misceláneos"],
      p_include_uncategorized: true,
      p_scope: "all",
      p_limit: 24,
      p_offset: 24,
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      foods: [row("f1"), row("f2")],
      total: 60,
      facets: FACETS,
      page: 2,
      pageSize: 24,
    })
  })

  it("scopes the mios chip to the gym's own foods and sends a null query when it is empty", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: { total: 1, rows: [row("f1")], facets: FACETS }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    await getFoodsPage("gym-9", { query: "", chip: "mios", page: 1 })

    expect(supabase.rpc).toHaveBeenCalledWith("search_foods", {
      p_gym_id: "gym-9",
      p_query: null,
      p_categories: null,
      p_include_uncategorized: false,
      p_scope: "mine",
      p_limit: 24,
      p_offset: 0,
    })
  })

  it("clamps an out-of-range page to the last page and re-queries once", async () => {
    const supabase = createMockSupabase()
    supabase.rpc
      .mockResolvedValueOnce({ data: { total: 50, rows: [], facets: FACETS }, error: null })
      .mockResolvedValueOnce({ data: { total: 50, rows: [row("f49"), row("f50")], facets: FACETS }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 9 })

    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "search_foods", expect.objectContaining({ p_offset: 192 }))
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "search_foods", expect.objectContaining({ p_offset: 48 }))
    expect(result).toEqual({
      foods: [row("f49"), row("f50")],
      total: 50,
      facets: FACETS,
      page: 3,
      pageSize: 24,
    })
  })

  it("does not re-query when the requested page has rows", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: { total: 50, rows: [row("f49")], facets: FACETS }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 3 })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(result.page).toBe(3)
  })

  it("returns page 1 without re-querying when the filters match nothing, even from a stale page", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: { total: 0, rows: [], facets: FACETS }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "zzz", chip: "carnes", page: 4 })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ foods: [], total: 0, facets: FACETS, page: 1, pageSize: 24 })
  })

  it("throws the RPC error message without retrying", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function search_foods" } })
    mockCreateClient.mockReturnValue(supabase)

    await expect(getFoodsPage("gym-1", { query: "", chip: "todos", page: 1 })).rejects.toThrow(
      "permission denied for function search_foods"
    )
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it("falls back to fresh empty facets when the payload has none", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: { total: 1, rows: [row("f1")] }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 1 })

    expect(result.foods).toEqual([row("f1")])
    expect(result.facets).toEqual(EMPTY_FOOD_FACETS)
    expect(result.facets).not.toBe(EMPTY_FOOD_FACETS)
    expect(result.facets.categories).not.toBe(EMPTY_FOOD_FACETS.categories)
  })

  it("keeps valid facet counts and zeroes the malformed ones", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({
      data: {
        total: 1,
        rows: [row("f1")],
        facets: {
          all: 7,
          mine: "x",
          uncategorized: null,
          categories: { "Carnes y derivados": 4, "Misceláneos": "n/a" },
        },
      },
      error: null,
    })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 1 })

    expect(result.facets).toEqual({
      all: 7,
      mine: 0,
      uncategorized: 0,
      categories: { "Carnes y derivados": 4, "Misceláneos": 0 },
    })
  })

  it("returns an empty first page when the RPC returns no payload", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 1 })

    expect(result).toEqual({ foods: [], total: 0, facets: EMPTY_FOOD_FACETS, page: 1, pageSize: 24 })
  })

  it("ignores non-array rows and a non-numeric total", async () => {
    const supabase = createMockSupabase()
    supabase.rpc.mockResolvedValueOnce({ data: { total: "12", rows: "nope", facets: FACETS }, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await getFoodsPage("gym-1", { query: "", chip: "todos", page: 1 })

    expect(result.foods).toEqual([])
    expect(result.total).toBe(0)
  })
})
