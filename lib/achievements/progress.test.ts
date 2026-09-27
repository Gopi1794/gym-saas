import { describe, expect, it } from "vitest"
import {
  currentStreakFromDates,
  formatProgress,
  formatProgressValue,
  getAchievementProgress,
  parseAchievementMetrics,
  type AchievementMetrics,
} from "./progress"
import type { ConditionType } from "./types"

const METRICS: AchievementMetrics = {
  total_sessions: 12,
  total_xp: 2450,
  sessions_week: 3,
  streak_days: 0,
  total_volume_kg: 12500,
  total_cardio_minutes: 42.5,
  sessions_by_category: { strength: 9, cardio: 3 },
}

function condition(
  condition_type: ConditionType,
  condition_value: number,
  condition_target: string | null = null,
) {
  return { condition_type, condition_value, condition_target }
}

describe("parseAchievementMetrics", () => {
  it("parses the payload the RPC returns", () => {
    expect(
      parseAchievementMetrics({
        total_sessions: 12,
        total_xp: 2450,
        sessions_week: 3,
        streak_days: 2,
        total_volume_kg: 12500,
        total_cardio_minutes: 42.5,
        sessions_by_category: { strength: 9, cardio: 3 },
      }),
    ).toEqual({
      total_sessions: 12,
      total_xp: 2450,
      sessions_week: 3,
      streak_days: 2,
      total_volume_kg: 12500,
      total_cardio_minutes: 42.5,
      sessions_by_category: { strength: 9, cardio: 3 },
    })
  })

  it("accepts numeric strings, decimals included", () => {
    const parsed = parseAchievementMetrics({
      total_sessions: "12",
      total_xp: "2450",
      total_volume_kg: "12500.50",
      total_cardio_minutes: "42.5",
      sessions_by_category: { strength: "9" },
    })
    expect(parsed?.total_sessions).toBe(12)
    expect(parsed?.total_volume_kg).toBe(12500.5)
    expect(parsed?.total_cardio_minutes).toBe(42.5)
    expect(parsed?.sessions_by_category).toEqual({ strength: 9 })
  })

  it("defaults missing keys to 0 and a missing category map to empty", () => {
    expect(parseAchievementMetrics({ total_sessions: 4 })).toEqual({
      total_sessions: 4,
      total_xp: 0,
      sessions_week: 0,
      streak_days: 0,
      total_volume_kg: 0,
      total_cardio_minutes: 0,
      sessions_by_category: {},
    })
  })

  it("treats null values like missing keys", () => {
    const parsed = parseAchievementMetrics({ total_sessions: 4, total_xp: null, sessions_by_category: null })
    expect(parsed?.total_xp).toBe(0)
    expect(parsed?.sessions_by_category).toEqual({})
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "12"],
    ["a number", 12],
    ["an array", [1, 2]],
    ["an empty object", {}],
    ["an object with no known key", { hello: "world" }],
  ])("returns null for %s", (_label, raw) => {
    expect(parseAchievementMetrics(raw)).toBeNull()
  })

  it.each([
    ["a non-numeric string", { total_sessions: "abc" }],
    ["an empty string", { total_sessions: "" }],
    ["a boolean", { total_sessions: true }],
    ["a negative number", { total_sessions: -1 }],
    ["Infinity", { total_xp: Infinity }],
    ["NaN", { total_xp: NaN }],
    ["categories that are not an object", { total_sessions: 1, sessions_by_category: [1] }],
    ["a non-numeric category count", { total_sessions: 1, sessions_by_category: { strength: "many" } }],
  ])("returns null (never a fake zero) when a present value is garbage: %s", (_label, raw) => {
    expect(parseAchievementMetrics(raw)).toBeNull()
  })
})

