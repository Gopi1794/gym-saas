// Primer archivo de tests del proyecto. Los comentarios de "qué es esto"
// van acá una sola vez, como referencia — no se repiten en los tests que
// sigan.
import { describe, it, expect, afterEach, vi } from "vitest"
import { daysUntilAR, formatDayAR, nowMinutesOfDayAR } from "./date-ar"

// `describe` agrupa los tests de una misma función bajo un nombre común.
// Es solo organización: no cambia si un test pasa o falla, pero hace que el
// reporte se lea ordenado ("daysUntilAR > vence hoy...", "daysUntilAR >
// vence mañana...").
describe("daysUntilAR", () => {
  // daysUntilAR compara "hoy" (la fecha real del sistema, leída en hora
  // argentina) contra el vencimiento recibido. Para testearlo hace falta
  // congelar "hoy" en un valor conocido — si no, el resultado cambiaría
  // todos los días y el test sería no determinístico.
  //
  // vi.useFakeTimers() + vi.setSystemTime(fecha) reemplazan el reloj real:
  // desde ese momento, cualquier `new Date()` o `Date.now()` en el código
  // bajo test devuelve ese instante fijo, no la hora real de la máquina.
  //
  // Importante: esto controla el INSTANTE (los milisegundos desde epoch),
  // no la zona horaria de la máquina que corre el test. No hace falta
  // tocar process.env.TZ porque date-ar.ts nunca depende de la zona del
  // sistema — siempre le pasa timeZone explícito ("America/Argentina/
  // Buenos_Aires" o "UTC") a Intl.DateTimeFormat. Por eso estos tests dan
  // el mismo resultado sin importar en qué huso horario corra quien los
  // ejecuta (tu máquina, CI, lo que sea).

  // `afterEach` corre después de cada `it` de este describe. Sin esto, el
  // reloj falso de un test seguiría activo en el siguiente y contaminaría
  // su resultado.
  afterEach(() => {
    vi.useRealTimers()
  })

  // `it` (alias de `test`, se usan indistinto) es un caso concreto: una
  // entrada puntual y una salida esperada. El nombre se lee como una frase
  // — cuando un test falla, el reporte de Vitest muestra ese nombre, así
  // que tiene que alcanzar para entender qué se rompió sin mirar el código.
  it("vence hoy → devuelve 0, el socio puede entrenar todo el día", () => {
    // 3 de agosto, mediodía en Argentina (15:00 UTC) — "hoy" es el 3 sin
    // ambigüedad de huso horario.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T15:00:00Z"))

    // expect(recibido).toBe(esperado) es la aserción: compara por igualdad
    // estricta (===). Para primitivos (number, string, boolean) es siempre
    // lo que conviene usar.
    expect(daysUntilAR("2026-08-03T00:00:00+00:00")).toBe(0)
  })

  it("vence mañana → devuelve 1", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T15:00:00Z"))

    expect(daysUntilAR("2026-08-04T00:00:00+00:00")).toBe(1)
  })

  it("venció ayer → devuelve -1", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T15:00:00Z"))

    expect(daysUntilAR("2026-08-02T00:00:00+00:00")).toBe(-1)
  })

  it("el caso que causó el bug: a las 23:00 del 2 en Argentina, un vencimiento el 3 todavía da 1 día, no -1", () => {
    // "2026-08-03T02:00:00Z" son las 23:00 del 2 de agosto en Argentina
    // (UTC-3). Antes del fix, middleware.ts y check-in.ts comparaban el
    // instante crudo (`new Date(expiresAt) < new Date()`): como
    // "2026-08-03T00:00:00Z" (el vencimiento) es MENOR que ese "ahora",
    // el socio quedaba bloqueado dos horas antes de que terminara el día
    // que pagó. daysUntilAR compara días de calendario en Argentina, no
    // instantes — por eso da 1, no -1.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T02:00:00Z"))

    expect(daysUntilAR("2026-08-03T00:00:00+00:00")).toBe(1)
  })

  it("el edge case documentado: una hora UTC entre 00:00 y 02:59 le regala un día de más, nunca se lo saca", () => {
    // "2026-08-03T02:00:00+00:00" como vencimiento son, en hora argentina
    // real, las 23:00 del 2 de agosto — un instante que, con precisión de
    // reloj, ya pasó si "hoy" es el 3. Pero daysUntilAR no mira la hora del
    // vencimiento, solo el día calendario del string ("2026-08-03"): por
    // eso da 0 ("vence hoy") en vez de -1 ("ya venció"). Es la imprecisión
    // que describe el comentario de la función — deliberada, y siempre a
    // favor del socio, nunca en contra.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T15:00:00Z"))

    expect(daysUntilAR("2026-08-03T02:00:00+00:00")).toBe(0)
  })

  it("vence en 5 días → devuelve 5, no un número negativo", () => {
    // Caso real reportado en producción: socio con membership_expires_at
    // '2026-08-08 00:00:00+00', evaluado el 3 de agosto — la card lo
    // calculaba bien (5 días), pero el middleware lo bloqueaba igual. Esta
    // función, aislada, da lo que corresponde; el bug estaba en otro lado
    // (ver middleware.ts).
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-03T15:00:00Z"))

    expect(daysUntilAR("2026-08-08T00:00:00+00:00")).toBe(5)
  })
})

