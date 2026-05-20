"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatDate, getInitials, isMembershipActive } from "@/lib/utils"
import { Search, ChevronRight, Users, X, Dumbbell } from "lucide-react"
import type { Profile } from "@/types"

const MEMBERSHIP_COLORS = {
  vip: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  premium: "border-brand-600/40 bg-brand-700/10 text-brand-400",
  basic: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
}

type MemberPlan = { id: string; name: string; assigned_to: string | null }
type StatusFilter = "all" | "active" | "expired"
type MembershipFilter = "all" | "basic" | "premium" | "vip"
type PlanFilter = "all" | "with" | "without"

interface MemberTableProps {
  members: Profile[]
  plans?: MemberPlan[]
}

function Pill<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
            value === o.value
              ? "bg-zinc-700 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function EmptyState({
  query, statusFilter, membershipFilter, planFilter, totalMembers,
}: {
  query: string
  statusFilter: StatusFilter
  membershipFilter: MembershipFilter
  planFilter: PlanFilter
  totalMembers: number
}) {
  if (totalMembers === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
          <Users className="h-6 w-6 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">Sin miembros todavía</p>
          <p className="mt-1 text-xs text-zinc-600">
            Compartí el link de invitación para que se unan al gym
          </p>
        </div>
      </div>
    )
  }

  const activeFilters = [
    query && `"${query}"`,
    statusFilter !== "all" && (statusFilter === "active" ? "activos" : "vencidos"),
    membershipFilter !== "all" && membershipFilter,
    planFilter !== "all" && (planFilter === "with" ? "con plan" : "sin plan"),
  ].filter(Boolean)

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
        <Search className="h-6 w-6 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-300">Sin resultados</p>
        <p className="mt-1 text-xs text-zinc-600">
          No hay miembros que coincidan con{" "}
          <span className="text-zinc-400">{activeFilters.join(", ")}</span>
        </p>
      </div>
    </div>
  )
}

export default function MemberTable({ members, plans = [] }: MemberTableProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("all")
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all")
  const router = useRouter()

  const filtersActive =
    query !== "" ||
    statusFilter !== "all" ||
    membershipFilter !== "all" ||
    planFilter !== "all"

  function clearFilters() {
    setQuery("")
    setStatusFilter("all")
    setMembershipFilter("all")
    setPlanFilter("all")
  }

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (query && !m.full_name?.toLowerCase().includes(query.toLowerCase())) return false
      const active = isMembershipActive(m.membership_expires_at)
      if (statusFilter === "active" && !active) return false
      if (statusFilter === "expired" && active) return false
      if (membershipFilter !== "all" && (m.membership_type ?? "basic") !== membershipFilter) return false
      const hasPlan = plans.some((p) => p.assigned_to === m.id)
      if (planFilter === "with" && !hasPlan) return false
      if (planFilter === "without" && hasPlan) return false
      return true
    })
  }, [members, plans, query, statusFilter, membershipFilter, planFilter])

  function getPlan(memberId: string) {
    return plans.find((p) => p.assigned_to === memberId) ?? null
  }

  return (
    <div className="space-y-4">
      {/* Search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            className="pl-9 bg-zinc-900 border-zinc-800 focus:border-zinc-600 placeholder:text-zinc-600"
            placeholder="Buscar por nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 shrink-0">Estado</span>
          <Pill<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "expired", label: "Vencidos" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 shrink-0">Membresía</span>
          <Pill<MembershipFilter>
            value={membershipFilter}
            onChange={setMembershipFilter}
            options={[
              { value: "all", label: "Todas" },
              { value: "basic", label: "Basic" },
              { value: "premium", label: "Premium" },
              { value: "vip", label: "VIP" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 shrink-0">Plan</span>
          <Pill<PlanFilter>
            value={planFilter}
            onChange={setPlanFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "with", label: "Con plan" },
              { value: "without", label: "Sin plan" },
            ]}
          />
        </div>

        {/* Result count */}
        {filtersActive && (
          <span className="ml-auto text-xs text-zinc-600">
            {filtered.length} de {members.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState
            query={query}
            statusFilter={statusFilter}
            membershipFilter={membershipFilter}
            planFilter={planFilter}
            totalMembers={members.length}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500 font-medium pl-5">Miembro</TableHead>
                <TableHead className="text-zinc-500 font-medium">Membresía</TableHead>
                <TableHead className="text-zinc-500 font-medium">Vence</TableHead>
                <TableHead className="text-zinc-500 font-medium">Plan</TableHead>
                <TableHead className="text-zinc-500 font-medium">Estado</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => {
                const active = isMembershipActive(member.membership_expires_at)
                const membershipType = (member.membership_type ?? "basic") as keyof typeof MEMBERSHIP_COLORS
                const plan = getPlan(member.id)

                return (
                  <TableRow
                    key={member.id}
                    className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors group"
                    onClick={() => router.push(`/members/${member.id}`)}
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs bg-zinc-800 text-zinc-400">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-zinc-100 group-hover:text-white transition-colors">
                          {member.full_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={MEMBERSHIP_COLORS[membershipType] ?? MEMBERSHIP_COLORS.basic}
                        variant="outline"
                      >
                        {membershipType}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-sm tabular-nums ${
                      !active && member.membership_expires_at ? "text-red-400" : "text-zinc-400"
                    }`}>
                      {member.membership_expires_at
                        ? formatDate(member.membership_expires_at)
                        : <span className="text-zinc-700">—</span>}
                    </TableCell>
                    <TableCell>
                      {plan ? (
                        <div className="flex items-center gap-1.5">
                          <Dumbbell className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                          <span className="text-sm text-zinc-300 truncate max-w-[160px]">
                            {plan.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-700">Sin plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "success" : "secondary"}>
                        {active ? "Activo" : "Vencido"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
