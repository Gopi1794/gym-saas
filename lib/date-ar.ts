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
