import { describe, it, expect } from "vitest"
import {
  canCollectPayment,
  isPlanCollectible,
  normalizeMpReference,
  normalizePaymentNotes,
} from "./payments"

describe("canCollectPayment", () => {
  it("admin siempre puede, tenga o no el flag prendido", () => {
    expect(canCollectPayment("admin", false)).toBe(true)
    expect(canCollectPayment("admin", true)).toBe(true)
  })

  it("trainer con el permiso otorgado por el admin puede", () => {
    expect(canCollectPayment("trainer", true)).toBe(true)
  })

  it("trainer sin el permiso otorgado NO puede — el default es false", () => {
    expect(canCollectPayment("trainer", false)).toBe(false)
  })

  // El permiso es granular por persona, otorgado por el admin — nunca un
  // privilegio automático de otro rol, ni siquiera con el flag en true por
  // error de datos (no debería pasar, pero si pasara no tiene que colar).
  it("member nunca puede, ni con el flag en true", () => {
    expect(canCollectPayment("member", true)).toBe(false)
  })

  it("un rol desconocido/vacío nunca puede", () => {
    expect(canCollectPayment("", true)).toBe(false)
  })
})

describe("isPlanCollectible", () => {
  it("un plan activo con precio > 0 es cobrable", () => {
    expect(isPlanCollectible({ is_active: true, price: 15000 })).toBe(true)
  })

  // payments.amount tiene check(amount > 0) — un plan gratuito no puede
  // generar una fila de pago. Esos siguen siendo admin-only vía "Editar
  // membresía", nunca pasan por "Cobrar y renovar".
  it("un plan activo con precio 0 NO es cobrable", () => {
    expect(isPlanCollectible({ is_active: true, price: 0 })).toBe(false)
  })

  it("un plan pago pero inactivo (dado de baja) NO es cobrable", () => {
    expect(isPlanCollectible({ is_active: false, price: 15000 })).toBe(false)
  })

  it("null (no hay plan configurado de ese tipo) NO es cobrable", () => {
    expect(isPlanCollectible(null)).toBe(false)
  })

  it("undefined NO es cobrable", () => {
    expect(isPlanCollectible(undefined)).toBe(false)
  })
})

describe("normalizeMpReference", () => {
  it("con método mercadopago, guarda el número tal cual (trimmed)", () => {
    expect(normalizeMpReference("mercadopago", "  12345678901  ")).toBe("12345678901")
  })

  // El nº de operación es lo que permite al índice único parcial detectar
  // un pago cargado dos veces (una vez a mano, otra vez por el webhook
  // automático) — guardarlo en un método donde nunca puede existir sería
  // un dato falso, no una ausencia de dato.
  it("con método cash, siempre da null aunque venga un valor", () => {
    expect(normalizeMpReference("cash", "12345678901")).toBeNull()
  })

  it("string vacío da null, no ''", () => {
    expect(normalizeMpReference("mercadopago", "")).toBeNull()
  })

  it("solo espacios da null", () => {
    expect(normalizeMpReference("mercadopago", "   ")).toBeNull()
  })

  it("null da null", () => {
    expect(normalizeMpReference("mercadopago", null)).toBeNull()
  })

  it("undefined da null", () => {
    expect(normalizeMpReference("mercadopago", undefined)).toBeNull()
  })
})

describe("normalizePaymentNotes", () => {
  it("guarda la nota tal cual, recortando espacios de los bordes", () => {
    expect(normalizePaymentNotes("  pagó con dos billetes rotos  ")).toBe("pagó con dos billetes rotos")
  })

  it("string vacío da null, no ''", () => {
    expect(normalizePaymentNotes("")).toBeNull()
  })

  it("solo espacios da null", () => {
    expect(normalizePaymentNotes("   ")).toBeNull()
  })

  it("null da null", () => {
    expect(normalizePaymentNotes(null)).toBeNull()
  })

  it("undefined da null", () => {
    expect(normalizePaymentNotes(undefined)).toBeNull()
  })
})
