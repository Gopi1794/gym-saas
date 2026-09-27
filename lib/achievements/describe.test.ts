import { describe, it, expect } from "vitest"
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  CONDITION_TYPES,
  CONDITION_TYPE_LABELS,
  CONDITION_UNITS,
  describeCondition,
  formatCount,
} from "./describe"
import type { ConditionType } from "./types"

function sentence(
  condition_type: ConditionType,
  condition_value: number,
  condition_target?: string | null,
) {
  return describeCondition({ condition_type, condition_value, condition_target })
}

describe("describeCondition", () => {
  it("describes total_sessions", () => {
    expect(sentence("total_sessions", 100)).toBe("Completar 100 sesiones en total")
  })

  it("describes sessions_week", () => {
    expect(sentence("sessions_week", 5)).toBe("Completar 5 sesiones en una misma semana")
  })

  it("describes streak_days", () => {
    expect(sentence("streak_days", 7)).toBe("Entrenar 7 días seguidos")
  })

  it("describes total_xp with thousands separators", () => {
    expect(sentence("total_xp", 10000)).toBe("Acumular 10.000 XP")
  })

  it("describes total_volume_kg with thousands separators", () => {
    expect(sentence("total_volume_kg", 100000)).toBe("Levantar 100.000 kg en total")
  })

  it("describes total_cardio_minutes", () => {
    expect(sentence("total_cardio_minutes", 600)).toBe("Acumular 600 minutos de cardio")
  })

  it("describes sessions_category using the category label", () => {
    expect(sentence("sessions_category", 10, "strength")).toBe("Completar 10 sesiones de Fuerza")
  })

  describe("singular and plural", () => {
    it.each([
      ["total_sessions", "Completar 1 sesión en total"],
      ["sessions_week", "Completar 1 sesión en una misma semana"],
      ["streak_days", "Entrenar 1 día seguido"],
      ["total_cardio_minutes", "Acumular 1 minuto de cardio"],
    ] as const)("uses the singular for %s when the value is 1", (type, expected) => {
      expect(sentence(type, 1)).toBe(expected)
    })

    it("uses the singular for sessions_category when the value is 1", () => {
      expect(sentence("sessions_category", 1, "cardio")).toBe("Completar 1 sesión de Cardio")
    })

    it("keeps the plural for 0 and for values above 1", () => {
      expect(sentence("total_sessions", 2)).toBe("Completar 2 sesiones en total")
      expect(sentence("streak_days", 2)).toBe("Entrenar 2 días seguidos")
    })
  })

  describe("thousands separators", () => {
    it("adds no separator below 1000", () => {
      expect(sentence("total_xp", 999)).toBe("Acumular 999 XP")
    })

    it("groups 1000 with a dot", () => {
      expect(sentence("total_xp", 1000)).toBe("Acumular 1.000 XP")
    })

    it("groups several thousands", () => {
      expect(sentence("total_volume_kg", 1234567)).toBe("Levantar 1.234.567 kg en total")
    })
  })

  describe("sessions_category target", () => {
    it.each(Object.entries(CATEGORY_LABELS))("labels %s as %s", (target, label) => {
      expect(sentence("sessions_category", 3, target)).toBe(`Completar 3 sesiones de ${label}`)
    })

    it("falls back to the raw value for a category it does not know", () => {
      expect(sentence("sessions_category", 3, "crossfit")).toBe("Completar 3 sesiones de crossfit")
    })

    it("says the category is missing when there is no target", () => {
      const expected = "Completar 3 sesiones de una categoría sin elegir"
      expect(sentence("sessions_category", 3)).toBe(expected)
      expect(sentence("sessions_category", 3, null)).toBe(expected)
      expect(sentence("sessions_category", 3, "  ")).toBe(expected)
    })

    it("ignores the target for every other condition type", () => {
      expect(sentence("total_sessions", 4, "strength")).toBe("Completar 4 sesiones en total")
    })
  })

  it("does not throw for a condition type it does not know", () => {
    const unknown = { condition_type: "future_type", condition_value: 1500 } as unknown as {
      condition_type: ConditionType
      condition_value: number
    }
    expect(describeCondition(unknown)).toBe("Alcanzar 1.500 (future_type)")
  })
})

describe("formatCount", () => {
  it("formats integers with es-AR separators regardless of the runtime locale", () => {
    expect(formatCount(0)).toBe("0")
    expect(formatCount(12)).toBe("12")
    expect(formatCount(1000)).toBe("1.000")
    expect(formatCount(1000000)).toBe("1.000.000")
  })

  it("rounds decimals and survives non-finite input", () => {
    expect(formatCount(12.6)).toBe("13")
    expect(formatCount(Number.NaN)).toBe("0")
  })
})

describe("shared label maps", () => {
  it("labels exactly the categories workout sets are stored with", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(
      ["balance", "cardio", "flexibility", "hiit", "strength"],
    )
    expect(CATEGORY_LABELS.hiit).toBe("HIIT")
  })

  it("exposes the categories as select options in the same order", () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual(Object.keys(CATEGORY_LABELS))
  })

  it("has a label and a unit for every condition type", () => {
    expect(CONDITION_TYPES).toHaveLength(7)
    for (const type of CONDITION_TYPES) {
      expect(CONDITION_TYPE_LABELS[type]).toBeTruthy()
      expect(CONDITION_UNITS[type]).toBeTruthy()
    }
  })
})
