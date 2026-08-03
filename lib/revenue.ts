// Única fuente para "ingresos del mes vs mismo tramo del mes anterior" —
// la usan dashboard/page.tsx y reports/page.tsx. Si cada uno calculara esto
// por su cuenta, en dos meses divergen — mismo patrón que ya pasó con
// "activo", "renovación" y los GOAL_LABELS.

export interface MonthToDateRevenue {
  thisMonthToDate: number
  sameTramoLastMonth: number
  daysIntoMonth: number
  isFullMonth: boolean       // hoy es el último día del mes → tramo = mes completo
  lastPaymentDate: string | null
}

export function computeMonthToDateRevenue(
  payments: { amount: number; created_at: string }[],
  today: Date
): MonthToDateRevenue {
  const daysIntoMonth = today.getDate()
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const daysInLastMonth = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate()
  // Mismo día del mes, acotado a lo que el mes anterior realmente tenía
  // (ej: hoy 31 de marzo comparado contra febrero).
  const cappedDay = Math.min(daysIntoMonth, daysInLastMonth)
  const lastMonthTramoEnd = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), cappedDay, 23, 59, 59, 999)

  let thisMonthToDate = 0
  let sameTramoLastMonth = 0
  let lastPaymentDate: string | null = null

  for (const p of payments) {
    const d = new Date(p.created_at)
    if (d >= thisMonthStart) thisMonthToDate += p.amount ?? 0
    if (d >= lastMonthStart && d <= lastMonthTramoEnd) sameTramoLastMonth += p.amount ?? 0
    if (!lastPaymentDate || p.created_at > lastPaymentDate) lastPaymentDate = p.created_at
  }

  return {
    thisMonthToDate,
    sameTramoLastMonth,
    daysIntoMonth,
    isFullMonth: daysIntoMonth >= daysInCurrentMonth,
    lastPaymentDate,
  }
}
