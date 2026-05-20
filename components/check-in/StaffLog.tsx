"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Users, Clock, LogOut, CalendarDays, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCalendar } from "@/components/ui/glass-calendar"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"

interface Trainer {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface StaffCheckIn {
  user_id: string
  checked_in_at: string
  checked_out_at: string | null
}

interface StaffLogProps {
  gymId: string
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

function duration(from: string, to: string | null): { label: string; minutes: number } {
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  const minutes = Math.floor((end - start) / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const label = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`
  return { label, minutes }
}

function initials(name: string | null) {
  if (!name) return "?"
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

const TARGET_MINUTES = 8 * 60

export default function StaffLog({ gymId }: StaffLogProps) {
  const [date, setDate] = useState(toDateStr(new Date()))
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [checkIns, setCheckIns] = useState<StaffCheckIn[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!gymId) return
    setLoading(true)

    async function fetchData() {
      const nextDay = toDateStr(new Date(new Date(date).getTime() + 86400000))
      const [{ data: trainerData }, { data: ciData }, { data: planData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").eq("gym_id", gymId).eq("role", "trainer"),
        supabase.from("check_ins").select("user_id, checked_in_at, checked_out_at").eq("gym_id", gymId).gte("checked_in_at", date).lt("checked_in_at", nextDay),
        supabase.from("workout_plans").select("created_by, assigned_to").eq("gym_id", gymId).not("assigned_to", "is", null).not("created_by", "is", null),
      ])

      const counts: Record<string, number> = {}
      const seen: Record<string, Set<string>> = {}
      for (const p of planData ?? []) {
        const tr = p.created_by as string
        const mb = p.assigned_to as string
        if (!seen[tr]) seen[tr] = new Set()
        seen[tr].add(mb)
        counts[tr] = seen[tr].size
      }

      setTrainers((trainerData ?? []) as Trainer[])
      setCheckIns((ciData ?? []) as StaffCheckIn[])
      setMemberCounts(counts)
      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, gymId])

  // Close calendar on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    if (calendarOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [calendarOpen])

  const isToday = date === toDateStr(new Date())
  const presentCount = checkIns.filter((c) => !c.checked_out_at && trainers.some((t) => t.id === c.user_id)).length
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0)

  const displayDate = (() => {
    if (isToday) return "Hoy"
    try {
      return format(parseISO(date), "d 'de' MMMM", { locale: es })
    } catch {
      return date
    }
  })()

  const stats = [
    { label: "Presentes hoy", value: presentCount, color: "text-emerald-400" },
    { label: "Trainers", value: trainers.length, color: "text-zinc-100" },
    { label: "Socios gestionados", value: totalMembers, color: "text-brand-400" },
  ]

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3">
            <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{loading ? "—" : s.value}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Date picker trigger */}
      <div className="relative" ref={calendarRef}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalendarOpen((o) => !o)}
            aria-label="Abrir selector de fecha"
            aria-expanded={calendarOpen}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors",
              calendarOpen
                ? "border-brand-700/60 bg-brand-900/20 text-brand-400"
                : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="capitalize">{displayDate}</span>
          </button>

          {!isToday && (
            <button
              onClick={() => { setDate(toDateStr(new Date())); setCalendarOpen(false) }}
              className="h-10 rounded-xl border border-white/10 px-4 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Hoy
            </button>
          )}
        </div>

        {/* Calendar dropdown */}
        <AnimatePresence>
          {calendarOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute left-0 top-12 z-50 w-72"
            >
              <GlassCalendar
                selectedDate={parseISO(date)}
                maxDate={new Date()}
                onDateSelect={(d) => {
                  setDate(toDateStr(d))
                  setCalendarOpen(false)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trainer list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-skeleton-loading rounded-xl" />
          ))}
        </div>
      ) : trainers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <UserCog className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">No hay trainers registrados en el gym todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trainers.map((trainer) => {
            const ci = checkIns.find((c) => c.user_id === trainer.id)
            const members = memberCounts[trainer.id] ?? 0
            const isPresent = !!ci && !ci.checked_out_at
            const isRetired = !!ci && !!ci.checked_out_at
            const dur = ci ? duration(ci.checked_in_at, ci.checked_out_at) : null
            const barPct = dur ? Math.min((dur.minutes / TARGET_MINUTES) * 100, 100) : 0

            return (
              <div
                key={trainer.id}
                className={cn(
                  "rounded-xl border px-4 py-4 transition-colors",
                  isPresent
                    ? "border-emerald-500/20 bg-emerald-950/15"
                    : isRetired
                      ? "border-white/10 bg-zinc-900/60"
                      : "border-white/5 bg-zinc-900/30",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  {trainer.avatar_url ? (
                    <img
                      src={trainer.avatar_url}
                      alt={trainer.full_name ?? "Trainer"}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700/20 text-sm font-bold text-brand-400"
                    >
                      {initials(trainer.full_name)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Row 1: name + status + members */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {trainer.full_name ?? "Sin nombre"}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-zinc-400">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          <span aria-label={`${members} socios a cargo`}>{members}</span>
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            isPresent
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isRetired
                                ? "bg-zinc-700/40 text-zinc-400"
                                : "bg-zinc-800/60 text-zinc-500",
                          )}
                        >
                          {isPresent ? "Presente" : isRetired ? "Retirado" : "Ausente"}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: timeline */}
                    {ci ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {fmt(ci.checked_in_at)}
                            {ci.checked_out_at && (
                              <>
                                <span className="mx-1 text-zinc-600" aria-hidden="true">→</span>
                                <LogOut className="h-3 w-3" aria-hidden="true" />
                                {fmt(ci.checked_out_at)}
                              </>
                            )}
                          </span>
                          <span className={cn("font-medium tabular-nums", isPresent ? "text-emerald-400" : "text-zinc-400")}>
                            {dur?.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100} aria-label="Horas trabajadas">
                          <motion.div
                            className={cn("h-full rounded-full", isPresent ? "bg-emerald-500" : "bg-zinc-500")}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <p className="text-right text-xs text-zinc-500">ref. 8h</p>
                      </div>
                    ) : (
                      <div className="h-1.5 w-full rounded-full bg-zinc-800/50" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
