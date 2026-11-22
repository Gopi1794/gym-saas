import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"

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
// de nutrition-tracking.ts tienen que resolver a los mocks de arriba.
import { logWeight, getNutritionStreak, getWaterToday, setWaterToday } from "./nutrition-tracking"

describe("logWeight", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stores the weight under today's Argentina date late at night", async () => {
    // 22:30 del 27/09 en Argentina = 01:30 UTC del 28/09.
    vi.setSystemTime(new Date("2026-09-28T01:30:00Z"))

    // .from() en orden: nutrition_plans (sin plan activo), weight_logs, profiles.
    const supabase = createMockSupabase([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "member-1" } } })
    mockCreateClient.mockReturnValue(supabase)

    await logWeight(82.5)

    expect(supabase.from).toHaveBeenNthCalledWith(2, "weight_logs")
    expect(supabase.chains[1].upsert).toHaveBeenCalledWith(
      { member_id: "member-1", log_date: "2026-09-27", weight_kg: 82.5, notes: null },
      { onConflict: "member_id,log_date" }
    )
  })
})

describe("getWaterToday", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("consulta bajo la fecha de Argentina, no la de UTC, pasadas las 21hs", async () => {
    // 22:30 del 27/09 en Argentina = 01:30 UTC del 28/09 — en UTC ya es 28.
    vi.setSystemTime(new Date("2026-09-28T01:30:00Z"))

    const supabase = createMockSupabase([{ data: { glasses: 4 }, error: null }])
    mockCreateClient.mockReturnValue(supabase)

    const glasses = await getWaterToday("member-1")

    expect(supabase.chains[0].eq).toHaveBeenCalledWith("log_date", "2026-09-27")
    expect(glasses).toBe(4)
  })
})

describe("setWaterToday", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("guarda bajo la fecha de Argentina, no la de UTC, pasadas las 21hs", async () => {
    vi.setSystemTime(new Date("2026-09-28T01:30:00Z"))

    const supabase = createMockSupabase([{ data: null, error: null }])
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "member-1" } } })
    mockCreateClient.mockReturnValue(supabase)

    await setWaterToday(5)

    expect(supabase.chains[0].upsert).toHaveBeenCalledWith(
      { member_id: "member-1", log_date: "2026-09-27", glasses: 5 },
      { onConflict: "member_id,log_date" }
    )
  })
})

describe("getNutritionStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // El chequeo original comparaba contra "hoy" y "ayer" calculados con
  // new Date().toISOString().split("T")[0] en crudo (UTC). Pasadas las
  // 21hs AR eso da today="2026-09-28" y yesterday="2026-09-27" — un
  // registro de AYER en Argentina (26/09, dates[0]) no coincide con
  // ninguno de los dos y la racha se cortaba a 0 aunque el socio sí
  // registró ayer. Con daysAgoDateAR/todayAR (today="2026-09-27",
  // yesterday="2026-09-26") el 26 sí matchea "yesterday" y la racha sigue.
  it("el bug real: un registro de ayer en Argentina no corta la racha a las 22:30, aunque en UTC ya sea 'pasado mañana'", async () => {
    vi.setSystemTime(new Date("2026-09-28T01:30:00Z"))

    const supabase = createMockSupabase([
      { data: [{ log_date: "2026-09-26" }, { log_date: "2026-09-25" }], error: null },
    ])
    mockCreateClient.mockReturnValue(supabase)

    // Con el código viejo esto daba 0 (dates[0]="2026-09-26" no matcheaba
    // ni el "hoy" ni el "ayer" calculados en UTC crudo); la racha real es 2.
    expect(await getNutritionStreak("member-1")).toBe(2)
  })
})
