"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, QrCode, User,
  TrendingUp, Dumbbell, Apple,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  role: string
}

// Max 5 items por rol — los más usados, al alcance del pulgar
const ITEMS_BY_ROLE: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  admin: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",      icon: Users },
    { href: "/nutricion",     label: "Nutrición",     icon: Apple },
    { href: "/check-in",      label: "Check-in",      icon: QrCode },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
  trainer: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/personas",      label: "Personas",      icon: Users },
    { href: "/nutricion",     label: "Nutrición",     icon: Apple },
    { href: "/check-in",      label: "Check-in",      icon: QrCode },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
  member: [
    { href: "/dashboard",     label: "Inicio",        icon: LayoutDashboard },
    { href: "/entrenamiento", label: "Mi rutina",     icon: Dumbbell },
    { href: "/nutricion",     label: "Nutrición",     icon: Apple },
    { href: "/check-in",      label: "Check-in",      icon: QrCode },
    { href: "/profile",       label: "Perfil",        icon: User },
  ],
}

export default function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const items = ITEMS_BY_ROLE[role] ?? ITEMS_BY_ROLE.member

  return (
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
      </div>
    </nav>
  )
}
