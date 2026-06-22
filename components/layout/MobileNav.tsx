"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, QrCode, User,
  TrendingUp, Dumbbell, Apple, MoreHorizontal, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  role: string
}

const ITEMS_BY_ROLE: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  admin: [
    { href: "/dashboard",     label: "Inicio",      icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",    icon: Users },
    { href: "/nutricion",     label: "Nutrición",   icon: Apple },
    { href: "/check-in",      label: "Check-in",    icon: QrCode },
    { href: "/profile",       label: "Perfil",      icon: User },
  ],
  trainer: [
    { href: "/dashboard",     label: "Inicio",      icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",    icon: Users },
    { href: "/nutricion",     label: "Nutrición",   icon: Apple },
    { href: "/check-in",      label: "Check-in",    icon: QrCode },
    { href: "/profile",       label: "Perfil",      icon: User },
  ],
  member: [
    { href: "/dashboard",     label: "Inicio",      icon: LayoutDashboard },
    { href: "/entrenamiento", label: "Mi rutina",   icon: Dumbbell },
    { href: "/nutricion",     label: "Nutrición",   icon: Apple },
    { href: "/profile",       label: "Perfil",      icon: User },
  ],
}

const MEMBER_MORE: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/progress",  label: "Progreso",  icon: TrendingUp },
  { href: "/check-in",  label: "Check-in",  icon: QrCode },
]

export default function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = ITEMS_BY_ROLE[role] ?? ITEMS_BY_ROLE.member
  const isMember = role === "member"
  const moreActive = isMember && MEMBER_MORE.some(i => pathname === i.href)

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed bottom-[56px] left-0 right-0 z-50 rounded-t-2xl border-t border-zinc-800 bg-zinc-950 px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Más opciones</p>
            <button onClick={() => setMoreOpen(false)} className="rounded-full p-1 text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MEMBER_MORE.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl py-3 text-[10px] font-medium transition-colors",
                    isActive ? "text-brand-500 bg-brand-500/10" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-brand-500")} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md md:hidden safe-bottom">
        <div className="flex pb-safe">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-brand-500" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-brand-500")} />
                {item.label}
              </Link>
            )
          })}

          {isMember && (
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                moreActive || moreOpen ? "text-brand-500" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <MoreHorizontal className={cn("h-5 w-5", (moreActive || moreOpen) && "text-brand-500")} />
              Más
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
