import { describe, it, expect } from "vitest"
import { computeMonthToDateRevenue } from "./revenue"

// A diferencia de daysUntilAR o calcNutritionTargets, computeMonthToDateRevenue
// recibe "hoy" como parámetro (`today: Date`) en vez de leerlo internamente
// con `new Date()`. Por eso acá no hace falta vi.setSystemTime en ningún
// lado: para fijar "hoy" alcanza con pasarle el Date que queramos. Inyectar
// la fecha como dependencia, en vez de que la función la lea sola, es lo
// que lo hace trivial de testear.
//
// Los Date de "hoy" se arman con new Date(año, mes, día) — mes en 0 (0 =
// enero) — en vez de un string ISO con "Z". Esa forma construye la fecha en
// hora LOCAL de la máquina que corre el test, que es exactamente cómo la
// función la va a leer de vuelta (usa today.getDate()/getMonth()/
// getFullYear(), getters locales) — así el resultado no depende de en qué
// huso horario corra el test.

describe("computeMonthToDateRevenue", () => {
  it("suma los pagos del mes actual y los del mismo tramo del mes anterior, dejando afuera lo que quedó fuera del tramo", () => {
    const today = new Date(2026, 7, 15) // 15 de agosto de 2026

    const payments = [
      { amount: 1000, created_at: "2026-08-05T10:00:00Z" }, // este mes → cuenta
      { amount: 500, created_at: "2026-07-10T10:00:00Z" },  // mes anterior, día 10 ≤ 15 → dentro del tramo, cuenta
      { amount: 300, created_at: "2026-07-20T10:00:00Z" },  // mes anterior, día 20 > 15 → fuera del tramo, no cuenta en ninguno de los dos
      { amount: 200, created_at: "2026-06-01T10:00:00Z" },  // dos meses atrás → no cuenta en ninguno
    ]

    expect(computeMonthToDateRevenue(payments, today)).toEqual({
      thisMonthToDate: 1000,
      sameTramoLastMonth: 500,
      daysIntoMonth: 15,
      isFullMonth: false,
      lastPaymentDate: "2026-08-05T10:00:00Z",
    })
  })

  it("sin pagos, los totales dan 0 y no hay último pago", () => {
    const today = new Date(2026, 7, 15)

    expect(computeMonthToDateRevenue([], today)).toEqual({
      thisMonthToDate: 0,
      sameTramoLastMonth: 0,
      daysIntoMonth: 15,
      isFullMonth: false,
      lastPaymentDate: null,
    })
  })

  it("en el último día del mes, isFullMonth da true — el tramo ya es el mes completo", () => {
    const today = new Date(2026, 7, 31) // 31 de agosto: agosto tiene 31 días

    expect(computeMonthToDateRevenue([], today).isFullMonth).toBe(true)
  })

  it("el día 31 comparado contra un mes anterior más corto (febrero) acota el tramo a los días que febrero realmente tuvo", () => {
    // Caso que el propio comentario del código menciona: "hoy 31 de marzo
    // comparado contra febrero". 2026 no es bisiesto, así que febrero tiene
    // 28 días — el tramo del mes anterior no puede pedir el día 31 de
    // febrero, se acota al 28 (el mes completo, en este caso).
    const today = new Date(2026, 2, 31) // 31 de marzo de 2026

    const payments = [
      { amount: 700, created_at: "2026-02-28T10:00:00Z" }, // último día real de febrero → dentro del tramo acotado
      { amount: 900, created_at: "2026-03-15T10:00:00Z" }, // este mes
    ]

    expect(computeMonthToDateRevenue(payments, today)).toEqual({
      thisMonthToDate: 900,
      sameTramoLastMonth: 700,
      daysIntoMonth: 31,
      isFullMonth: true, // marzo también tiene 31 días
      lastPaymentDate: "2026-03-15T10:00:00Z",
    })
  })
})
