"use client"

import { useState } from "react"
import type { ElementType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Liquid } from "liquid-gooey"
import {
  LayoutDashboard, Users, QrCode, User,
  TrendingUp, Dumbbell, Apple, MoreHorizontal, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  role: string
}

type NavItem = { href: string; label: string; icon: ElementType }

const ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",      icon: Users },
    { href: "/nutricion",     label: "Nutrici\u00f3n",  icon: Apple },
    { href: "/check-in",      label: "Check-in",      icon: QrCode },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
  trainer: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",      icon: Users },
    { href: "/nutricion",     label: "Nutrici\u00f3n",  icon: Apple },
    { href: "/check-in",      label: "Check-in",      icon: QrCode },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
  member: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/entrenamiento", label: "Mi rutina",     icon: Dumbbell },
    { href: "/nutricion",     label: "Nutrici\u00f3n",  icon: Apple },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
}

const MEMBER_MORE: NavItem[] = [
  { href: "/progress", label: "Progreso", icon: TrendingUp },
  { href: "/check-in", label: "Check-in", icon: QrCode },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[10px] font-medium transition-colors",
        active
          ? "bg-brand-700/20 text-brand-500 shadow-[0_0_12px_rgba(213,0,0,0.35)]"
          : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "text-brand-500")} />
      {item.label}
    </Link>
  )
}

export default function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = ITEMS_BY_ROLE[role] ?? ITEMS_BY_ROLE.member
  const isMember = role === "member"
  const moreActive = isMember && MEMBER_MORE.some(i => pathname === i.href)
  const leadingItems = isMember ? items.slice(0, 2) : items
  const trailingItems = isMember ? items.slice(2) : []

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Full-width fade behind the nav so scrolled content does not peek through the pill margins. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-zinc-100 dark:from-black to-transparent md:hidden" />

      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-full border border-zinc-800/80 bg-zinc-950/95 shadow-lg backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around px-1 py-1.5">
          {leadingItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}

          {isMember && <div className="h-12 w-16 shrink-0" aria-hidden="true" />}

          {trailingItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>
      </nav>

      {isMember && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 h-40 w-64 -translate-x-1/2 md:hidden">
          <Liquid
            blur={8}
            contrast={20}
            fill="#d50000"
            shadow="0 14px 30px rgba(213,0,0,.38), inset 0 1px 0 rgba(255,255,255,.24)"
            filterPadding={42}
            className="relative h-full w-full"
          >
            {MEMBER_MORE.map((item, index) => {
              const Icon = item.icon
              const active = pathname === item.href
              const x = moreOpen ? (index === 0 ? -58 : 58) : 0
              const y = moreOpen ? -84 : 0

              return (
                <Liquid.Item
                  key={item.href}
                  x={x}
                  y={y}
                  scale={moreOpen ? 1 : 0.1}
                  transition="bouncy"
                  delay={index * 35}
                  radius={999}
                  className={cn(
                    "absolute bottom-0 left-1/2 -ml-12 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    moreOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-label={item.label}
                    className={cn(
                      "flex h-11 w-24 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-brand-700 px-2 text-white shadow-lg transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95",
                      active && "ring-2 ring-white/45"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-bold leading-none">{item.label}</span>
                  </Link>
                </Liquid.Item>
              )
            })}

            <Liquid.Item
              x={0}
              y={0}
              transition="bouncy"
              radius={999}
              className="pointer-events-auto absolute bottom-0 left-1/2 -ml-8"
            >
              <button
                type="button"
                onClick={() => setMoreOpen(v => !v)}
                aria-label={moreOpen ? "Cerrar m\u00e1s opciones" : "Abrir m\u00e1s opciones"}
                aria-expanded={moreOpen}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-brand-700 text-white shadow-[0_18px_42px_rgba(213,0,0,.45)] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95",
                  (moreActive || moreOpen) && "ring-4 ring-brand-500/20"
                )}
              >
                {moreOpen ? <X className="h-6 w-6" /> : <MoreHorizontal className="h-7 w-7" />}
              </button>
            </Liquid.Item>
          </Liquid>
        </div>
      )}
    </>
  )
}
