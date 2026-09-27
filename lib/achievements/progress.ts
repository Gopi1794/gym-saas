import { dayAR } from "@/lib/date-ar"
import { CATEGORY_LABELS, formatCount } from "./describe"
import type { ConditionType } from "./types"

/** Shape of `member_achievement_metrics(p_user_id)` (numbers already parsed). */
export type AchievementMetrics = {
  total_sessions: number
  total_xp: number
  sessions_week: number
  /** Awarding metric: consecutive AR days ENDING TODAY. Not for display. */
  streak_days: number
  total_volume_kg: number
  total_cardio_minutes: number
  sessions_by_category: Record<string, number>
}

export type AchievementProgress = {
  /** Not capped: it can be above `target` (e.g. a metric that grew before the achievement existed). */
  current: number
  target: number
  /** 0..100, exact (not rounded), 100 only when `current >= target`. */
  pct: number
  /** Short unit for `current / target`, already singular/plural by `target`. */
  unit: string
  /** What is being measured, for a progress block title ("Sesiones completadas"). */
  label: string
}

type ProgressCondition = {
  condition_type: ConditionType
  condition_value: number | string
  condition_target?: string | null
}

const NUMERIC_KEYS = [
  "total_sessions",
  "total_xp",
  "sessions_week",
  "streak_days",
  "total_volume_kg",
  "total_cardio_minutes",
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// jsonb numbers can arrive as numbers or numeric strings. null when it is neither.
function toCount(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Validates the RPC payload. A missing key counts as 0, but anything that is
 * not a plain object, or carries a value that is not a non-negative number,
 * returns null: the views then show no numbers instead of made-up zeros.
 */
export function parseAchievementMetrics(raw: unknown): AchievementMetrics | null {
  if (!isRecord(raw)) return null
  if (![...NUMERIC_KEYS, "sessions_by_category"].some((key) => key in raw)) return null

  const metrics: AchievementMetrics = {
    total_sessions: 0,
    total_xp: 0,
    sessions_week: 0,
    streak_days: 0,
    total_volume_kg: 0,
    total_cardio_minutes: 0,
    sessions_by_category: {},
  }

  for (const key of NUMERIC_KEYS) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    const n = toCount(value)
    if (n === null) return null
    metrics[key] = n
  }

  const byCategory = raw.sessions_by_category
  if (byCategory !== undefined && byCategory !== null) {
    if (!isRecord(byCategory)) return null
    for (const [category, value] of Object.entries(byCategory)) {
      const n = toCount(value)
      if (n === null) return null
      metrics.sessions_by_category[category] = n
    }
  }

  return metrics
}

// Whole-day index of a YYYY-MM-DD string, so consecutive days differ by exactly 1.
function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number)
  return Date.UTC(year, month - 1, date) / 86_400_000
}

/**
 * Streak to DISPLAY: consecutive Argentina calendar days that end today, or
 * end yesterday when the member has not trained yet today (that streak is
 * still alive until the day is over). The awarding metric `streak_days` only
 * counts a streak that ends today, so it would show 0 every morning.
 * Bounded by whatever window of dates the caller loaded.
 */
export function currentStreakFromDates(completedAt: string[], now: Date = new Date()): number {
  const days = new Set<number>()
  for (const iso of completedAt) {
    const instant = new Date(iso)
    if (Number.isNaN(instant.getTime())) continue
    days.add(dayNumber(dayAR(instant)))
  }

  const today = dayNumber(dayAR(now))
  let cursor = days.has(today) ? today : today - 1
  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor -= 1
  }
  return streak
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

type Measure = { current: number; unit: string; label: string }

function measure(
  achievement: ProgressCondition,
  metrics: AchievementMetrics | null,
  streak: number | null,
  target: number,
): Measure | null {
  const type = achievement.condition_type

  if (type === "streak_days") {
    if (streak === null) return null
    return {
      current: streak,
      unit: pluralize(target, "día", "días"),
      label: "Racha actual",
    }
  }

  if (!metrics) return null

  switch (type) {
    case "total_sessions":
      return {
        current: metrics.total_sessions,
        unit: pluralize(target, "sesión", "sesiones"),
        label: "Sesiones completadas",
      }
    case "sessions_week":
      return {
        current: metrics.sessions_week,
        unit: pluralize(target, "sesión", "sesiones"),
        label: "Sesiones esta semana",
      }
    case "total_xp":
      return { current: metrics.total_xp, unit: "XP", label: "XP acumulado" }
    case "total_volume_kg":
      return { current: metrics.total_volume_kg, unit: "kg", label: "Volumen levantado" }
    case "total_cardio_minutes":
      return { current: metrics.total_cardio_minutes, unit: "min", label: "Minutos de cardio" }
    case "sessions_category": {
      // The RPC matches the stored target exactly; a blank target can never be awarded.
      const key = achievement.condition_target ?? ""
      const name = key.trim()
      if (!name) return null
      const category = CATEGORY_LABELS[name] ?? name
      const count = Object.prototype.hasOwnProperty.call(metrics.sessions_by_category, key)
        ? metrics.sessions_by_category[key]
        : 0
      return {
        current: count,
        unit: `${pluralize(target, "sesión", "sesiones")} de ${category}`,
        label: `Sesiones de ${category}`,
      }
    }
    default:
      // A condition type this build does not know: no honest number to show.
      return null
  }
}

/**
 * Real progress of one achievement, or null when it cannot be told truthfully
 * (metrics or streak unavailable, unknown condition type, blank category).
 * The display streak comes from `currentStreakFromDates`, never from
 * `metrics.streak_days`.
 */
export function getAchievementProgress(
  achievement: ProgressCondition,
  metrics: AchievementMetrics | null,
  streak: number | null,
): AchievementProgress | null {
  const target = Number(achievement.condition_value)
  if (!Number.isFinite(target)) return null

  const measured = measure(achievement, metrics, streak, target)
  if (!measured) return null

  const pct = target > 0 ? (measured.current * 100) / target : 100
  return {
    current: measured.current,
    target,
    pct: Math.min(100, Math.max(0, pct)),
    unit: measured.unit,
    label: measured.label,
  }
}

/** "12 / 100" (es-AR grouping). `current` is floored so an unfinished goal never reads as reached. */
export function formatProgressValue(progress: AchievementProgress): string {
  return `${formatCount(Math.floor(progress.current))} / ${formatCount(progress.target)}`
}

/** "12 / 100 sesiones", "12.500 / 100.000 kg", "3 / 25 sesiones de Fuerza". */
export function formatProgress(progress: AchievementProgress): string {
  return `${formatProgressValue(progress)} ${progress.unit}`
}
