import { describe, expect, it } from "vitest"
import { parseMpExternalReference, resolveMpPaymentProcessingPlan } from "./mp-webhook"

describe("parseMpExternalReference", () => {
  it("parsea member, gym y tipo de membresía", () => {
    expect(parseMpExternalReference("member-1__gym-1__premium__123456")).toEqual({
      memberId: "member-1",
      gymId: "gym-1",
      membershipType: "premium",
    })
  })

  it("ignora tipos de membresía desconocidos", () => {
    expect(parseMpExternalReference("member-1__gym-1__inventado__123456")).toEqual({
      memberId: "member-1",
      gymId: "gym-1",
      membershipType: undefined,
    })
  })

  it("devuelve campos undefined cuando no hay referencia", () => {
    expect(parseMpExternalReference(undefined)).toEqual({
      memberId: undefined,
      gymId: undefined,
      membershipType: undefined,
    })
  })
})

describe("resolveMpPaymentProcessingPlan", () => {
  it("resuelve approved como acción para finalizar membresía", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "approved",
      notificationExternalReference: "member-1__gym-1__vip__123456",
    })).toEqual({
      action: "approved",
      memberId: "member-1",
      gymId: "gym-1",
      membershipType: "vip",
      checkoutExternalReference: "member-1__gym-1__vip__123456",
    })
  })

  it("resuelve rejected como acción para registrar pago fallido", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "rejected",
      notificationExternalReference: "member-1__gym-1__basic__123456",
    })?.action).toBe("rejected")
  })

  it("resuelve cancelled como acción para registrar pago fallido", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "cancelled",
      notificationExternalReference: "member-1__gym-1__basic__123456",
    })?.action).toBe("cancelled")
  })

  it("ignora estados no accionables", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "pending",
      notificationExternalReference: "member-1__gym-1__basic__123456",
    })).toBeNull()
  })

  it("usa la external_reference del pago como fallback si la notificación vino incompleta", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "approved",
      paymentExternalReference: "member-2__gym-2__premium__123456",
    })).toEqual({
      action: "approved",
      memberId: "member-2",
      gymId: "gym-2",
      membershipType: "premium",
      checkoutExternalReference: "member-2__gym-2__premium__123456",
    })
  })

  it("cae a basic si la referencia no trae tipo válido", () => {
    expect(resolveMpPaymentProcessingPlan({
      status: "approved",
      notificationExternalReference: "member-1__gym-1__desconocido__123456",
    })?.membershipType).toBe("basic")
  })

  it("no arma un plan si falta member o gym", () => {
    expect(resolveMpPaymentProcessingPlan({ status: "approved", notificationExternalReference: "member-only" })).toBeNull()
  })
})
