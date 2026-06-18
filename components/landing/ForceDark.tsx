"use client"

import { useEffect } from "react"

export function ForceDark({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.getAttribute("class") ?? ""
    html.classList.add("dark")
    html.classList.remove("light")
    return () => {
      html.setAttribute("class", prev)
    }
  }, [])

  return <>{children}</>
}
