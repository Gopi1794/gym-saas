import type { ConditionType } from "./types"

// Values stored in workout_session_sets.category (see types/database.ts).
// Labels match the ones the exercise screens already show to the admin.
export const CATEGORY_LABELS: Record<string, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  hiit: "HIIT",
  flexibility: "Flexibilidad",
  balance: "Equilibrio",
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

// Short names for the "type of condition" selector, in display order.
export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  total_sessions: "Sesiones totales",
  sessions_week: "Sesiones en una semana",
  streak_days: "Días seguidos entrenando",
  total_xp: "XP acumulado",
  sessions_category: "Sesiones de una categoría",
  total_volume_kg: "Kilos levantados en total",
  total_cardio_minutes: "Minutos de cardio",
}

export const CONDITION_TYPES = Object.keys(
  CONDITION_TYPE_LABELS,
) as ConditionType[]

// Unit shown next to the value field for each condition type.
export const CONDITION_UNITS: Record<ConditionType, string> = {
  total_sessions: "sesiones",
  sessions_week: "sesiones",
  streak_days: "días",
  total_xp: "XP",
  sessions_category: "sesiones",
  total_volume_kg: "kg",
  total_cardio_minutes: "minutos",
}

type Condition = {
  condition_type: ConditionType
  condition_value: number
  condition_target?: string | null
}

// Manual grouping instead of Intl: es-AR output differs between ICU builds
// (and between server and browser), which would break hydration.
export function formatCount(n: number): string {
  const rounded = Number.isFinite(n) ? Math.round(n) : 0
  const sign = rounded < 0 ? "-" : ""
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function categoryLabel(target: string | null | undefined): string {
  const key = target?.trim()
  if (!key) return "una categoría sin elegir"
  return CATEGORY_LABELS[key] ?? key
}

const SENTENCES: Record<ConditionType, (n: number, target?: string | null) => string> = {
  total_sessions: (n) =>
    `Completar ${formatCount(n)} ${plural(n, "sesión", "sesiones")} en total`,
  sessions_week: (n) =>
    `Completar ${formatCount(n)} ${plural(n, "sesión", "sesiones")} en una misma semana`,
  streak_days: (n) =>
    `Entrenar ${formatCount(n)} ${plural(n, "día", "días")} ${plural(n, "seguido", "seguidos")}`,
  total_xp: (n) => `Acumular ${formatCount(n)} XP`,
  total_volume_kg: (n) => `Levantar ${formatCount(n)} kg en total`,
  total_cardio_minutes: (n) =>
    `Acumular ${formatCount(n)} ${plural(n, "minuto", "minutos")} de cardio`,
  sessions_category: (n, target) =>
    `Completar ${formatCount(n)} ${plural(n, "sesión", "sesiones")} de ${categoryLabel(target)}`,
}

export function describeCondition(condition: Condition): string {
  const value = Number(condition.condition_value)
  const build = SENTENCES[condition.condition_type]
  // A type this build does not know (e.g. added by a newer migration) still
  // reads as something instead of throwing while rendering the list.
  if (!build) return `Alcanzar ${formatCount(value)} (${condition.condition_type})`
  return build(value, condition.condition_target)
}
