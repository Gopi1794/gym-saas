"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Users, LayoutTemplate, Search, LayoutGrid, List, ChevronRight } from "lucide-react"
import PlanCard from "./PlanCard"
import NewPlanButton from "./NewPlanButton"

type PlanDay = {
  id: string
  day_of_week: number
  workout_plan_exercises: { id: string }[]
}

type PlanRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  assigned_to: string | null
  level?: string | null
  workout_plan_days: PlanDay[]
}

type MemberRow = { id: string; full_name: string | null }

interface Props {
  trainerId: string
  memberPlans: PlanRow[]
  templates: PlanRow[]
  members: MemberRow[]
}

type Tab = "members" | "templates"
type ViewMode = "grid" | "list"

const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"]

const LEVEL_LABEL: Record<string, { label: string; cls: string }> = {
  beginner:     { label: "Principiante", cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Intermedio",   cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Avanzado",     cls: "bg-red-500/20 text-red-400" },
}

function Initials({ name }: { name: string | null }) {
  const letters = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700/30 text-xs font-bold text-brand-400 ring-1 ring-brand-700/40">
      {letters}
    </div>
  )
}

function PlanListRow({ plan, members, isTemplate }: { plan: PlanRow; members: MemberRow[]; isTemplate: boolean }) {
  const member = members.find((m) => m.id === plan.assigned_to)
  const activeDays = plan.workout_plan_days.filter((d) => d.workout_plan_exercises.length > 0)
  const totalExercises = plan.workout_plan_days.reduce((s, d) => s + d.workout_plan_exercises.length, 0)
  const level = plan.level ? LEVEL_LABEL[plan.level] : null
  const activeDaySet = new Set(activeDays.map((d) => d.day_of_week))

  return (
    <Link
      href={`/planes/${plan.id}`}
      className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition-all hover:border-zinc-700 hover:bg-zinc-800/60"
    >
      <Initials name={isTemplate ? plan.name : (member?.full_name ?? null)} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">{plan.name}</span>
          {level && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${level.cls}`}>
              {level.label}
            </span>
          )}
        </div>
        {!isTemplate && member && (
          <p className="mt-0.5 text-xs text-zinc-500 truncate">👤 {member.full_name ?? "Sin nombre"}</p>
        )}
      </div>

      {/* Day pills */}
      <div className="hidden sm:flex gap-1 shrink-0">
        {DAY_SHORT.map((d, i) => (
          <span
            key={i}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
              activeDaySet.has(i)
                ? "bg-brand-700/30 text-brand-400"
                : "bg-zinc-800 text-zinc-600"
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="shrink-0 text-right hidden sm:block">
        <p className="text-xs font-semibold text-zinc-300">{totalExercises}</p>
        <p className="text-[10px] text-zinc-600">ejercicios</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
    </Link>
  )
}

export default function TrainerPlanesView({ trainerId, memberPlans, templates, members }: Props) {
  const [tab, setTab] = useState<Tab>("members")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [search, setSearch] = useState("")

  const assignedIds = new Set(memberPlans.map((p) => p.assigned_to).filter(Boolean))
  const membersWithoutPlan = members.filter((m) => !assignedIds.has(m.id))

  const filteredMemberPlans = useMemo(() => {
    if (!search.trim()) return memberPlans
    const q = search.toLowerCase()
    return memberPlans.filter((plan) => {
      const memberName = members.find((m) => m.id === plan.assigned_to)?.full_name ?? ""
      return plan.name.toLowerCase().includes(q) || memberName.toLowerCase().includes(q)
    })
  }, [memberPlans, members, search])

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates
    return templates.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [templates, search])

  const activePlans = tab === "members" ? filteredMemberPlans : filteredTemplates
  const isEmpty = tab === "members" ? memberPlans.length === 0 : templates.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Planes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {tab === "members"
              ? "Planes personalizados para cada miembro"
              : "Plantillas reutilizables para armar planes rápido"}
          </p>
        </div>
        <NewPlanButton
          trainerId={trainerId}
          members={membersWithoutPlan}
          defaultMode={tab === "members" ? "member" : "template"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1">
        {(["members", "templates"] as Tab[]).map((t) => {
          const isActive = tab === t
          const count = t === "members" ? memberPlans.length : templates.length
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch("") }}
              className={[
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-brand-700/20 text-brand-400 shadow-sm ring-1 ring-brand-700/40"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {t === "members" ? <Users className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
              {t === "members" ? "Miembros" : "Plantillas"}
              {count > 0 && (
                <span className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive ? "bg-brand-700/40 text-brand-300" : "bg-zinc-800 text-zinc-500",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search + view toggle */}
      {!isEmpty && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "members"
                  ? "Buscar por miembro o nombre de plan…"
                  : "Buscar plantilla…"
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 py-2 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>
          {/* View toggle */}
          <div className="flex rounded-xl border border-zinc-700 bg-zinc-900/60 p-1 gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={[
                "rounded-lg p-1.5 transition-all",
                viewMode === "grid"
                  ? "bg-brand-700/20 text-brand-400"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={[
                "rounded-lg p-1.5 transition-all",
                viewMode === "list"
                  ? "bg-brand-700/20 text-brand-400"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
              title="Vista en lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 py-16 text-center">
          {tab === "members"
            ? <Users className="h-8 w-8 text-zinc-700" />
            : <LayoutTemplate className="h-8 w-8 text-zinc-700" />}
          <div>
            {tab === "members" ? (
              <>
                <p className="font-medium text-zinc-400">Ningún miembro tiene un plan todavía</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Usá <span className="text-zinc-400">"Nuevo plan"</span> para crear uno y asignarlo a un miembro
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-zinc-400">No hay plantillas todavía</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Las plantillas son rutinas base que podés reutilizar para crear planes más rápido
                </p>
              </>
            )}
          </div>
        </div>
      ) : activePlans.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          Ningún plan coincide con <span className="text-zinc-300">"{search}"</span>
        </p>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isTemplate={tab === "templates"}
              trainerId={trainerId}
              members={members}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {activePlans.map((plan) => (
            <PlanListRow
              key={plan.id}
              plan={plan}
              members={members}
              isTemplate={tab === "templates"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
