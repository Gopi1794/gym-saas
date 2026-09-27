import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"

const mockCreateClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { saveAchievement } from "./achievements"

const VALID = {
  name: "Primera sesión",
  xp_reward: 50,
  condition_type: "total_sessions",
  condition_value: 1,
} as const

function setup(profile: { role: string; gym_id: string | null } = { role: "admin", gym_id: "gym-1" }) {
  const supabase = createMockSupabase([
    { data: profile, error: null },
    { data: null, error: null },
  ])
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  mockCreateClient.mockReturnValue(supabase)
  return supabase
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("saveAchievement validation", () => {
  it("rejects an out-of-range XP reward with a Spanish message and writes nothing", async () => {
    const supabase = setup()

    const result = await saveAchievement({ ...VALID, xp_reward: 5000 })

    expect(result).toEqual({
      ok: false,
      error: "La recompensa de XP debe ser un número entero entre 1 y 1000.",
    })
    expect(supabase.from).toHaveBeenCalledTimes(1) // only the profile lookup
  })

  it("rejects a streak longer than 365 days", async () => {
    const supabase = setup()

    const result = await saveAchievement({
      ...VALID,
      condition_type: "streak_days",
      condition_value: 366,
    })

    expect(result).toEqual({
      ok: false,
      error: "La racha no puede pasar de 365 días: es lo máximo que el sistema mira hacia atrás.",
    })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it("rejects a category achievement without a known category", async () => {
    setup()

    const result = await saveAchievement({
      ...VALID,
      condition_type: "sessions_category",
      condition_value: 5,
    })

    expect(result).toEqual({ ok: false, error: "Elegí la categoría de las sesiones." })
  })

  it("still refuses members before validating anything", async () => {
    setup({ role: "member", gym_id: "gym-1" })

    const result = await saveAchievement({ ...VALID, xp_reward: 5000 })

    expect(result).toEqual({ ok: false, error: "No autorizado" })
  })
})

describe("saveAchievement writes", () => {
  it("inserts a valid achievement scoped to the caller's gym with a trimmed name", async () => {
    const supabase = setup()

    const result = await saveAchievement({ ...VALID, name: "  Primera sesión  " })

    expect(result).toEqual({ ok: true })
    expect(supabase.chains[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Primera sesión", gym_id: "gym-1", xp_reward: 50 }),
    )
  })

  it("accepts a 365-day streak", async () => {
    setup()

    const result = await saveAchievement({
      ...VALID,
      condition_type: "streak_days",
      condition_value: 365,
    })

    expect(result).toEqual({ ok: true })
  })

  it("updates by id and gym when the input carries an id", async () => {
    const supabase = setup()

    const result = await saveAchievement({ ...VALID, id: "ach-1" })

    expect(result).toEqual({ ok: true })
    expect(supabase.chains[1].update).toHaveBeenCalled()
    expect(supabase.chains[1].eq).toHaveBeenCalledWith("id", "ach-1")
    expect(supabase.chains[1].eq).toHaveBeenCalledWith("gym_id", "gym-1")
  })
})
