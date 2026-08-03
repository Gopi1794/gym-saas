import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { MealItem } from "@/app/actions/nutrition"
import { calcMacros, calcNutritionTargets, missingTargetFields } from "./nutrition"

describe("calcMacros", () => {
  it("suma los macros de varios items, escalados por los gramos de cada uno sobre 100", () => {
    // calcMacros solo lee quantity_grams y foods.{calories,protein,carbs,fat}
    // de cada item — no hace falta un fixture con todos los campos reales
    // de Food (fiber, sodium, vitaminas...). Completamos solo lo que la
    // función usa y casteamos al tipo real: para testear una función pura
    // alcanza con lo que esa función efectivamente lee.
    const items = [
      { quantity_grams: 200, foods: { calories: 100, protein: 10, carbs: 20, fat: 5 } },
      { quantity_grams: 50, foods: { calories: 200, protein: 0, carbs: 0, fat: 20 } },
    ] as unknown as MealItem[]

    // toEqual compara objetos por valor (campo a campo). toBe compara por
    // referencia (===) y para objetos casi siempre falla aunque el
    // contenido sea idéntico — toBe es para primitivos, toEqual para
    // objetos y arrays.
    expect(calcMacros(items)).toEqual({ calories: 300, protein: 20, carbs: 40, fat: 20 })
  })

  it("con una lista vacía, devuelve todos los macros en 0", () => {
    expect(calcMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe("missingTargetFields", () => {
  it("con el perfil completo, no falta nada", () => {
    expect(missingTargetFields({ weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01" })).toEqual([])
  })

  it("con el perfil vacío (null), faltan los tres campos", () => {
    expect(missingTargetFields(null)).toEqual(["peso", "altura", "fecha de nacimiento"])
  })

  it("con un solo campo faltante, devuelve solo ese campo", () => {
    expect(missingTargetFields({ weight_kg: null, height_cm: 180, date_of_birth: "1990-01-01" })).toEqual(["peso"])
  })
})

describe("calcNutritionTargets", () => {
  // Adentro de calcNutritionTargets, ageFromDob calcula la edad contra la
  // hora real del sistema — igual que con daysUntilAR, hace falta congelar
  // "hoy" para que el resultado no cambie según cuándo se corra el test.
  //
  // beforeEach corre antes de CADA it() de este describe (al revés de
  // afterEach). Como todos los tests de acá necesitan la misma fecha
  // congelada, fijarla en un beforeEach evita repetir las mismas dos
  // líneas en cada it().
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const baseProfile = {
    weight_kg: 80,
    height_cm: 180,
    // Lejos del "hoy" de arriba (agosto) a propósito: así la edad calculada
    // no depende de en qué huso horario corra la máquina que ejecuta el
    // test. ageFromDob usa getters locales (getFullYear/getMonth/getDate),
    // no zona explícita como el resto de date-ar.ts — con meses de margen
    // entre el cumpleaños y el "hoy" congelado, un corrimiento de algunas
    // horas por huso horario nunca cambia el resultado.
    date_of_birth: "1990-06-15",
    gender: "male" as const,
    training_frequency: "3-4" as const,
  }

  it("con los datos completos, calcula calorías y macros según la fórmula de Mifflin-St Jeor", () => {
    // Con esta fecha de nacimiento y el "hoy" congelado arriba, la edad da 36.
    expect(calcNutritionTargets(baseProfile, "mantenimiento")).toEqual({
      calories: 2713, protein: 136, carbs: 380, fat: 72,
    })
  })

  it("el objetivo (volumen, definición, etc.) cambia el resultado aunque el perfil sea el mismo", () => {
    expect(calcNutritionTargets(baseProfile, "volumen")).toEqual({
      calories: 3039, protein: 144, carbs: 436, fat: 80,
    })
  })

  // it.each corre el mismo test una vez por cada fila de la tabla — evita
  // copiar y pegar el mismo it() tres veces cuando lo único que cambia es
  // el dato de entrada. El %s en el nombre se reemplaza por el primer
  // valor de cada fila (weight_kg, height_cm, date_of_birth).
  it.each([
    ["weight_kg", { ...baseProfile, weight_kg: null }],
    ["height_cm", { ...baseProfile, height_cm: null }],
    ["date_of_birth", { ...baseProfile, date_of_birth: null }],
  ] as const)("sin %s, devuelve null en vez de calcular con datos incompletos", (_campo, profile) => {
    expect(calcNutritionTargets(profile, "mantenimiento")).toBeNull()
  })

  it("con una edad menor a 10 años, devuelve null", () => {
    expect(calcNutritionTargets({ ...baseProfile, date_of_birth: "2021-01-15" }, "mantenimiento")).toBeNull()
  })

  it("con una edad mayor a 100 años, devuelve null", () => {
    expect(calcNutritionTargets({ ...baseProfile, date_of_birth: "1900-01-01" }, "mantenimiento")).toBeNull()
  })
})
