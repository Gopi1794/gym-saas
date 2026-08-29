import { describe, it, expect } from "vitest"
import {
  normalizeMuscle,
  getMuscleMeta,
  getMuscleZones,
  getAnatomyPointPosition,
  getMuscleStatus,
  statusLabel,
  statusPillClass,
  progressColor,
  MUSCLE_META,
  MUSCLE_ZONE_IMAGE,
  MUSCLE_ANATOMY,
} from "./muscle-anatomy"

describe("normalizeMuscle", () => {
  it("recorta espacios, pasa a minusculas y elimina acentos", () => {
    expect(normalizeMuscle("  Pectoral  ")).toBe("pectoral")
    expect(normalizeMuscle("GLUTEOS")).toBe("gluteos")
  })
})

describe("muscle mapping", () => {
  it("resuelve un musculo conocido", () => {
    expect(getMuscleMeta("biceps")).toEqual({ zone: "biceps", zones: ["biceps"], range: [8, 16] })
  })

  it("no inventa core para un musculo desconocido", () => {
    expect(getMuscleMeta("musculo-inventado")).toBeNull()
  })

  it("normaliza aliases y reparte etiquetas genericas", () => {
    expect(getMuscleZones("gluteos")).toEqual(["glutes"])
    expect(getMuscleZones("legs")).toEqual(["quads", "hamstrings", "calves"])
    expect(getMuscleZones("full body")).toContain("back")
    expect(getMuscleZones("cardiovascular")).toEqual([])
  })
})

describe("getMuscleStatus", () => {
  it("clasifica bajo, ligeramente bajo, optimo y alto", () => {
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
    "forearms", "adductors", "abductors", "hip_flexors", "rotator_cuff",
  ]

  it("tiene una entrada para cada una de las 24 zonas", () => {
    for (const zone of ALL_ZONES) {
      expect(MUSCLE_ANATOMY[zone]).toBeDefined()
    }
    expect(Object.keys(MUSCLE_ANATOMY)).toHaveLength(24)
  })

  it("cada entrada tiene todos los campos de texto no vacios", () => {
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

  it("cada entrada tiene al menos un nodo del modelo y una posicion 3D", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(entry.nodeNames.length).toBeGreaterThan(0)
      expect(entry.pointPosition).toHaveLength(3)
    }
  })

  it("cada entrada tiene un facing valido para orientar la camara", () => {
    for (const zone of ALL_ZONES) {
      expect(["front", "back"]).toContain(MUSCLE_ANATOMY[zone].facing)
    }
  })

  it("reparte los puntos laterales entre ambos lados sin duplicarlos", () => {
    expect(getAnatomyPointPosition("chest")[0]).toBeLessThan(0)
    expect(getAnatomyPointPosition("triceps")[0]).toBeGreaterThan(0)
    expect(getAnatomyPointPosition("core")[0]).toBe(0)
  })
})
