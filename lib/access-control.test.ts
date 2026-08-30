import { describe, expect, it } from "vitest"
import {
  hashAccessSecret,
  isProfileAllowedToCheckIn,
  normalizeAccessValue,
  resolveDeviceCheckInMethod,
} from "./access-control"

describe("access-control", () => {
  it("normaliza credenciales antes de hashearlas", () => {
    expect(normalizeAccessValue(" 12345 ")).toBe("12345")
    expect(hashAccessSecret(" 12345 ")).toBe(hashAccessSecret("12345"))
  })

  it("resuelve el método de check-in del dispositivo", () => {
    expect(resolveDeviceCheckInMethod("nfc")).toBe("nfc")
    expect(resolveDeviceCheckInMethod("serial")).toBe("device")
    expect(resolveDeviceCheckInMethod(null)).toBe("device")
  })

  it("permite staff aunque no tenga vencimiento de membresía", () => {
    expect(isProfileAllowedToCheckIn({ role: "admin", membership_expires_at: null })).toBe(true)
    expect(isProfileAllowedToCheckIn({ role: "trainer", membership_expires_at: null })).toBe(true)
  })

  it("rechaza miembros sin membresía vigente", () => {
    expect(isProfileAllowedToCheckIn({ role: "member", membership_expires_at: null })).toBe(false)
    expect(isProfileAllowedToCheckIn({ role: "member", membership_expires_at: "2000-01-01" })).toBe(false)
  })
})
