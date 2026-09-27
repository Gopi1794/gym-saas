import { describe, it, expect } from "vitest"
import { MAX_STREAK_DAYS, MAX_XP_REWARD, validateAchievementInput } from "./validation"
import type { AchievementInput } from "./types"

function input(overrides: Partial<AchievementInput> = {}): AchievementInput {
  return {
    name: "Primera sesión",
    xp_reward: 50,
    condition_type: "total_sessions",
    condition_value: 1,
    ...overrides,
  }
}

describe("validateAchievementInput", () => {
  it("accepts a valid achievement", () => {
    expect(validateAchievementInput(input())).toBeNull()
  })

  it("rejects an empty or whitespace-only name", () => {
    expect(validateAchievementInput(input({ name: "" }))).toBe("Ponele un nombre al logro.")
    expect(validateAchievementInput(input({ name: "   " }))).toBe("Ponele un nombre al logro.")
  })

  it.each([0, -5, 1001, 12.5, Number.NaN])("rejects an XP reward of %s in Spanish", (xp) => {
    const message = validateAchievementInput(input({ xp_reward: xp }))
    expect(message).toBe("La recompensa de XP debe ser un número entero entre 1 y 1000.")
    expect(message).not.toContain("xp_reward")
  })

  it("accepts the XP bounds", () => {
    expect(validateAchievementInput(input({ xp_reward: 1 }))).toBeNull()
    expect(validateAchievementInput(input({ xp_reward: MAX_XP_REWARD }))).toBeNull()
  })

  it.each([0, -1, 2.5, Number.NaN])("rejects a condition value of %s in Spanish", (value) => {
    const message = validateAchievementInput(input({ condition_value: value }))
    expect(message).toBe("El valor de la condición debe ser un número entero de 1 en adelante.")
    expect(message).not.toContain("condition_value")
  })

  it("rejects an unknown condition type", () => {
    const bad = input({ condition_type: "nope" as AchievementInput["condition_type"] })
    expect(validateAchievementInput(bad)).toBe("Elegí un tipo de condición válido.")
  })

  describe("streak_days", () => {
    it("accepts a streak up to the 365 days the awarding function can look back", () => {
      const ok = input({ condition_type: "streak_days", condition_value: MAX_STREAK_DAYS })
      expect(validateAchievementInput(ok)).toBeNull()
    })

    it("rejects a streak above 365 days", () => {
      const tooLong = input({ condition_type: "streak_days", condition_value: 366 })
      expect(validateAchievementInput(tooLong)).toBe(
        "La racha no puede pasar de 365 días: es lo máximo que el sistema mira hacia atrás.",
      )
    })

    it("does not cap other condition types", () => {
      expect(
        validateAchievementInput(input({ condition_type: "total_sessions", condition_value: 5000 })),
      ).toBeNull()
    })
  })

  describe("sessions_category", () => {
    const base = { condition_type: "sessions_category", condition_value: 10 } as const

    it("accepts a known category", () => {
      expect(validateAchievementInput(input({ ...base, condition_target: "hiit" }))).toBeNull()
    })

    it.each([undefined, "", "  ", "crossfit", "toString"])(
      "rejects the missing or unknown category %j",
      (target) => {
        expect(validateAchievementInput(input({ ...base, condition_target: target }))).toBe(
          "Elegí la categoría de las sesiones.",
        )
      },
    )
  })
})
