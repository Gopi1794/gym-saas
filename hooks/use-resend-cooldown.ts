"use client"

import { useCallback, useEffect, useState } from "react"

const COOLDOWN_MS = 60_000

export function buildResendCooldownKey(email: string): string {
  return `forgot-password-resend:${email.trim().toLowerCase()}`
}

export function armResendCooldown(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, String(Date.now()))
  } catch {
    // localStorage puede fallar en modo privado; el cooldown sigue funcionando en memoria
  }
}

function readRemainingMs(storageKey: string): number {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return 0
    const sentAt = Number(raw)
    if (!Number.isFinite(sentAt)) return 0
    return Math.max(0, COOLDOWN_MS - (Date.now() - sentAt))
  } catch {
    return 0
  }
}

export function useResendCooldown(storageKey: string) {
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    setRemainingMs(readRemainingMs(storageKey))
    const interval = setInterval(() => {
      setRemainingMs(readRemainingMs(storageKey))
    }, 1000)
    return () => clearInterval(interval)
  }, [storageKey])

  const start = useCallback(() => {
    armResendCooldown(storageKey)
    setRemainingMs(COOLDOWN_MS)
  }, [storageKey])

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isReady: remainingMs <= 0,
    start,
  }
}
