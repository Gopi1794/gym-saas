"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sileo"

export function ToastProvider() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="top-center" theme={resolvedTheme === "light" ? "light" : "dark"} />
}
