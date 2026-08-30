import { createHash, randomBytes } from "crypto"
import { daysUntilAR } from "@/lib/date-ar"

export type AccessCredentialKind = "nfc" | "serial_test"
export type AccessCredentialInput = "serial" | "nfc" | "manual"
export type DeviceCheckInMethod = "device" | "nfc"

export function normalizeAccessValue(value: string): string {
  return value.trim()
}

export function hashAccessSecret(value: string): string {
  return createHash("sha256").update(normalizeAccessValue(value), "utf8").digest("hex")
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url")
}

export function resolveDeviceCheckInMethod(input?: string | null): DeviceCheckInMethod {
  return input === "nfc" ? "nfc" : "device"
}

export function isProfileAllowedToCheckIn(profile: {
  role: string | null
  membership_expires_at: string | null
}): boolean {
  if (profile.role === "admin" || profile.role === "trainer") return true
  return profile.membership_expires_at != null && daysUntilAR(profile.membership_expires_at) >= 0
}
