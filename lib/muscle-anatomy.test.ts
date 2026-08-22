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
  MUSCLE_ANATOMY,
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

describe("MUSCLE_ANATOMY", () => {
  const ALL_ZONES: (keyof typeof MUSCLE_ANATOMY)[] = [
    "chest", "pec_minor", "biceps", "triceps", "shoulders", "front_delts",
    "rear_delts", "back", "traps", "rhomboids", "serratus", "core",
    "obliques", "quads", "hamstrings", "glutes", "calves", "soleus", "lower_back",
  ]

  it("tiene una entrada para cada una de las 19 zonas", () => {
    for (const zone of ALL_ZONES) {
      expect(MUSCLE_ANATOMY[zone]).toBeDefined()
    }
    expect(Object.keys(MUSCLE_ANATOMY)).toHaveLength(19)
  })

  it("cada entrada tiene todos los campos de texto no vacíos", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(entry.zone).toBe(zone)
      expect(entry.displayName.length).toBeGreaterThan(0)
      expect(entry.category.length).toBeGreaterThan(0)
      expect(entry.origen.length).toBeGreaterThan(0)
      expect(entry.insercion.length).toBeGreaterThan(0)
      expect(entry.funcion.length).toBeGreaterThan(0)
    }
  })

  it("cada entrada tiene al menos un nodo del modelo 3D y una posición 3D", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(entry.nodeNames.length).toBeGreaterThan(0)
      expect(entry.pointPosition).toHaveLength(3)
    }
  })

  it("cada entrada tiene un facing válido para orientar la cámara", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(["front", "back"]).toContain(entry.facing)
    }
  })
})
