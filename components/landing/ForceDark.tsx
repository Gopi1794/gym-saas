"use client"

import { useEffect } from "react"

export function ForceDark({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.className
    html.classList.add("dark")
    return () => {
      html.className = prev
    }
  }, [])

  return <>{children}</>
}
