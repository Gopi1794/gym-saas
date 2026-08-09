const MAX_DIFFERENCE_MINUTES = 3 * 60

function parseTimeLabelToMinutes(timeLabel: string | null): number | null {
  if (!timeLabel) return null
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Encuentra la comida del plan cuyo time_label está más cerca de photoMinutes
 * (minutos desde medianoche, YA en hora de Argentina — ver nowMinutesOfDayAR
 * en lib/date-ar.ts), dentro de una ventana de 3 horas. Fuera de esa ventana
 * (o sin comidas, o time_label inválido en todas), devuelve null — el
 * registro queda como "extra" en vez de forzar un match lejano.
 *
 * Función pura a propósito: no toca Date ni timezone. Quien la llama es
 * responsable de convertir a minutos-del-día en hora de Argentina antes de
 * invocarla — mezclar esa conversión acá adentro es cómo se cuela el bug de
 * timezone (ver nota de autorevisión de esta tarea en el plan).
 *
 * Limitación conocida y aceptada: no hay wraparound de medianoche. photoMinutes
 * cerca de 0 (poco después de medianoche) se compara contra time_label en
 * minutos-del-día (0-1439), no contra la cena de las 21:00 del día anterior —
 * para ese caso puntual (comida tarde en la noche, ya pasada la medianoche)
 * el registro queda como "extra" en vez de matchear con la cena. Aceptable
 * para esta versión.
 */
export function matchMealByTime<T extends { id: string; name: string; time_label: string | null }>(
  photoMinutes: number,
  meals: T[],
): T | null {
  let closest: T | null = null
  let closestDiff = Infinity

  for (const meal of meals) {
    const mealMinutes = parseTimeLabelToMinutes(meal.time_label)
    if (mealMinutes === null) continue

    const diff = Math.abs(mealMinutes - photoMinutes)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = meal
    }
  }

  if (closest === null || closestDiff > MAX_DIFFERENCE_MINUTES) return null
  return closest
}
