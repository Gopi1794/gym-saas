"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  QrCode,
  BookOpen,
  User,
  LogOut,
  ClipboardList,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Profile } from "@/types"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Miembros", icon: Users, adminOnly: true },
  { href: "/planes", label: "Planes", icon: ClipboardList, trainerOnly: true },
  { href: "/exercises", label: "Ejercicios", icon: BookOpen },
  { href: "/progress", label: "Progreso", icon: TrendingUp, memberOnly: true },
  { href: "/achievements", label: "Logros", icon: Trophy, adminOnly: true },
  { href: "/check-in", label: "Check-in", icon: QrCode },
  { href: "/profile", label: "Perfil", icon: User },
]

interface SidebarProps {
  profile: Profile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const role = profile?.role ?? "member"
  const isAdminOrTrainer = role === "admin" || role === "trainer"

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdminOrTrainer) return false
    if (item.trainerOnly && !isAdminOrTrainer) return false
    if ((item as { memberOnly?: boolean }).memberOnly && role !== "member") return false
    return true
  })

  return (
    <aside className="hidden w-64 flex-col border-r border-zinc-800/60 bg-zinc-950/70 backdrop-blur-md md:flex">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <Image src="/logo-vector.png" alt="Flash Mega Gym" width={120} height={36} className="h-8 w-auto object-contain" priority />
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
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-50">
              {profile?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs capitalize text-zinc-500">
              {profile?.role ?? "member"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
