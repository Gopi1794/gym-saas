"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const PILLS = [
  { label: "Resumen",    href: "/dashboard" },
  { label: "Check-ins", href: "/check-in" },
  { label: "Miembros",  href: "/members" },
  { label: "Ejercicios",href: "/exercises" },
  { label: "Planes",    href: "/planes" },
]

export default function CategoryPills() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {PILLS.map(({ label, href }) => {
        const active = pathname === href
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-white text-zinc-950 shadow-sm"
                : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
