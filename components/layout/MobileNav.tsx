"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, QrCode, BookOpen,
  User, LogOut, ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface MobileNavProps {
  role: string
}

export default function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isTrainer = role === "admin" || role === "trainer"

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const items = [
    { href: "/dashboard",  label: "Home",      icon: LayoutDashboard },
    { href: "/members",    label: "Miembros",   icon: Users,         hidden: !isTrainer },
    { href: "/planes",     label: "Planes",     icon: ClipboardList, hidden: !isTrainer },
    { href: "/check-in",   label: "Check-in",   icon: QrCode },
    { href: "/exercises",  label: "Ejercicios", icon: BookOpen },
    { href: "/profile",    label: "Perfil",     icon: User },
  ].filter((i) => !i.hidden)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md md:hidden">
      <div className="flex">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-brand-500" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-brand-500")} />
              {item.label}
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-zinc-500 transition-colors hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Salir
        </button>
      </div>
    </nav>
  )
}