describe("currentStreakFromDates", () => {
  // 15:00 UTC = 12:00 in Argentina, Wednesday 2026-08-05.
  const NOW = new Date("2026-08-05T15:00:00Z")

  it("is 0 with no sessions", () => {
    expect(currentStreakFromDates([], NOW)).toBe(0)
  })

  it("counts consecutive days that end today", () => {
    const dates = ["2026-08-05T13:00:00Z", "2026-08-04T13:00:00Z", "2026-08-03T13:00:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(3)
  })

  it("keeps a streak that ends yesterday alive (has not trained yet today)", () => {
    const dates = ["2026-08-04T13:00:00Z", "2026-08-03T13:00:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(2)
  })

  it("is 0 once the last session is two or more days old", () => {
    expect(currentStreakFromDates(["2026-08-03T13:00:00Z", "2026-08-02T13:00:00Z"], NOW)).toBe(0)
  })

  it("stops at the first gap", () => {
    const dates = ["2026-08-05T13:00:00Z", "2026-08-04T13:00:00Z", "2026-08-02T13:00:00Z", "2026-08-01T13:00:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(2)
  })

  it("counts several sessions on one day once", () => {
    const dates = [
      "2026-08-05T10:00:00Z",
      "2026-08-05T14:00:00Z",
      "2026-08-05T14:30:00Z",
      "2026-08-04T10:00:00Z",
    ]
    expect(currentStreakFromDates(dates, NOW)).toBe(2)
  })

  it("does not depend on the order of the input", () => {
    const dates = ["2026-08-03T13:00:00Z", "2026-08-05T13:00:00Z", "2026-08-04T13:00:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(3)
  })

  it("reads days in Argentina time: 23:30 AR is already the next UTC day", () => {
    // 2026-08-05T02:30:00Z is 23:30 of Aug 4 in Argentina, so it is the 4th, not the 5th.
    const lateNight = ["2026-08-05T02:30:00Z"]
    expect(currentStreakFromDates(lateNight, NOW)).toBe(1) // yesterday (AR) is still alive
    expect(currentStreakFromDates(lateNight, new Date("2026-08-06T15:00:00Z"))).toBe(0) // two days back
  })

  it("a late-night session and an early one on the next AR day are two days", () => {
    // Aug 4 23:30 AR (02:30Z of the 5th) and Aug 5 00:30 AR (03:30Z of the 5th).
    const dates = ["2026-08-05T02:30:00Z", "2026-08-05T03:30:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(2)
  })

  it("uses the AR day of `now` too: 22:00 AR of the 5th is already the 6th in UTC", () => {
    const now = new Date("2026-08-06T01:00:00Z") // Aug 5, 22:00 in Argentina
    expect(currentStreakFromDates(["2026-08-05T13:00:00Z"], now)).toBe(1)
    expect(currentStreakFromDates(["2026-08-04T13:00:00Z"], now)).toBe(1) // ended yesterday: alive
    expect(currentStreakFromDates(["2026-08-03T13:00:00Z"], now)).toBe(0)
  })

  it("crosses month and year boundaries", () => {
    const now = new Date("2027-01-02T15:00:00Z")
    const dates = ["2027-01-02T13:00:00Z", "2027-01-01T13:00:00Z", "2026-12-31T13:00:00Z", "2026-12-30T13:00:00Z"]
    expect(currentStreakFromDates(dates, now)).toBe(4)
  })

  it("ignores sessions dated in the future and invalid dates", () => {
    const dates = ["2026-08-09T13:00:00Z", "not-a-date", "", "2026-08-05T13:00:00Z"]
    expect(currentStreakFromDates(dates, NOW)).toBe(1)
  })

  it("is capped by the window it was given", () => {
    const dates = Array.from({ length: 366 }, (_, i) => new Date(NOW.getTime() - i * 86_400_000).toISOString())
    expect(currentStreakFromDates(dates, NOW)).toBe(366)
  })

  it("defaults `now` to the current time", () => {
    expect(currentStreakFromDates([new Date().toISOString()])).toBe(1)
  })
})

describe("getAchievementProgress", () => {
  it("total_sessions: real session count, not check-ins", () => {
    expect(getAchievementProgress(condition("total_sessions", 100), METRICS, 0)).toEqual({
      current: 12,
      target: 100,
      pct: 12,
      unit: "sesiones",
      label: "Sesiones completadas",
    })
  })

  it("sessions_week: sessions of the current week", () => {
    const progress = getAchievementProgress(condition("sessions_week", 5), METRICS, 0)
    expect(progress).toMatchObject({ current: 3, target: 5, pct: 60, unit: "sesiones", label: "Sesiones esta semana" })
  })

  it("streak_days: uses the DISPLAY streak, not metrics.streak_days", () => {
    // metrics.streak_days is 0 (has not trained today) but the display streak is 4.
    const progress = getAchievementProgress(condition("streak_days", 7), METRICS, 4)
    expect(progress).toMatchObject({ current: 4, target: 7, unit: "días", label: "Racha actual" })
    expect(progress?.pct).toBeCloseTo((4 / 7) * 100)
  })

  it("total_xp", () => {
    expect(getAchievementProgress(condition("total_xp", 5000), METRICS, 0)).toMatchObject({
      current: 2450,
      target: 5000,
      pct: 49,
      unit: "XP",
      label: "XP acumulado",
    })
  })

  it("total_volume_kg", () => {
    expect(getAchievementProgress(condition("total_volume_kg", 100000), METRICS, 0)).toMatchObject({
      current: 12500,
      target: 100000,
      pct: 12.5,
      unit: "kg",
      label: "Volumen levantado",
    })
  })

  it("total_cardio_minutes keeps the decimals in `current`", () => {
    expect(getAchievementProgress(condition("total_cardio_minutes", 600), METRICS, 0)).toMatchObject({
      current: 42.5,
      target: 600,
      unit: "min",
      label: "Minutos de cardio",
    })
  })

  it("sessions_category: reads sessions_by_category[target] and names the category", () => {
    expect(getAchievementProgress(condition("sessions_category", 25, "strength"), METRICS, 0)).toMatchObject({
      current: 9,
      target: 25,
      pct: 36,
      unit: "sesiones de Fuerza",
      label: "Sesiones de Fuerza",
    })
  })

  it("sessions_category: a category the member never trained is 0, not undefined", () => {
    expect(getAchievementProgress(condition("sessions_category", 10, "flexibility"), METRICS, 0)).toMatchObject({
      current: 0,
      pct: 0,
      unit: "sesiones de Flexibilidad",
    })
  })

  it("sessions_category: an unlabelled category falls back to its raw name", () => {
    const metrics = { ...METRICS, sessions_by_category: { crossfit: 2 } }
    expect(getAchievementProgress(condition("sessions_category", 10, "crossfit"), metrics, 0)).toMatchObject({
      current: 2,
      unit: "sesiones de crossfit",
    })
  })

  it("sessions_category: prototype keys are not categories", () => {
    expect(getAchievementProgress(condition("sessions_category", 10, "constructor"), METRICS, 0)?.current).toBe(0)
  })

  it.each([null, "", "   "])("sessions_category: a blank target (%j) has no honest progress", (target) => {
    expect(getAchievementProgress(condition("sessions_category", 10, target), METRICS, 0)).toBeNull()
  })

  it("uses the singular unit when the target is 1", () => {
    expect(getAchievementProgress(condition("total_sessions", 1), METRICS, 0)?.unit).toBe("sesión")
    expect(getAchievementProgress(condition("streak_days", 1), METRICS, 0)?.unit).toBe("día")
    expect(getAchievementProgress(condition("sessions_category", 1, "cardio"), METRICS, 0)?.unit).toBe(
      "sesión de Cardio",
    )
  })

  it("does not cap `current` but caps `pct` at 100", () => {
    const progress = getAchievementProgress(condition("total_sessions", 10), METRICS, 0)
    expect(progress).toMatchObject({ current: 12, target: 10, pct: 100 })
  })

  it("pct is 100 exactly at the target and below 100 one step before", () => {
    const metrics = { ...METRICS, total_sessions: 9 }
    expect(getAchievementProgress(condition("total_sessions", 10), metrics, 0)?.pct).toBe(90)
    expect(getAchievementProgress(condition("total_sessions", 10), { ...metrics, total_sessions: 10 }, 0)?.pct).toBe(100)
  })

  it("a target of 0 or less is already reached", () => {
    expect(getAchievementProgress(condition("total_sessions", 0), METRICS, 0)?.pct).toBe(100)
  })

  it("accepts a numeric-string target", () => {
    const progress = getAchievementProgress({ condition_type: "total_sessions", condition_value: "50" }, METRICS, 0)
    expect(progress).toMatchObject({ current: 12, target: 50, pct: 24 })
  })

  it("is null for a target that is not a number", () => {
    const bad = { condition_type: "total_sessions" as const, condition_value: "many" }
    expect(getAchievementProgress(bad, METRICS, 0)).toBeNull()
  })

  it("is null when the metrics are unavailable (never falls back to another number)", () => {
    for (const type of [
      "total_sessions",
      "sessions_week",
      "total_xp",
      "total_volume_kg",
      "total_cardio_minutes",
    ] as const) {
      expect(getAchievementProgress(condition(type, 10), null, 5)).toBeNull()
    }
    expect(getAchievementProgress(condition("sessions_category", 10, "strength"), null, 5)).toBeNull()
  })

  it("streak progress needs only the streak, not the metrics", () => {
    expect(getAchievementProgress(condition("streak_days", 7), null, 3)).toMatchObject({ current: 3, target: 7 })
  })

  it("is null for a streak when the session dates are unavailable, even with metrics", () => {
    expect(getAchievementProgress(condition("streak_days", 7), { ...METRICS, streak_days: 6 }, null)).toBeNull()
  })

  it("is null for a condition type this build does not know", () => {
    const unknown = { condition_type: "total_pushups" as ConditionType, condition_value: 10 }
    expect(getAchievementProgress(unknown, METRICS, 0)).toBeNull()
  })
})

describe("formatProgress", () => {
  it("joins current, target and unit with es-AR thousands grouping", () => {
    const sessions = getAchievementProgress(condition("total_sessions", 100), METRICS, 0)!
    expect(formatProgress(sessions)).toBe("12 / 100 sesiones")

    const volume = getAchievementProgress(condition("total_volume_kg", 100000), METRICS, 0)!
    expect(formatProgress(volume)).toBe("12.500 / 100.000 kg")

    const category = getAchievementProgress(condition("sessions_category", 25, "strength"), METRICS, 0)!
    expect(formatProgress(category)).toBe("9 / 25 sesiones de Fuerza")
  })

  it("floors decimals so an unfinished goal never reads as reached", () => {
    const almost = { ...METRICS, total_cardio_minutes: 599.9 }
    const progress = getAchievementProgress(condition("total_cardio_minutes", 600), almost, 0)!
    expect(formatProgress(progress)).toBe("599 / 600 min")
    expect(formatProgressValue(progress)).toBe("599 / 600")
  })

  it("shows a value above the target as it is", () => {
    const progress = getAchievementProgress(condition("total_sessions", 10), METRICS, 0)!
    expect(formatProgressValue(progress)).toBe("12 / 10")
  })
})
