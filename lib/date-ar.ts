const TZ = "America/Argentina/Buenos_Aires"

/** Today's date string (YYYY-MM-DD) in Argentina timezone. */
export function todayAR(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date())
}

/**
 * A Date object whose .getDate(), .getDay(), .getMonth(), .getFullYear()
 * reflect Argentina's current date. Safe on a UTC server.
 * Do NOT use .toISOString() on this — use todayAR() for string output.
 */
export function todayDateAR(): Date {
  return new Date(todayAR() + "T12:00:00Z")
}

/** Current hour (0–23) in Argentina. */
export function hourAR(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date()),
    10,
  )
}

/** Day of week in Argentina (0=Sun … 6=Sat), same convention as JS Date.getDay(). */
export function dayOfWeekAR(): number {
  return todayDateAR().getDay()
}

/** Start of today at 00:00 AR time, returned as UTC ISO string for Supabase .gte() on timestamp columns. */
export function startOfTodayAR(): string {
  return new Date(`${todayAR()}T00:00:00-03:00`).toISOString()
}

/** Monday of the current AR week at 00:00 AR time, returned as UTC ISO string for Supabase .gte(). */
export function mondayOfWeekAR(): string {
  const jsDay = dayOfWeekAR()
  const offset = jsDay === 0 ? -6 : 1 - jsDay
  const d = new Date(`${todayAR()}T00:00:00-03:00`)
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

/** First day of the current AR month at 00:00 AR time, returned as UTC ISO string. */
export function firstOfMonthAR(): string {
  const [year, month] = todayAR().split("-")
  return new Date(`${year}-${month}-01T00:00:00-03:00`).toISOString()
}

/** First day N months ago (from current AR month), returned as UTC ISO string. */
export function firstOfMonthsAgoAR(n: number): string {
  const today = todayDateAR()
  const d = new Date(today.getFullYear(), today.getMonth() - n, 1)
  return new Date(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`,
  ).toISOString()
}

/** N days ago at 00:00 AR time, returned as UTC ISO string. */
export function daysAgoAR(n: number): string {
  const d = new Date(`${todayAR()}T00:00:00-03:00`)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

/**
 * Días de diferencia entre expiresAt (timestamptz ISO) y "hoy" en Argentina,
 * por día calendario — no por instante. Negativo si ya pasó.
 *
 * Lee el día directo del string en UTC (antes de la "T"), sin convertir de
 * zona: para fechas puestas a mano (MemberMembershipEdit.tsx, siempre
 * medianoche UTC del día elegido) esto es exactamente correcto — "vence el
 * 3" guardado como medianoche UTC del 3 es lo que el usuario eligió, y
 * leerlo tal cual respeta esa elección. Convertir de zona acá correría la
 * fecha un día para atrás (mismo caso ya resuelto en
 * notify_expiring_memberships).
 *
 * Para fechas con hora ≠ medianoche (ej. renovaciones de MercadoPago desde
 * un vencimiento previo, donde el nuevo vencimiento sale de `now() +
 * duración`) puede regalar hasta un día completo cuando la hora UTC cae
 * entre 00:00 y 02:59 — esa franja, en Argentina, todavía es el día
 * anterior. No se corrige a propósito: el error solo va para el lado de dar
 * más acceso, nunca de sacarlo — exactamente lo que se buscaba arreglar con
 * esta función. Cortarlo con precisión de instante reintroduciría el bug
 * original (bloquear antes de tiempo).
 */
export function daysUntilAR(expiresAt: string): number {
  const expiresDay = expiresAt.split("T")[0]
  const todayStr = todayAR()
  return Math.round(
    (new Date(`${expiresDay}T12:00:00Z`).getTime() - new Date(`${todayStr}T12:00:00Z`).getTime()) / 86_400_000
  )
}

/**
 * Formatea una fecha "de calendario" (medianoche UTC del día elegido, o una
 * columna `date` pura tipo date_of_birth) leyendo el día directo del string,
 * sin conversión de zona — mismo criterio que daysUntilAR, para mostrar en
 * vez de comparar.
 *
 * Ancla a mediodía UTC y fuerza timeZone: "UTC" en el formato: el resultado
 * no depende de si esto corre en el navegador (zona AR) o en el server —
 * a diferencia de `new Date(iso).toLocaleDateString(...)` sin timeZone, que
 * en un navegador en Argentina corre la fecha un día para atrás (medianoche
 * UTC del 3 = 21:00 del 2 en AR).
 *
 * No usar esto para instantes reales (created_at, paid_at, checked_in_at):
 * ahí sí corresponde mostrar la hora local de quien mira.
 */
export function formatDayAR(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  const day = iso.split("T")[0]
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { ...options, timeZone: "UTC" })
}
