import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"

interface CheckInRow {
  id: string
  checked_in_at: string
  method: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
    membership_type: string | null
  } | null
}

const BADGE: Record<string, { label: string; className: string }> = {
  vip:     { label: "VIP",     className: "bg-amber-500/15 text-amber-400" },
  premium: { label: "Premium", className: "bg-brand-700/15 text-brand-500" },
  basic:   { label: "Básico",  className: "bg-zinc-800 text-zinc-500" },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export default function RecentCheckIns({ checkIns }: { checkIns: CheckInRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/60 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Asistencias Recientes</h2>
        <Link href="/check-in" className="text-xs font-medium text-brand-500 hover:text-brand-400">
          Ver todo
        </Link>
      </div>

      {checkIns.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">Sin check-ins hoy todavía</p>
      ) : (
        <ul>
          {checkIns.map((ci, i) => {
            const m = ci.profiles?.membership_type ?? "basic"
            const badge = BADGE[m] ?? BADGE.basic
            const isLast = i === checkIns.length - 1
            return (
              <li
                key={ci.id}
                className={`flex items-center gap-3 px-5 py-3 ${!isLast ? "border-b border-white/5" : ""}`}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={ci.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-brand-900/40 text-xs text-brand-400">
                    {getInitials(ci.profiles?.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {ci.profiles?.full_name ?? "Desconocido"}
                  </p>
                  <p className="text-xs text-zinc-500">{formatTime(ci.checked_in_at)}</p>
                </div>

                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
