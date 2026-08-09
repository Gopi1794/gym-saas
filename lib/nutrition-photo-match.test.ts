import { describe, it, expect } from "vitest"
import { matchMealByTime } from "./nutrition-photo-match"

const meals = [
  { id: "1", name: "Desayuno", time_label: "08:00" },
  { id: "2", name: "Almuerzo", time_label: "13:00" },
  { id: "3", name: "Merienda", time_label: "17:00" },
  { id: "4", name: "Cena", time_label: "21:00" },
]

function atHour(h: number, m = 0) {
  return h * 60 + m
}

describe("matchMealByTime", () => {
  it("matchea la comida exacta cuando la hora coincide", () => {
    expect(matchMealByTime(atHour(13, 0), meals)?.id).toBe("2")
  })

  it("matchea la comida más cercana dentro de la ventana de 3 horas", () => {
    // 15:30 está a 2.5h de almuerzo (13:00) y 1.5h de merienda (17:00) -> merienda
    expect(matchMealByTime(atHour(15, 30), meals)?.id).toBe("3")
  })

  it("devuelve null si no hay ninguna comida dentro de 3 horas", () => {
    // 03:00 no está a menos de 3h de ninguna comida (la más cercana, desayuno 08:00, está a 5h)
    expect(matchMealByTime(atHour(3, 0), meals)).toBeNull()
  })

  it("devuelve null si la lista de comidas está vacía", () => {
    expect(matchMealByTime(atHour(13, 0), [])).toBeNull()
  })

  it("ignora comidas con time_label inválido o vacío sin romper el resto", () => {
    const withBad = [
      ...meals,
      { id: "5", name: "Sin horario", time_label: "" },
      { id: "6", name: "Horario roto", time_label: "no-es-una-hora" },
    ]
    expect(matchMealByTime(atHour(13, 0), withBad)?.id).toBe("2")
  })

  it("matchea justo en el límite de 3 horas (inclusive)", () => {
    // 05:00 está a exactamente 3h de desayuno (08:00, la única dentro de rango) -> límite exacto, debe matchear
    expect(matchMealByTime(atHour(5, 0), meals)?.id).toBe("1")
  })

  it("devuelve null justo pasado el límite de 3 horas", () => {
    // 04:01 está a 3h59 de desayuno (08:00, la comida más cercana) — pasa el límite de 180 min por 59 min
    expect(matchMealByTime(atHour(4, 1), meals)).toBeNull()
  })
})
