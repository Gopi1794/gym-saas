import { dayAR } from "@/lib/date-ar"

/**
 * Desplaza una fecha calendario (YYYY-MM-DD) `deltaDays` días. Aritmética de
 * calendario pura, ancla siempre a T00:00:00Z y solo usa getters/setters
 * UTC — no convierte de huso horario, así que da el mismo resultado sin
 * importar en qué zona corra el proceso. El input ya tiene que ser una
 * fecha calendario de Argentina (por ejemplo, la que devuelve dayAR/todayAR)
 * para que el resultado también lo sea.
 */
function shiftDay(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().split("T")[0]
}

/**
 * Racha de días consecutivos con al menos un instante en `completions`,
 * contando hacia atrás desde `todayStr` (fecha de hoy en Argentina,
 * YYYY-MM-DD). Corta en el primer día calendario AR sin ningún instante.
 *
 * Cada instante se agrupa por su día calendario de Argentina (dayAR), no por
 * su día UTC crudo — una sesión completada a las 22:30 AR (01:30 UTC del día
 * siguiente) cuenta para el día que el socio la vivió, no para el de
 * adelante.
 */
export function streakFromInstants(completions: string[], todayStr: string): number {
  const days = new Set(completions.map(dayAR))
  let streak = 0
  let cursor = todayStr
  while (days.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

/**
 * Cantidad de instantes de `items` por día calendario de Argentina, para los
 * últimos `days` días terminando en `lastDayStr` (incluido). El índice 0 es
 * el día más viejo, el último es `lastDayStr`.
 */
export function countsByDayAR(items: string[], lastDayStr: string, days = 7): number[] {
  const byDay = new Map<string, number>()
  for (const instant of items) {
    const day = dayAR(instant)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  return Array.from({ length: days }, (_, i) => byDay.get(shiftDay(lastDayStr, -(days - 1 - i))) ?? 0)
}

/**
 * Cantidad de instantes de `items` por semana calendario de Argentina (lunes
 * a domingo), para las últimas `weeks` semanas terminando en la semana que
 * contiene `mondayStr` (el lunes AR de la semana actual, incluida). El
 * índice 0 es la semana más vieja.
 *
 * La pertenencia a una semana se decide comparando el día calendario AR del
 * instante (string) contra los bordes de la semana, también como strings de
 * fecha — no contra un rango de instantes UTC (`setHours(0,0,0,0)` en un
 * server que corre en UTC corta la semana a medianoche UTC, no a medianoche
 * AR, y le regala/saca hasta 3 horas de la semana equivocada).
 */
export function countsByWeekAR(items: string[], mondayStr: string, weeks = 7): number[] {
  const days = items.map(dayAR)
  return Array.from({ length: weeks }, (_, wi) => {
    const weekStart = shiftDay(mondayStr, -(weeks - 1 - wi) * 7)
    const weekEnd = shiftDay(weekStart, 7)
    return days.filter(d => d >= weekStart && d < weekEnd).length
  })
}
