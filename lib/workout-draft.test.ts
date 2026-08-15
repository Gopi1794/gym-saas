import { describe, it, expect } from "vitest"
import { isDraftStale, DRAFT_STALE_HOURS } from "./workout-draft"

describe("isDraftStale", () => {
  it("un draft recien guardado no está vencido", () => {
    const now = new Date("2026-08-15T12:00:00Z").getTime()
    const updatedAt = "2026-08-15T11:55:00Z"
    expect(isDraftStale(updatedAt, now)).toBe(false)
  })

  it("un draft de hace más de 24hs está vencido", () => {
    const now = new Date("2026-08-15T12:00:00Z").getTime()
    const updatedAt = "2026-08-14T11:00:00Z" // 25hs antes
    expect(isDraftStale(updatedAt, now)).toBe(true)
  })

  it("justo en el límite (24hs exactas) no está vencido — el corte es estrictamente mayor", () => {
    const now = new Date("2026-08-15T12:00:00Z").getTime()
    const updatedAt = new Date(now - DRAFT_STALE_HOURS * 60 * 60 * 1000).toISOString()
    expect(isDraftStale(updatedAt, now)).toBe(false)
  })

  it("un minuto después del límite sí está vencido", () => {
    const now = new Date("2026-08-15T12:00:00Z").getTime()
    const updatedAt = new Date(now - (DRAFT_STALE_HOURS * 60 + 1) * 60 * 1000).toISOString()
    expect(isDraftStale(updatedAt, now)).toBe(true)
  })

  it("un entrenamiento arrancado a las 23hs y visto 2hs después (cruzando medianoche) no está vencido", () => {
    // Este es el caso que la comparación por día de calendario rompería:
    // "ayer 23hs" a "hoy 1am" es un día de calendario distinto, pero son
    // solo 2 horas reales — no debería tratarse como vencido.
    const updatedAt = "2026-08-14T23:00:00-03:00"
    const now = new Date("2026-08-15T01:00:00-03:00").getTime()
    expect(isDraftStale(updatedAt, now)).toBe(false)
  })
})
