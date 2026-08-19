import { getMuscleMeta, type MuscleZone } from "./muscle-anatomy"

export type Exercise = {
  id: string
  name: string
  category: string
  image_url: string | null
  muscle_groups: string[]
  is_timed: boolean
}

export function getExercisesForZone(zone: MuscleZone, exercises: Exercise[]): Exercise[] {
  return exercises.filter(exercise =>
    (exercise.muscle_groups ?? []).some(muscle => getMuscleMeta(muscle).zone === zone)
  )
}