describe("nowMinutesOfDayAR", () => {
  // Misma técnica que arriba: se congela el instante con vi.setSystemTime y
  // se verifica qué HORA ARGENTINA lee la función a partir de ese instante
  // UTC. Es la única pieza del registro de comidas por foto que puede
  // reintroducir el bug de timezone: con ella se decide a qué comida del plan
  // corresponde la foto, comparando minutos del día.
  afterEach(() => {
    vi.useRealTimers()
  })

  it("mediodía en Argentina → 12:30 son 750 minutos", () => {
    // 15:30 UTC = 12:30 en Argentina (UTC-3). Caso de control: acá el día
    // UTC y el día argentino coinciden, así que cualquier implementación
    // (bien o mal escrita) da lo mismo. Sirve de sanity check.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T15:30:00Z"))

    expect(nowMinutesOfDayAR()).toBe(12 * 60 + 30)
  })

  it("la franja del bug: 02:00 UTC son las 23:00 del día anterior en Argentina, no las 02:00", () => {
    // 02:00 UTC del 9 de agosto = 23:00 del 8 en Argentina. Es exactamente
    // la franja 21:00–23:59 AR que ya rompió este proyecto varias veces:
    // leer la hora en UTC daría 120 minutos (02:00) y mandaría la foto a la
    // comida equivocada — el desayuno en vez de la cena.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T02:00:00Z"))

    expect(nowMinutesOfDayAR()).toBe(23 * 60)
  })

  it("medianoche argentina exacta → 0, no 1440", () => {
    // 03:00 UTC del 9 = 00:00 del 9 en Argentina. Este test es el que
    // justifica el `hourCycle: "h23"` de la función: con `hour12: false`,
    // Intl formatea la medianoche como "24" (ciclo h24), así que esto daría
    // 1440 —un valor fuera del rango 0–1439— y toda comparación de rangos
    // horarios contra la medianoche quedaría del lado equivocado. Si alguien
    // cambia h23 por hour12: false "porque es lo mismo", este test lo frena.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T03:00:00Z"))

    expect(nowMinutesOfDayAR()).toBe(0)
  })

  it("un minuto después de la medianoche argentina → 1", () => {
    // Confirma que el 0 de arriba es la medianoche real y no un fallback
    // silencioso: si formatToParts no encontrara las partes, la función
    // devolvería 0 en los dos casos y el test anterior pasaría por la razón
    // equivocada.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T03:01:00Z"))

    expect(nowMinutesOfDayAR()).toBe(1)
  })
})

describe("formatDayAR", () => {
  // Estos tests no tocan el reloj: formatDayAR no lee "hoy", solo formatea
  // el string que recibe.

  it("formatea la medianoche UTC del 3 de agosto como '03 de ago de 2026', no como el 2", () => {
    // El bug original: mostrar "02 de ago" cuando el socio cargó el 3. Pasa
    // cuando se formatea con la zona horaria implícita del navegador
    // (Argentina, UTC-3) en vez de leer el día tal cual está guardado.
    expect(formatDayAR("2026-08-03T00:00:00+00:00")).toBe("03 de ago de 2026")
  })

  it("da el mismo resultado para timestamptz de cualquier hora y para una columna date sin hora, si el día es el mismo", () => {
    const bareDate = formatDayAR("2026-08-03")                    // columna `date` (date_of_birth)
    const midnightUtc = formatDayAR("2026-08-03T00:00:00+00:00")  // input type="date" guardado (membership_expires_at)
    const seedTime = formatDayAR("2026-08-03T18:50:40+00:00")     // timestamptz con hora real (seed / renovación)

    expect(bareDate).toBe("03 de ago de 2026")
    expect(midnightUtc).toBe("03 de ago de 2026")
    expect(seedTime).toBe("03 de ago de 2026")
  })

  it("con un string vacío devuelve el texto 'Invalid Date' en vez de tirar una excepción — comportamiento actual, sin validar", () => {
    // iso.split("T")[0] sobre "" da "", eso arma "T12:00:00Z", que
    // new Date() no puede parsear (Invalid Date). toLocaleDateString()
    // sobre un Invalid Date no explota: devuelve el string literal
    // "Invalid Date". Documentado tal cual está hoy — no es el
    // comportamiento ideal (un admin vería ese texto en la UI en vez de un
    // guion), pero cambiarlo es una decisión aparte, no algo que este test
    // deba forzar.
    expect(formatDayAR("")).toBe("Invalid Date")
  })

  it("con un string sin formato de fecha también devuelve 'Invalid Date', no excepción", () => {
    expect(formatDayAR("no-es-una-fecha")).toBe("Invalid Date")
  })
})
