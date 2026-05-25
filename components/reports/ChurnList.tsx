"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertTriangle } from "lucide-react"

interface ChurnedMember {
  id: string
  full_name: string | null
  avatar_url: string | null
  membership_type: string | null
  membership_expires_at: string
}

interface Props {
  members: ChurnedMember[]
}

const WINDOWS = [
  { label: "30 días", days: 30 },
  { label: "60 días", days: 60 },
  { label: "90 días", days: 90 },
]

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default function ChurnList({ members }: Props) {
  const [window, setWindow] = useState(30)

  const cutoff = Date.now() - window * 86_400_000
  const filtered = members.filter(m => new Date(m.membership_expires_at).getTime() >= cutoff)

  return (
    <div className="space-y-3">
      {/* Window selector */}
      <div className="flex gap-2">
        {WINDOWS.map(w => (
          <button
            key={w.days}
            onClick={() => setWindow(w.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              window === w.days
                ? "bg-brand-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {filtered.length} {filtered.length === 1 ? "socio" : "socios"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">Sin churn en los últimos {window} días.</p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map(m => {
            const ago = daysAgo(m.membership_expires_at)
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{m.full_name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.full_name ?? "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.membership_type ?? "basic"}</p>
                </div>
                <span className="text-xs text-red-500 dark:text-red-400 shrink-0">
                  hace {ago}d
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
