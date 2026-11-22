import { describe, it, expect } from "vitest"
import { streakFromInstants, countsByDayAR, countsByWeekAR } from "./activity-days"

describe("streakFromInstants", () => {
  it("cuenta días consecutivos hacia atrás desde el día de referencia", () => {
    const completions = [
      "2026-09-27T12:00:00Z",
      "2026-09-26T12:00:00Z",
      "2026-09-24T12:00:00Z", // corta la racha: falta el 25
    ]
    expect(streakFromInstants(completions, "2026-09-27")).toBe(2)
  })

  it("un instante a las 01:30 UTC cuenta para el día AR anterior, no para el UTC", () => {
    // 2026-09-28T01:30:00Z son las 22:30 del 27 en Argentina.
    const completions = ["2026-09-28T01:30:00Z"]

    expect(streakFromInstants(completions, "2026-09-27")).toBe(1)
    // Con el día UTC crudo (28) esta sesión no contaría para "hoy" = 27 y la
    // racha real (entrenó anoche) se perdería — exactamente el bug original.
    expect(streakFromInstants(completions, "2026-09-28")).toBe(0)
  })

  it("sin ningún instante en el día de referencia, la racha es 0", () => {
    expect(streakFromInstants(["2026-09-25T12:00:00Z"], "2026-09-27")).toBe(0)
  })
})

describe("countsByDayAR", () => {
  it("agrupa por día calendario AR, no por día UTC del instante", () => {
    // 2026-09-28T01:30:00Z (22:30 AR del 27) tiene que sumar al 27, no al 28.
    const items = ["2026-09-28T01:30:00Z", "2026-09-26T15:00:00Z"]

    // ventana de 3 días terminando el 27: [25, 26, 27]
    expect(countsByDayAR(items, "2026-09-27", 3)).toEqual([0, 1, 1])
  })

  it("cuenta más de un instante en el mismo día", () => {
    const items = ["2026-09-27T10:00:00Z", "2026-09-27T20:00:00Z"]
    expect(countsByDayAR(items, "2026-09-27", 1)).toEqual([2])
  })

  it("un día sin instantes da 0, no undefined", () => {
    expect(countsByDayAR([], "2026-09-27", 2)).toEqual([0, 0])
  })
})

describe("countsByWeekAR", () => {
  // 2026-09-21 es lunes; 2026-09-27 es domingo de esa misma semana.
  it("agrupa por semana calendario AR (lunes a domingo), no por rango de instantes UTC", () => {
    // 2026-09-28T01:30:00Z son las 22:30 AR del domingo 27 — semana actual.
    // Con un corte de semana en UTC (setHours(0,0,0,0) en un server UTC)
    // esta sesión caería en la semana siguiente por error.
    const items = ["2026-09-28T01:30:00Z"]

    expect(countsByWeekAR(items, "2026-09-21", 2)).toEqual([0, 1])
  })

  it("una sesión de dos semanas atrás cae en el índice más viejo, no en la semana actual", () => {
    const items = ["2026-09-07T15:00:00Z"] // lunes de dos semanas atrás
    expect(countsByWeekAR(items, "2026-09-21", 3)).toEqual([1, 0, 0])
  })

  it("cuenta más de un instante en la misma semana", () => {
    const items = ["2026-09-21T12:00:00Z", "2026-09-23T12:00:00Z", "2026-09-27T12:00:00Z"]
    expect(countsByWeekAR(items, "2026-09-21", 1)).toEqual([3])
  })
})
