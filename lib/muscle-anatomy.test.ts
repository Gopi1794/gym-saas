import { describe, it, expect } from "vitest"
import {
  normalizeMuscle,
  getMuscleMeta,
  getMuscleStatus,
  statusLabel,
  statusPillClass,
  progressColor,
  MUSCLE_META,
  MUSCLE_ZONE_IMAGE,
} from "./muscle-anatomy"

describe("normalizeMuscle", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizeMuscle("  Pecho ")).toBe("pecho")
  })
})

describe("getMuscleMeta", () => {
  it("resuelve un músculo conocido", () => {
    expect(getMuscleMeta("Bíceps")).toEqual({ zone: "biceps", range: [8, 16] })
  })

  it("cae a core con rango default para un músculo desconocido", () => {
    expect(getMuscleMeta("musculo-inventado")).toEqual({ zone: "core", range: [8, 16] })
  })
})

describe("getMuscleStatus", () => {
  it("clasifica bajo, ligeramente bajo, óptimo y alto", () => {
    expect(getMuscleStatus(2, [8, 16])).toBe("low")
    expect(getMuscleStatus(7, [8, 16])).toBe("slightly-low")
    expect(getMuscleStatus(12, [8, 16])).toBe("optimal")
    expect(getMuscleStatus(20, [8, 16])).toBe("high")
  })
})

describe("statusLabel / statusPillClass", () => {
  it("devuelven un label y una clase para cada status", () => {
    expect(statusLabel("low")).toBe("BAJO")
    expect(statusPillClass("optimal")).toContain("emerald")
  })
})

describe("progressColor", () => {
  it("es verde puro en 0% y rojo puro en 100%", () => {
    expect(progressColor(0)).toBe("hsl(120, 70%, 40%)")
    expect(progressColor(100)).toBe("hsl(0, 70%, 40%)")
  })
})

describe("MUSCLE_META / MUSCLE_ZONE_IMAGE", () => {
  it("toda entrada de MUSCLE_ZONE_IMAGE tiene una zona presente en MUSCLE_META", () => {
    const zonesInMeta = new Set(Object.values(MUSCLE_META).map(m => m.zone))
    for (const zone of Object.keys(MUSCLE_ZONE_IMAGE)) {
      expect(zonesInMeta.has(zone as never)).toBe(true)
    }
  })
})
