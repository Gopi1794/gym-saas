import { CATEGORY_OPTIONS, CONDITION_TYPES } from "./describe"
import type { AchievementInput } from "./types"

export const MIN_XP_REWARD = 1
export const MAX_XP_REWARD = 1000

// complete_workout_session only looks back 365 days when it counts a streak,
// so a longer streak could never be earned.
export const MAX_STREAK_DAYS = 365

/**
 * Returns a Spanish, user-facing message for the first invalid field, or null
 * when the input is valid. Shared by the form (instant feedback) and the
 * server action (the real gate) so both say the same thing.
 */
export function validateAchievementInput(
  input: Pick<
    AchievementInput,
    "name" | "xp_reward" | "condition_type" | "condition_value" | "condition_target"
  >,
): string | null {
  if (!input.name || input.name.trim() === "") {
    return "Ponele un nombre al logro."
  }

  const xp = Number(input.xp_reward)
  if (!Number.isInteger(xp) || xp < MIN_XP_REWARD || xp > MAX_XP_REWARD) {
    return `La recompensa de XP debe ser un número entero entre ${MIN_XP_REWARD} y ${MAX_XP_REWARD}.`
  }

  if (!CONDITION_TYPES.includes(input.condition_type)) {
    return "Elegí un tipo de condición válido."
  }

  const value = Number(input.condition_value)
  if (!Number.isInteger(value) || value < 1) {
    return "El valor de la condición debe ser un número entero de 1 en adelante."
  }

  if (input.condition_type === "streak_days" && value > MAX_STREAK_DAYS) {
    return `La racha no puede pasar de ${MAX_STREAK_DAYS} días: es lo máximo que el sistema mira hacia atrás.`
  }

  if (input.condition_type === "sessions_category") {
    const target = input.condition_target?.trim()
    if (!target || !CATEGORY_OPTIONS.some((o) => o.value === target)) {
      return "Elegí la categoría de las sesiones."
    }
  }

  return null
}
