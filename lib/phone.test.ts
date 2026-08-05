import { describe, it, expect } from "vitest"
import { normalizePhoneAR, formatPhoneAR, whatsappNumber } from "./phone"

describe("normalizePhoneAR", () => {
  // Los cinco formatos de abajo son la MISMA línea (Buenos Aires, 11
  // 1234-5678) tipeada como la escribiría un admin real: con o sin el 0
  // de larga distancia, con o sin el 15 de celular local, o ya en formato
  // internacional. libphonenumber-js, sin el 15 o el 9 explícito, la
  // interpreta como fijo — normalizePhoneAR fuerza el 9 igual, porque acá
  // todo número cargado es un celular. Los cinco tienen que dar el mismo
  // E.164, o el botón de WhatsApp termina armando un link a otra persona.
  it("'011 1234-5678' (sin 15, con 0) da +5491112345678", () => {
    expect(normalizePhoneAR("011 1234-5678")).toBe("+5491112345678")
  })

  it("'11 1234-5678' (sin 15, sin 0) da el mismo +5491112345678", () => {
    expect(normalizePhoneAR("11 1234-5678")).toBe("+5491112345678")
  })

  it("'011 15-1234-5678' (con 15) da el mismo +5491112345678", () => {
    expect(normalizePhoneAR("011 15-1234-5678")).toBe("+5491112345678")
  })

  it("'+54 9 11 1234-5678' (formato internacional completo) da el mismo +5491112345678", () => {
    expect(normalizePhoneAR("+54 9 11 1234-5678")).toBe("+5491112345678")
  })

  it("'9 11 1234-5678' (con 9, sin +54) da el mismo +5491112345678", () => {
    expect(normalizePhoneAR("9 11 1234-5678")).toBe("+5491112345678")
  })

  it("un string vacío no es un número válido, devuelve null", () => {
    expect(normalizePhoneAR("")).toBeNull()
  })

  it("letras en vez de dígitos no son un número válido, devuelve null", () => {
    expect(normalizePhoneAR("abc")).toBeNull()
  })

  it("un número demasiado corto para ser argentino devuelve null", () => {
    expect(normalizePhoneAR("11-1234")).toBeNull()
  })

  it("un número de otro país (EE.UU.) devuelve null — acá solo se acepta Argentina", () => {
    expect(normalizePhoneAR("+1 415 555 2671")).toBeNull()
  })
})

describe("formatPhoneAR", () => {
  it("formatea un E.164 de celular al formato nacional con el 15", () => {
    expect(formatPhoneAR("+5491112345678")).toBe("011 15-1234-5678")
  })
})

describe("whatsappNumber", () => {
  it("saca el '+' del E.164, dejando solo dígitos para wa.me", () => {
    expect(whatsappNumber("+5491112345678")).toBe("5491112345678")
  })
})
