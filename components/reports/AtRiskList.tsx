"use client"

import { AlertTriangle } from "lucide-react"
import { ProfileAvatar } from "@/components/ui/profile-avatar"


export interface AtRiskMember {
  id: string
  full_name: string | null
  avatar_url: string | null
  daysAgo: number | null
}

interface Props {
  members: AtRiskMember[]
}

export default function AtRiskList({ members }: Props) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-emerald-500 text-center py-6 font-medium">
        ✓ Todos los socios activos asistieron en los últimos 14 días
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <ProfileAvatar src={m.avatar_url} name={m.full_name} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{m.full_name ?? "Sin nombre"}</p>
            <p className="text-xs text-muted-foreground">
              {m.daysAgo === null ? "Nunca asistió" : `Última visita hace ${m.daysAgo} días`}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${
            m.daysAgo === null || m.daysAgo >= 30
              ? "bg-red-500/15 text-red-500"
              : "bg-amber-500/15 text-amber-500"
          }`}>
            <AlertTriangle className="h-3 w-3" />
            {m.daysAgo === null || m.daysAgo >= 30 ? "Alto riesgo" : "En riesgo"}
          </div>
        </div>
      ))}
    </div>
  )
}
