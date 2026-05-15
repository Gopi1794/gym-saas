import Link from "next/link"
import { QrCode, UserPlus, BookOpen, BarChart3 } from "lucide-react"
import type { MemberRole } from "@/types"

const ADMIN_ACTIONS = [
  { href: "/check-in", label: "Escanear QR", desc: "Check-in de miembros", icon: QrCode },
  { href: "/members", label: "Agregar Miembro", desc: "Registrar nuevo miembro", icon: UserPlus },
  { href: "/exercises", label: "Ejercicios", desc: "Gestionar biblioteca", icon: BookOpen },
  { href: "/dashboard", label: "Analíticas", desc: "Ver reportes detallados", icon: BarChart3 },
]

const MEMBER_ACTIONS = [
  { href: "/check-in", label: "Mi QR", desc: "Mostrar para entrar", icon: QrCode },
  { href: "/exercises", label: "Ejercicios", desc: "Ver biblioteca", icon: BookOpen },
]

export default function QuickActions({ role }: { role: MemberRole }) {
  const actions = role === "member" ? MEMBER_ACTIONS : ADMIN_ACTIONS

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-md">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="font-semibold text-zinc-50">Acciones Rápidas</h2>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/5">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="flex flex-col items-center gap-3 bg-zinc-900/60 p-5 text-center transition-colors hover:bg-brand-700/10"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700/15">
              <action.icon className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{action.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
