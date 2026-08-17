import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"

const mockCreateClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { updateMemberContact, type MemberContactInput } from "./members"

const BASE_INPUT: MemberContactInput = {
  memberId: "member-1",
  dateOfBirth: "1995-03-10",
  phone: null,
  gender: "male",
  goal: "gain_muscle",
  trainingFrequency: "3-4",
  dailyActivity: "active",
  emergencyName: "Ana",
  emergencyPhone: "1122334455",
}

function mockUser(id: string | null) {
  return { data: { user: id ? { id } : null } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("updateMemberContact", () => {
  it("con un trainer del mismo gym, guarda daily_activity junto al resto de los campos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null }, // me
      { data: { gym_id: "gym-1" }, error: null }, // target
      { data: null, error: null }, // update
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateMemberContact(BASE_INPUT)

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[2].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({
      date_of_birth: "1995-03-10",
      phone: null,
      gender: "male",
      goal: "gain_muscle",
      training_frequency: "3-4",
      daily_activity: "active",
      emergency_name: "Ana",
      emergency_phone: "1122334455",
    })
  })

  it("con un teléfono que no normaliza a formato argentino, rechaza sin llegar a guardar", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
      { data: { gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateMemberContact({ ...BASE_INPUT, phone: "no-es-un-telefono" })

    expect(result).toEqual({ error: "Número de teléfono inválido" })
    expect(supabase.from).toHaveBeenCalledTimes(2) // me + target, nunca llega al update
  })

  it("sin usuario autenticado, devuelve error", async () => {
    const supabase = createMockSupabase([])
    supabase.auth.getUser.mockResolvedValue(mockUser(null))
    mockCreateClient.mockReturnValue(supabase)

    expect(await updateMemberContact(BASE_INPUT)).toEqual({ error: "No autenticado" })
  })

  it("con rol distinto de admin/trainer, devuelve error", async () => {
    const supabase = createMockSupabase([{ data: { role: "member", gym_id: "gym-1" }, error: null }])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await updateMemberContact(BASE_INPUT)).toEqual({ error: "Sin permiso" })
  })

  it("con un socio de otro gym, devuelve error", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { gym_id: "gym-2" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    expect(await updateMemberContact(BASE_INPUT)).toEqual({ error: "Miembro no pertenece a tu gym" })
  })
})
