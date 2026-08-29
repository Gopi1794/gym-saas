import { getMuscleZones, type MuscleZone } from "./muscle-anatomy"

export type Exercise = {
  id: string
  name: string
  category: string
  image_url: string | null
  muscle_groups: string[]
  is_timed: boolean
}

export type ExerciseRecommendation = {
  exercises: Exercise[]
  source: "direct" | "related" | "none"
}

const RELATED_ZONES: Partial<Record<MuscleZone, MuscleZone[]>> = {
  pec_minor: ["chest"],
  serratus: ["chest", "core"],
  front_delts: ["shoulders", "chest"],
  rear_delts: ["shoulders", "back"],
  rhomboids: ["back", "traps"],
  lower_back: ["back", "core"],
  soleus: ["calves"],
  forearms: ["biceps", "triceps"],
  adductors: ["quads"],
  abductors: ["glutes"],
  hip_flexors: ["quads", "core"],
  rotator_cuff: ["shoulders", "rear_delts"],
}

export function getExercisesForZone(zone: MuscleZone, exercises: Exercise[]): Exercise[] {
  return exercises.filter(exercise =>
    (exercise.muscle_groups ?? []).some(muscle => getMuscleZones(muscle).includes(zone))
  )
}

export function getExerciseRecommendationForZone(zone: MuscleZone, exercises: Exercise[]): ExerciseRecommendation {
  const directExercises = getExercisesForZone(zone, exercises)
  if (directExercises.length > 0) return { exercises: directExercises, source: "direct" }

  const relatedZones = RELATED_ZONES[zone] ?? []
  const relatedExercises = exercises.filter(exercise =>
    (exercise.muscle_groups ?? []).some(muscle =>
      getMuscleZones(muscle).some(muscleZone => relatedZones.includes(muscleZone))
    )
  )

  return relatedExercises.length > 0
    ? { exercises: relatedExercises, source: "related" }
    : { exercises: [], source: "none" }
}
