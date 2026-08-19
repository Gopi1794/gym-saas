import { describe, it, expect } from "vitest"
import { getExercisesForZone, type Exercise } from "./muscle-exercises"

const EXERCISES: Exercise[] = [
  { id: "1", name: "Press de banca", category: "Fuerza", image_url: null, muscle_groups: ["Pecho", "Tríceps"], is_timed: false },
  { id: "2", name: "Curl de bíceps", category: "Fuerza", image_url: null, muscle_groups: ["Bíceps"], is_timed: false },
  { id: "3", name: "Plancha", category: "Core", image_url: null, muscle_groups: ["Core"], is_timed: true },
]

describe("getExercisesForZone", () => {
  it("devuelve los ejercicios cuyo muscle_groups matchea la zona", () => {
    const result = getExercisesForZone("chest", EXERCISES)
    expect(result.map(e => e.id)).toEqual(["1"])
  })

  it("un ejercicio puede aparecer en más de una zona", () => {
    const result = getExercisesForZone("triceps", EXERCISES)
    expect(result.map(e => e.id)).toEqual(["1"])
  })

  it("devuelve array vacío si ningún ejercicio matchea", () => {
    expect(getExercisesForZone("soleus", EXERCISES)).toEqual([])
  })
})
