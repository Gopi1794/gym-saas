import { describe, expect, it } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"
import { loadMemberAchievementProgress } from "./member-progress"

// 15:00 UTC = 12:00 in Argentina, 2026-08-05.
const NOW = new Date("2026-08-05T15:00:00Z")

const METRICS = {
  total_sessions: 12,
  total_xp: 2450,
  sessions_week: 3,
  streak_days: 0,
  total_volume_kg: 12500,
  total_cardio_minutes: "42.5",
  sessions_by_category: { strength: 9 },
}

function load(
  mock: ReturnType<typeof createMockSupabase>,
  userId = "user-1",
) {
  return loadMemberAchievementProgress(mock as never, userId, NOW)
}

describe("loadMemberAchievementProgress", () => {
  it("returns the parsed metrics and the display streak", async () => {
    const mock = createMockSupabase([
      {
        data: [
          { completed_at: "2026-08-04T13:00:00Z" },
          { completed_at: "2026-08-03T13:00:00Z" },
        ],
        error: null,
      },
    ])
    mock.rpc.mockResolvedValueOnce({ data: METRICS, error: null })

    const result = await load(mock)

    expect(result.metrics?.total_sessions).toBe(12)
    expect(result.metrics?.total_cardio_minutes).toBe(42.5)
    // metrics.streak_days is 0 (nothing today yet) but yesterday's streak is alive.
    expect(result.streak).toBe(2)
  })

  it("asks the RPC for the given member and reads only that member's session dates", async () => {
    const mock = createMockSupabase([{ data: [], error: null }])
    mock.rpc.mockResolvedValueOnce({ data: METRICS, error: null })

    await load(mock, "member-42")

    expect(mock.rpc).toHaveBeenCalledWith("member_achievement_metrics", { p_user_id: "member-42" })
    expect(mock.from).toHaveBeenCalledWith("workout_sessions")
    const chain = mock.chains[0] as { select: unknown; eq: unknown; gte: unknown }
    expect(chain.select).toHaveBeenCalledWith("completed_at")
    expect(chain.eq).toHaveBeenCalledWith("user_id", "member-42")
    expect(chain.gte).toHaveBeenCalledWith("completed_at", expect.any(String))
  })

  it("a member with no sessions has a streak of 0, not an unknown one", async () => {
    const mock = createMockSupabase([{ data: [], error: null }])
    mock.rpc.mockResolvedValueOnce({ data: METRICS, error: null })

    expect((await load(mock)).streak).toBe(0)
  })

  it("keeps the streak when only the metrics fail", async () => {
    const mock = createMockSupabase([{ data: [{ completed_at: "2026-08-05T13:00:00Z" }], error: null }])
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } })

    expect(await load(mock)).toEqual({ metrics: null, streak: 1 })
  })

  it("keeps the metrics when only the session dates fail", async () => {
    const mock = createMockSupabase([{ data: null, error: { message: "boom" } }])
    mock.rpc.mockResolvedValueOnce({ data: METRICS, error: null })

    const result = await load(mock)
    expect(result.metrics?.total_sessions).toBe(12)
    expect(result.streak).toBeNull()
  })

  it("degrades to nothing when both fail", async () => {
    const mock = createMockSupabase([{ data: null, error: { message: "boom" } }])
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } })

    expect(await load(mock)).toEqual({ metrics: null, streak: null })
  })

  it("treats a payload that is not metrics as unavailable", async () => {
    const mock = createMockSupabase([{ data: [], error: null }])
    mock.rpc.mockResolvedValueOnce({ data: "not-json-metrics", error: null })

    expect((await load(mock)).metrics).toBeNull()
  })

  it("does not break the page when a query throws", async () => {
    const mock = createMockSupabase([{ data: [], error: null }])
    mock.rpc.mockRejectedValueOnce(new Error("network down"))

    expect(await load(mock)).toEqual({ metrics: null, streak: 0 })
  })
})
