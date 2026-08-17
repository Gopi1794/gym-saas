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
  BarChart2,
  Apple,
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import NotificationBell from "@/components/notifications/NotificationBell"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import type { Profile } from "@/types"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/personas", label: "Personas", icon: Users, staffOnly: true },
  { href: "/entrenamiento", label: "Entrenamiento", icon: Dumbbell },
  { href: "/nutricion", label: "Nutrición", icon: Apple },
  { href: "/productos", label: "Productos", icon: ShoppingBag, staffOnly: true },
  { href: "/progress", label: "Progreso", icon: TrendingUp, memberOnly: true },
  { href: "/achievements", label: "Logros", icon: Trophy, staffOnly: true },
  { href: "/check-in", label: "Check-in", icon: QrCode },
  { href: "/reports", label: "Reportes", icon: BarChart2, adminOnly: true },
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

  // Default false para que coincida con el render del server (SSR no conoce
  // localStorage) — se sincroniza recién en el efecto, después de montar, para
  // no meter un mismatch de hidratación. Implica un flash breve si el usuario
  // lo tenía colapsado; es el mismo trade-off que usa shadcn/ui con su cookie.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("gymflow-sidebar-collapsed")
    if (saved === "1") setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("gymflow-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  const role = profile?.role ?? "member"
  const isAdminOrTrainer = role === "admin" || role === "trainer"

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if ((item as { adminOnly?: boolean }).adminOnly && role !== "admin") return false
    if ((item as { staffOnly?: boolean }).staffOnly && !isAdminOrTrainer) return false
    if ((item as { memberOnly?: boolean }).memberOnly && role !== "member") return false
    return true
  })

  return (
    <aside
      className={cn(
        "hidden flex-col rounded-[25px] border border-zinc-200 bg-white m-3 shadow-sm transition-[width] duration-200 ease-[var(--ease-in-out)] motion-reduce:transition-none dark:border-zinc-800/60 dark:bg-zinc-950 md:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 border-b border-zinc-200 py-3 dark:border-zinc-800">
          <button
            onClick={toggleCollapsed}
            aria-label="Expandir menú"
            title="Expandir menú"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:shadow-black/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
          <NotificationBell userId={profile?.id ?? ""} />
        </div>
      ) : (
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
          <GymFlowLogo size={20} textSize="text-lg" />
          <div className="flex items-center gap-1">
            <AnimatedThemeToggler />
            <NotificationBell userId={profile?.id ?? ""} />
            <button
              onClick={toggleCollapsed}
              aria-label="Colapsar menú"
              title="Colapsar menú"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:shadow-black/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg py-2.5 font-heading text-sm tracking-wide transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                isActive
                  ? "bg-brand-700/20 text-brand-500"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 transition-transform duration-150 ease-[var(--ease-out)] group-hover:scale-110" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {collapsed && (
        <div className="flex justify-center py-2">
          <GymFlowLogo size={18} iconOnly />
        </div>
      )}

      {/* User */}
      <div className={cn("border-t border-zinc-200 dark:border-zinc-800", collapsed ? "p-2" : "p-4")}>
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed ? "mb-2 flex-col" : "mb-3"
          )}
          title={collapsed ? `${profile?.full_name ?? "User"} · ${profile?.role ?? "member"}` : undefined}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-xs capitalize text-zinc-500">
                {profile?.role ?? "member"}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Cerrar sesión"}
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
