"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatDate, getInitials, isMembershipActive } from "@/lib/utils"
import { Search, ChevronRight } from "lucide-react"
import type { Profile } from "@/types"

const MEMBERSHIP_COLORS = {
  vip: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  premium: "border-brand-700/30 bg-brand-700/10 text-brand-500",
  basic: "border-zinc-600/30 bg-zinc-800 text-zinc-400",
}

type MemberPlan = { id: string; name: string; assigned_to: string | null }

interface MemberTableProps {
  members: Profile[]
  plans?: MemberPlan[]
}

export default function MemberTable({ members, plans = [] }: MemberTableProps) {
  const [query, setQuery] = useState("")
  const router = useRouter()

  const filtered = members.filter((m) =>
    m.full_name?.toLowerCase().includes(query.toLowerCase())
  )

  function getPlan(memberId: string) {
    return plans.find((p) => p.assigned_to === memberId) ?? null
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="pl-9"
          placeholder="Buscar miembro…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead>Miembro</TableHead>
              <TableHead>Membresía</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Plan asignado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-zinc-500">
                  {query ? "No hay miembros que coincidan" : "No hay miembros todavía"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => {
                const active = isMembershipActive(member.membership_expires_at)
                const membershipType = member.membership_type ?? "basic"
                const plan = getPlan(member.id)
                return (
                  <TableRow
                    key={member.id}
                    className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => router.push(`/members/${member.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-zinc-50">
                          {member.full_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={MEMBERSHIP_COLORS[membershipType as keyof typeof MEMBERSHIP_COLORS] ?? MEMBERSHIP_COLORS.basic}
                        variant="outline"
                      >
                        {membershipType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {member.membership_expires_at
                        ? formatDate(member.membership_expires_at)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {plan ? (
                        <span className="text-sm text-brand-500 font-medium truncate max-w-[160px] block">
                          {plan.name}
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-600">Sin plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "success" : "secondary"}>
                        {active ? "Activo" : "Vencido"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
