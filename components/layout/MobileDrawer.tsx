"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Menu, X, LogOut, LayoutDashboard, Users, QrCode,
  User, TrendingUp, Trophy, Settings, Dumbbell,
} from "lucide-react"
import NotificationBell from "@/components/notifications/NotificationBell"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { cn, getInitials } from "@/lib/utils"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { Profile } from "@/types"

const NAV_ITEMS = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/personas",      label: "Personas",      icon: Users,         adminOnly: true },
  { href: "/entrenamiento", label: "Entrenamiento", icon: Dumbbell },
  { href: "/progress",      label: "Progreso",      icon: TrendingUp,    memberOnly: true },
  { href: "/achievements",  label: "Logros",        icon: Trophy,        adminOnly: true },
  { href: "/check-in",      label: "Check-in",      icon: QrCode },
  { href: "/admin",         label: "Administración",icon: Settings,      adminOnly: true },
  { href: "/profile",       label: "Perfil",        icon: User },
]

interface MobileDrawerProps {
  profile: Profile | null
}

export default function MobileDrawer({ profile }: MobileDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  function openDrawer() {
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
  }

  function closeDrawer() {
    setOpen(false)
    setTimeout(() => setMounted(false), 300)
  }

  const role = profile?.role ?? "member"
  const isAdminOrTrainer = role === "admin" || role === "trainer"

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdminOrTrainer) return false
    if ((item as { memberOnly?: boolean }).memberOnly && role !== "member") return false
    return true
  })

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/80 md:hidden">
        <GymFlowLogo size={18} textSize="text-base" />
        <div className="flex items-center gap-1">
          <AnimatedThemeToggler />
          <NotificationBell userId={profile?.id ?? ""} />
          <button
            onClick={openDrawer}
            aria-label="Abrir menú"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mounted && (
        <>
          <div
            onClick={closeDrawer}
            className={cn(
              "fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 md:hidden",
              open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
          />

          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-200 bg-white transition-transform duration-300 ease-in-out dark:border-zinc-800/60 dark:bg-zinc-950 md:hidden",
              open ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
              <GymFlowLogo size={18} textSize="text-base" />
              <button
                onClick={closeDrawer}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDrawer}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-700/20 text-brand-500"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </nav>

            <div className="border-t border-zinc-200 p-4 space-y-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {profile?.full_name ?? "User"}
                  </p>
                  <p className="truncate text-xs capitalize text-zinc-500">
                    {profile?.role ?? "member"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { closeDrawer(); setConfirmOpen(true) }}
                className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

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
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 cursor-pointer"
            >
              {signingOut ? "Saliendo…" : "Sí, cerrar sesión"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
