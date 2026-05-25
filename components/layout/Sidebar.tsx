"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"
import {
  LayoutDashboard,
  Users,
  QrCode,
  User,
  LogOut,
  TrendingUp,
  Trophy,
  Settings,
  Dumbbell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import NotificationBell from "@/components/notifications/NotificationBell"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import type { Profile } from "@/types"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/personas", label: "Personas", icon: Users, adminOnly: true },
  { href: "/entrenamiento", label: "Entrenamiento", icon: Dumbbell },
  { href: "/progress", label: "Progreso", icon: TrendingUp, memberOnly: true },
  { href: "/achievements", label: "Logros", icon: Trophy, adminOnly: true },
  { href: "/check-in", label: "Check-in", icon: QrCode },
  { href: "/admin", label: "Administración", icon: Settings, adminOnly: true },
  { href: "/profile", label: "Perfil", icon: User },
]

interface SidebarProps {
  profile: Profile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const role = profile?.role ?? "member"
  const isAdminOrTrainer = role === "admin" || role === "trainer"

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdminOrTrainer) return false
    if ((item as { memberOnly?: boolean }).memberOnly && role !== "member") return false
    return true
  })

  return (
    <aside className="hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800/60 dark:bg-zinc-950 md:flex">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
        <GymFlowLogo size={20} textSize="text-lg" />
        <div className="flex items-center gap-1">
          <AnimatedThemeToggler />
          <NotificationBell userId={profile?.id ?? ""} />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 font-heading text-sm tracking-wide transition-colors",
                isActive
                  ? "bg-brand-700/20 text-brand-500"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {profile?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs capitalize text-zinc-500">
              {profile?.role ?? "member"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-50">¿Cerrar sesión?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {signingOut ? "Saliendo…" : "Sí, cerrar sesión"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
