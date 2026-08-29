import { describe, it, expect } from "vitest"
import { getExerciseRecommendationForZone, getExercisesForZone, type Exercise } from "./muscle-exercises"

const EXERCISES: Exercise[] = [
  { id: "1", name: "Press", category: "Fuerza", image_url: null, muscle_groups: ["Pecho", "Triceps"], is_timed: false },
  { id: "2", name: "Curl", category: "Fuerza", image_url: null, muscle_groups: ["Biceps"], is_timed: false },
  { id: "3", name: "Plancha", category: "Core", image_url: null, muscle_groups: ["Core"], is_timed: true },
]

describe("getExercisesForZone", () => {
  it("devuelve los ejercicios cuyo muscle_groups matchea la zona", () => {
    expect(getExercisesForZone("chest", EXERCISES).map(e => e.id)).toEqual(["1"])
  })

  it("un ejercicio puede aparecer en mas de una zona", () => {
    expect(getExercisesForZone("triceps", EXERCISES).map(e => e.id)).toEqual(["1"])
  })

  it("distribuye un grupo generico entre las zonas que trabaja", () => {
    const genericExercise: Exercise[] = [
      { id: "4", name: "Caminadora", category: "Cardio", image_url: null, muscle_groups: ["Piernas"], is_timed: true },
    ]

    expect(getExercisesForZone("quads", genericExercise).map(e => e.id)).toEqual(["4"])
    expect(getExercisesForZone("hamstrings", genericExercise).map(e => e.id)).toEqual(["4"])
    expect(getExercisesForZone("calves", genericExercise).map(e => e.id)).toEqual(["4"])
  })

  it("ofrece ejercicios relacionados solo cuando no hay ejercicios directos", () => {
    const recommendation = getExerciseRecommendationForZone("pec_minor", EXERCISES)
    expect(recommendation.source).toBe("related")
    expect(recommendation.exercises.map(e => e.id)).toEqual(["1"])
  })

  it("devuelve array vacio si ningun grupo llega a la zona", () => {
    expect(getExercisesForZone("soleus", EXERCISES)).toEqual([])
  })
})
