"use client"

import { useState, useRef, useEffect, useCallback, useMemo, type ElementType } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Search, Moon, Copy, X, Flame, Dumbbell, Wind, RefreshCw, ChevronDown, Info, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const DAY_FULL  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

type Exercise = {
  id: string; name: string; category: string
  image_url: string | null; muscle_groups: string[]
  is_timed: boolean
}

type SetConfig = {
  id: string
  set_number: number
  reps: number | null
  reps_max: number | null
  percent_1rm: number | null
  duration_seconds: number | null
  notes: string | null
}

type Phase = "warmup" | "main" | "cooldown"

type PlanExercise = {
  id: string; sets: number; reps: number; reps_max: number | null
  rest_seconds: number; order_index: number; notes: string | null
  duration_seconds: number | null; phase: Phase
  set_configs: SetConfig[]
  exercises: Exercise
}

type PhaseConfig = { key: Phase; label: string; Icon: ElementType; color: string }

const PHASES: PhaseConfig[] = [
  { key: "warmup",   label: "Precalentamiento", Icon: Flame,    color: "text-orange-400" },
  { key: "main",     label: "Principal",         Icon: Dumbbell, color: "text-brand-500"  },
  { key: "cooldown", label: "Estiramiento",       Icon: Wind,     color: "text-sky-400"    },
]

const PHASE_CARD: Record<Phase, string> = {
  warmup:   "bg-orange-50 border-orange-200/60 dark:bg-yellow-950/40 dark:border-yellow-900/20",
  main:     "bg-red-50 border-red-200/60 dark:bg-red-950/40 dark:border-red-900/20",
  cooldown: "bg-sky-50 border-sky-200/60 dark:bg-blue-950/40 dark:border-blue-900/20",
}

type MuscleZone = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core"
type MuscleStatus = "low" | "slightly-low" | "optimal" | "high"

const MUSCLE_META: Record<string, { zone: MuscleZone; range: [number, number] }> = {
  pecho: { zone: "chest", range: [10, 20] },
  pectoral: { zone: "chest", range: [10, 20] },
  pectorales: { zone: "chest", range: [10, 20] },
  espalda: { zone: "back", range: [10, 20] },
  dorsal: { zone: "back", range: [10, 20] },
  dorsales: { zone: "back", range: [10, 20] },
  hombros: { zone: "shoulders", range: [10, 18] },
  deltoides: { zone: "shoulders", range: [10, 18] },
  biceps: { zone: "biceps", range: [8, 16] },
  bíceps: { zone: "biceps", range: [8, 16] },
  triceps: { zone: "triceps", range: [8, 16] },
  tríceps: { zone: "triceps", range: [8, 16] },
  cuadriceps: { zone: "quads", range: [10, 20] },
  cuádriceps: { zone: "quads", range: [10, 20] },
  isquiotibiales: { zone: "hamstrings", range: [8, 16] },
  femorales: { zone: "hamstrings", range: [8, 16] },
  gluteos: { zone: "glutes", range: [8, 16] },
  glúteos: { zone: "glutes", range: [8, 16] },
  pantorrillas: { zone: "calves", range: [8, 16] },
  gemelos: { zone: "calves", range: [8, 16] },
  abdomen: { zone: "core", range: [6, 14] },
  abdominales: { zone: "core", range: [6, 14] },
  core: { zone: "core", range: [6, 14] },
}

function normalizeMuscle(muscle: string) {
  return muscle.trim().toLowerCase()
}

function getMuscleMeta(muscle: string) {
  return MUSCLE_META[normalizeMuscle(muscle)] ?? { zone: "core" as MuscleZone, range: [8, 16] as [number, number] }
}

function getMuscleStatus(sets: number, [min, max]: [number, number]): MuscleStatus {
  if (sets > max) return "high"
  if (sets >= min) return "optimal"
  if (sets >= Math.max(1, Math.round(min * 0.75))) return "slightly-low"
  return "low"
}

function statusLabel(status: MuscleStatus) {
  return {
    low: "BAJO",
    "slightly-low": "LIGERAMENTE BAJO",
    optimal: "ÓPTIMO",
    high: "ALTO",
  }[status]
}

function statusClass(status: MuscleStatus) {
  return {
    low: "bg-red-500/10 text-red-400",
    "slightly-low": "bg-amber-500/10 text-amber-400",
    optimal: "bg-emerald-500/10 text-emerald-400",
    high: "bg-orange-500/10 text-orange-400",
  }[status]
}

function MuscleSilhouette({ zone, className }: { zone: MuscleZone; className?: string }) {
  const active = (target: MuscleZone | MuscleZone[]) => {
    const targets = Array.isArray(target) ? target : [target]
    return targets.includes(zone)
  }

  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500/60">
        <circle cx="32" cy="10" r="6" fill="currentColor" className="text-zinc-500/45" />
        <path d="M25 20h14l5 23-4 26H24l-4-26 5-23Z" fill="currentColor" className="text-zinc-500/35" />
        <path d="M24 25 12 37M40 25l12 12M24 69l-7 20M40 69l7 20" strokeWidth="7" />
      </g>
      <g className="text-red-500 drop-shadow-[0_0_7px_rgba(239,68,68,0.7)]" fill="currentColor" opacity="0.95">
        {active("shoulders") && (
          <>
            <circle cx="22" cy="25" r="5" />
            <circle cx="42" cy="25" r="5" />
          </>
        )}
        {active("chest") && (
          <>
            <path d="M25 28c4-4 10-4 14 0l-2 11H27l-2-11Z" />
            <path d="M32 28v12" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
          </>
        )}
        {active("back") && <path d="M23 25c5 4 13 4 18 0l2 20c-7 5-15 5-22 0l2-20Z" />}
        {active("biceps") && (
          <>
            <path d="M15 36c5 2 7 9 4 15l-5-2c2-5 1-9-3-12l4-1Z" />
            <path d="M49 36c-5 2-7 9-4 15l5-2c-2-5-1-9 3-12l-4-1Z" />
          </>
        )}
        {active("triceps") && (
          <>
            <path d="M18 42c4 4 4 11 1 17l-5-2c2-5 2-10 0-14l4-1Z" />
            <path d="M46 42c-4 4-4 11-1 17l5-2c-2-5-2-10 0-14l-4-1Z" />
          </>
        )}
        {active("core") && <path d="M27 42h10l2 16H25l2-16Z" />}
        {active("glutes") && (
          <>
            <path d="M24 60c4-3 7-3 8 2v7h-8v-9Z" />
            <path d="M40 60c-4-3-7-3-8 2v7h8v-9Z" />
          </>
        )}
        {active("quads") && (
          <>
            <path d="M24 70h8l-2 19h-7l1-19Z" />
            <path d="M40 70h-8l2 19h7l-1-19Z" />
          </>
        )}
        {active("hamstrings") && (
          <>
            <path d="M23 69h7l-1 19h-7l1-19Z" />
            <path d="M41 69h-7l1 19h7l-1-19Z" />
          </>
        )}
        {active("calves") && (
          <>
            <path d="M22 82h7l-1 11h-8l2-11Z" />
            <path d="M42 82h-7l1 11h8l-2-11Z" />
          </>
        )}
      </g>
    </svg>
  )
}

type DayData = {
  id: string | null   // null = day not yet created in DB
  exercises: PlanExercise[]
}

type Plan = {
  id: string; name: string; description: string | null
  is_template: boolean; created_by: string | null
}

type RawDay = {
  id: string; day_of_week: number; name: string | null
  workout_plan_exercises: PlanExercise[]
}

interface PlanEditorProps {
  plan: Plan
  initialDays: RawDay[]
  allExercises: Exercise[]
  trainerId: string
  readOnly?: boolean
}

function buildInitialDays(rawDays: RawDay[]): Record<number, DayData> {
  const map: Record<number, DayData> = {}
  for (let i = 0; i < 7; i++) {
    map[i] = { id: null, exercises: [] }
  }
  for (const d of rawDays) {
    if (!map[d.day_of_week].id) {
      // First row for this dow: use its id and start collecting exercises
      map[d.day_of_week] = { id: d.id, exercises: [...d.workout_plan_exercises] }
    } else {
      // Duplicate row: merge exercises under the first row's id
      map[d.day_of_week].exercises.push(...d.workout_plan_exercises)
    }
  }
  // Sort each day's exercises by order_index
  for (const dow in map) {
    map[dow].exercises.sort((a, b) => a.order_index - b.order_index)
  }
  return map
}

export default function PlanEditor({ plan, initialDays, allExercises, readOnly = false }: PlanEditorProps) {
  const [days, setDays] = useState<Record<number, DayData>>(() => buildInitialDays(initialDays))
  const todayDow = (new Date().getDay() + 6) % 7
  const [selectedDay, setSelectedDay] = useState(todayDow)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [exercises, setExercises] = useState<Exercise[]>(allExercises)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<Phase>>(new Set())

  function togglePhase(phase: Phase) {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      next.has(phase) ? next.delete(phase) : next.add(phase)
      return next
    })
  }
  const [saving, setSaving] = useState<string | null>(null)
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const copyMenuRef = useRef<HTMLDivElement>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pickerPhase, setPickerPhase] = useState<Phase>("main")

  const muscleVolume = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of Object.values(days)) {
      for (const ex of day.exercises) {
        for (const m of ex.exercises.muscle_groups ?? []) {
          const key = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()
          counts.set(key, (counts.get(key) ?? 0) + ex.sets)
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [days])
  const muscleVolumeStats = useMemo(() => {
    return muscleVolume.map(([muscle, sets]) => {
      const meta = getMuscleMeta(muscle)
      const status = getMuscleStatus(sets, meta.range)
      return { muscle, sets, ...meta, status }
    })
  }, [muscleVolume])
  const totalMuscleSets = muscleVolumeStats.reduce((sum, item) => sum + item.sets, 0)
  const recommendedMuscles = muscleVolumeStats
    .filter((item) => item.status === "low" || item.status === "slightly-low")
    .slice(0, 4)
    .map((item) => item.muscle.toLowerCase())

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setCopyMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  const supabase = createClient()
  const router = useRouter()

  const refreshExercises = useCallback(async () => {
    setRefreshing(true)
    const { data } = await supabase
      .from("exercises")
      .select("id, name, category, image_url, muscle_groups, is_timed")
      .order("name")
    if (data) setExercises(data as Exercise[])
    setRefreshing(false)
  }, [supabase])

  const currentDay = days[selectedDay]
  const inPlanIds = new Set(currentDay.exercises.map((pe) => pe.exercises.id))
  const filtered = exercises.filter(
    (ex) => !inPlanIds.has(ex.id) && ex.name.toLowerCase().includes(search.toLowerCase())
  )

  async function ensureDayExists(dow: number): Promise<string> {
    if (days[dow].id) return days[dow].id!
    // Check DB first to avoid creating duplicates
    const { data: existing } = await supabase
      .from("workout_plan_days")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("day_of_week", dow)
      .order("id")
      .limit(1) as unknown as { data: { id: string }[] | null }
    if (existing?.[0]) {
      setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], id: existing[0].id } }))
      return existing[0].id
    }
    const { data, error } = await supabase
      .from("workout_plan_days")
      .insert({ plan_id: plan.id, day_of_week: dow })
      .select("id")
      .single() as unknown as { data: { id: string } | null; error: unknown }
    if (error || !data) throw error
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], id: data.id } }))
    return data.id
  }

  async function addExercise(exercise: Exercise) {
    setPickerOpen(false)
    setSearch("")
    const phase = pickerPhase
    try {
      const dayId = await ensureDayExists(selectedDay)
      const exs = days[selectedDay].exercises
      const order = exs.length > 0 ? Math.max(...exs.map((e) => e.order_index)) + 1 : 0

      const { data, error } = await supabase
        .from("workout_plan_exercises")
        .insert({ day_id: dayId, exercise_id: exercise.id, sets: 3, reps: (exercise.is_timed || exercise.category === "cardio") ? undefined : 10, reps_max: null, rest_seconds: 60, order_index: order, duration_seconds: (exercise.is_timed || exercise.category === "cardio") ? 30 : null, phase })
        .select("id, sets, reps, reps_max, rest_seconds, order_index, notes, duration_seconds, phase")
        .single() as unknown as { data: Omit<PlanExercise, "exercises"> | null; error: unknown }

      console.error("[addExercise] dayId:", dayId, "error:", error, "data:", data)

      if (!error && data) {
        const defaultConfigs = Array.from({ length: 3 }, (_, i) => ({
          exercise_id: data.id,
          set_number: i + 1,
          reps: (exercise.is_timed || exercise.category === "cardio") ? null : 10,
          duration_seconds: (exercise.is_timed || exercise.category === "cardio") ? 30 : null,
        }))
        const { data: configs } = await (supabase as never as { from: (t: string) => { insert: (v: object[]) => { select: (s: string) => Promise<{ data: SetConfig[] | null }> } } })
          .from("workout_plan_set_configs")
          .insert(defaultConfigs)
          .select("id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes")

        setDays((prev) => ({
          ...prev,
          [selectedDay]: {
            ...prev[selectedDay],
            exercises: [...prev[selectedDay].exercises, { ...data, set_configs: configs ?? [], exercises: exercise }],
          },
        }))
      }
    } catch (err) {
      console.error("[addExercise] caught:", err)
    }
  }

  async function removeExercise(peId: string) {
    await supabase.from("workout_plan_exercises").delete().eq("id", peId)
    setDays((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        exercises: prev[selectedDay].exercises.filter((pe) => pe.id !== peId),
      },
    }))
  }

  async function copyFromDay(fromDow: number) {
    setCopyMenuOpen(false)
    setCopying(true)
    try {
      const sourceExercises = days[fromDow].exercises
      if (sourceExercises.length === 0) return
      const targetDayId = await ensureDayExists(selectedDay)
      const targetExs = days[selectedDay].exercises
      const startOrder = targetExs.length > 0 ? Math.max(...targetExs.map((e) => e.order_index)) + 1 : 0

      const inserts = sourceExercises.map((pe, i) => ({
        day_id: targetDayId,
        exercise_id: pe.exercises.id,
        sets: pe.sets,
        reps: pe.reps,
        reps_max: pe.reps_max,
        rest_seconds: pe.rest_seconds,
        duration_seconds: pe.duration_seconds,
        order_index: startOrder + i,
      }))

      const { data, error } = (await supabase
        .from("workout_plan_exercises")
        .insert(inserts)
        .select("id, sets, reps, reps_max, rest_seconds, order_index, notes, duration_seconds, exercise_id")
      ) as unknown as { data: (Omit<PlanExercise, "exercises"> & { exercise_id: string })[] | null; error: unknown }

      if (!error && data) {
        // Copy set_configs for each new exercise
        const newEntries = await Promise.all(data.map(async (row, i) => {
          const srcConfigs = sourceExercises[i].set_configs ?? []
          if (srcConfigs.length === 0) return { ...row, set_configs: [], exercises: sourceExercises[i].exercises }
          const { data: newConfigs } = await (supabase as never as { from: (t: string) => { insert: (v: object[]) => { select: (s: string) => Promise<{ data: SetConfig[] | null }> } } })
            .from("workout_plan_set_configs")
            .insert(srcConfigs.map((c) => ({ exercise_id: row.id, set_number: c.set_number, reps: c.reps, reps_max: c.reps_max, percent_1rm: c.percent_1rm, duration_seconds: c.duration_seconds, notes: c.notes })))
            .select("id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes")
          return { ...row, set_configs: newConfigs ?? [], exercises: sourceExercises[i].exercises }
        }))
        setDays((prev) => ({
          ...prev,
          [selectedDay]: {
            ...prev[selectedDay],
            exercises: [...prev[selectedDay].exercises, ...newEntries],
          },
        }))
      }
    } finally {
      setCopying(false)
    }
  }

  async function addSetConfig(peId: string) {
    const pe = days[selectedDay].exercises.find((e) => e.id === peId)
    if (!pe) return
    const configs = pe.set_configs ?? []
    const nextNum = configs.length > 0 ? Math.max(...configs.map((s) => s.set_number)) + 1 : 1
    const last = configs[configs.length - 1]
    const { data, error } = await supabase
      .from("workout_plan_set_configs")
      .insert({ exercise_id: peId, set_number: nextNum, reps: last?.reps ?? 10, reps_max: last?.reps_max ?? null, percent_1rm: last?.percent_1rm ?? null, duration_seconds: last?.duration_seconds ?? null })
      .select("id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes")
      .single()
    if (error) { console.error("[addSetConfig]", error); return }
    if (data) {
      setDays((prev) => ({
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          exercises: prev[selectedDay].exercises.map((e) =>
            e.id === peId ? { ...e, set_configs: [...(e.set_configs ?? []), data as SetConfig] } : e
          ),
        },
      }))
    }
  }

  async function removeSetConfig(peId: string, configId: string) {
    await supabase.from("workout_plan_set_configs").delete().eq("id", configId)
    setDays((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        exercises: prev[selectedDay].exercises.map((e) =>
          e.id === peId ? { ...e, set_configs: e.set_configs.filter((s) => s.id !== configId) } : e
        ),
      },
    }))
  }

  async function updateSetConfig(peId: string, configId: string, field: keyof Omit<SetConfig, "id" | "set_number">, value: number | string | null) {
    await supabase.from("workout_plan_set_configs").update({ [field]: value } as never).eq("id", configId)
    setDays((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        exercises: prev[selectedDay].exercises.map((e) =>
          e.id === peId
            ? { ...e, set_configs: e.set_configs.map((s) => s.id === configId ? { ...s, [field]: value } : s) }
            : e
        ),
      },
    }))
  }

  async function updateNotes(peId: string, notes: string) {
    setSaving(peId)
    await supabase.from("workout_plan_exercises").update({ notes: notes || null }).eq("id", peId)
    setDays((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        exercises: prev[selectedDay].exercises.map((pe) =>
          pe.id === peId ? { ...pe, notes: notes || null } : pe
        ),
      },
    }))
    setSaving(null)
  }

  async function updateField(peId: string, field: "sets" | "reps" | "reps_max" | "rest_seconds" | "duration_seconds", value: number | null) {
    setSaving(peId)
    await supabase.from("workout_plan_exercises").update({ [field]: value } as unknown as { sets?: number; reps?: number; reps_max?: number | null; rest_seconds?: number; duration_seconds?: number | null }).eq("id", peId)
    setDays((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        exercises: prev[selectedDay].exercises.map((pe) =>
          pe.id === peId ? { ...pe, [field]: value } : pe
        ),
      },
    }))
    setSaving(null)
  }

  async function deletePlan() {
    setDeleting(true)
    const dayIds = Object.values(days).map((d) => d.id).filter(Boolean) as string[]
    if (dayIds.length > 0) {
      await supabase.from("workout_plan_exercises").delete().in("day_id", dayIds)
      await supabase.from("workout_plan_days").delete().eq("plan_id", plan.id)
    }
    await supabase.from("workout_plans").delete().eq("id", plan.id)
    router.push("/planes")
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CATEGORY_ICONS, StrengthIcon } = require("@/components/exercises/CategoryIcons")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline" size="sm"
          onClick={() => router.push("/planes")}
          className="shrink-0 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-50 truncate">{plan.name}</h1>
          {plan.description && (
            <p className="mt-0.5 text-sm text-zinc-500 truncate">{plan.description}</p>
          )}
          {plan.is_template && (
            <span className="mt-1 inline-block rounded-full bg-brand-700/20 px-2 py-0.5 text-xs text-brand-500">
              Plantilla
            </span>
          )}
        </div>
        {!readOnly && (
          <Button
            variant="outline" size="sm"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 border-red-900/50 text-red-500 hover:bg-red-900/20 hover:border-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">¿Eliminar plan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Se borrará <span className="font-semibold text-zinc-200">{plan.name}</span> con todos sus ejercicios. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-400"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-700 hover:bg-red-800 text-white"
              onClick={deletePlan}
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {DAY_SHORT.map((label, i) => {
          const hasExercises = days[i].exercises.length > 0
          const isToday = i === todayDow
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={cn(
                "relative shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                selectedDay === i
                  ? "bg-brand-700 text-white shadow-lg shadow-brand-700/30"
                  : "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <span className="flex flex-col items-center gap-0.5">
                {label}
                {isToday && (
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-widest leading-none",
                    selectedDay === i ? "text-white/70" : "text-brand-500"
                  )}>
                    hoy
                  </span>
                )}
              </span>
              {hasExercises && !isToday && (
                <span className={cn(
                  "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                  selectedDay === i ? "bg-white/60" : "bg-brand-500"
                )} />
              )}
            </button>
          )
        })}
      </div>

      {/* Day content */}
      <div className="rounded-2xl border border-zinc-300 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 backdrop-blur-md overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-300 dark:border-white/[6%] px-5 py-4 bg-white dark:bg-[#111113] rounded-t-2xl">
          <div>
            <p className="font-semibold text-zinc-100">{DAY_FULL[selectedDay]}</p>
            <p className="text-xs text-zinc-500">
              {currentDay.exercises.length === 0
                ? "Día de descanso"
                : `${currentDay.exercises.length} ejercicio${currentDay.exercises.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {/* Copy from day */}
              {(() => {
                const daysWithEx = Object.entries(days)
                  .filter(([i, d]) => Number(i) !== selectedDay && d.exercises.length > 0)
                return daysWithEx.length > 0 ? (
                  <div className="relative" ref={copyMenuRef}>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setCopyMenuOpen((o) => !o)}
                      disabled={copying}
                      className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {copying ? "Copiando…" : "Copiar de"}
                    </Button>
                    {copyMenuOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
                        {daysWithEx.map(([i, d]) => (
                          <button
                            key={i}
                            onClick={() => copyFromDay(Number(i))}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            <span className="font-medium">{DAY_FULL[Number(i)]}</span>
                            <span className="text-xs text-zinc-500">{d.exercises.length} ej.</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>

        {currentDay.exercises.length === 0 && readOnly ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Moon className="h-5 w-5 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Día de descanso</p>
          </div>
        ) : (
          <div>
            {PHASES.map(({ key: phaseKey, label, Icon, color }) => {
              const phaseExs = currentDay.exercises.filter((pe) => (pe.phase ?? "main") === phaseKey)
              if (phaseExs.length === 0 && readOnly) return null
              return (
                <div key={phaseKey} className="border-t border-zinc-300/80 dark:border-white/[3%] first:border-t-0">
                  <div className="sticky top-[73px] z-10 flex items-center justify-between border-b border-zinc-300 dark:border-white/[6%] px-4 py-2.5 bg-white dark:bg-[#111113]">
                    <button
                      onClick={() => togglePhase(phaseKey)}
                      className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                    >
                      <Icon className={cn("h-3.5 w-3.5", color)} />
                      {label}{phaseExs.length > 0 ? ` · ${phaseExs.length}` : ""}
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", collapsedPhases.has(phaseKey) && "-rotate-90")} />
                    </button>
                    {!readOnly && (
                      <button
                        onClick={() => { setPickerPhase(phaseKey); setPickerOpen(true) }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer shadow-sm shadow-brand-700/30 active:scale-95"
                        aria-label={`Agregar ejercicio a ${label}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {!collapsedPhases.has(phaseKey) && (
                      <motion.div
                        key={phaseKey + "-content"}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
                        style={{ overflow: "hidden" }}
                      >
                        {phaseExs.length === 0 && !readOnly && (
                          <p className="px-4 py-3 text-xs text-zinc-500">Sin ejercicios</p>
                        )}
                        {phaseExs.map((pe, index) => (
                  <div key={pe.id} style={{ scrollMarginTop: '104px' }} className={cn("mx-3 mb-2 rounded-xl border overflow-hidden", PHASE_CARD[phaseKey])}>

                {/* Card header: image + name + trash */}
                <div className="flex items-center gap-3 px-3 pt-3 pb-2 bg-white/30 dark:bg-white/[5%]">
                  <div className="relative shrink-0">
                    {pe.exercises.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pe.exercises.image_url} alt={pe.exercises.name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                        {(() => { const Icon = CATEGORY_ICONS[pe.exercises.category] ?? StrengthIcon; return <Icon size={24} /> })()}
                      </div>
                    )}
                    <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold capitalize text-zinc-100 leading-tight">{pe.exercises.name}</p>
                    <p className="text-xs capitalize text-zinc-500">{pe.exercises.category}</p>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => removeExercise(pe.id)}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 dark:border-white/[12%] text-zinc-400 dark:text-zinc-500 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all"
                      aria-label="Eliminar ejercicio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Series section */}
                {readOnly ? (
                  <div className="px-3 pb-3 space-y-1 border-t border-zinc-300/80 dark:border-white/[3%] pt-2">
                    {pe.set_configs.length > 0
                      ? pe.set_configs.map((s) => (
                          <p key={s.id} className="text-xs text-zinc-400">
                            Serie {s.set_number}: {s.duration_seconds != null ? `${s.duration_seconds}s` : `${s.reps}${s.reps_max ? `–${s.reps_max}` : ""} reps`}{s.percent_1rm ? ` · @${s.percent_1rm}%` : ""}
                          </p>
                        ))
                      : <StatBadge label="Reps" value={pe.reps} />
                    }
                    <p className="text-xs text-zinc-500 pt-1">Descanso: {pe.rest_seconds}s</p>
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-[56px_1fr_120px_64px] items-center gap-x-4 px-3 py-1.5 border-t border-zinc-300/80 dark:border-white/[3%]">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">Serie</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">
                        {pe.exercises.is_timed ? "Tiempo" : "Reps"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">1RM (%)</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">Acciones</span>
                    </div>

                    {/* Series rows */}
                    {pe.set_configs.map((s) => (
                      <SetConfigRow
                        key={s.id}
                        config={s}
                        saving={saving === pe.id}
                        onChange={(field, value) => updateSetConfig(pe.id, s.id, field, value)}
                        onRemove={() => removeSetConfig(pe.id, s.id)}
                      />
                    ))}

                    {/* Add serie button */}
                    <div className="px-3 py-2">
                      <button
                        onClick={() => addSetConfig(pe.id)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700/60 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Añadir Nueva Serie
                      </button>
                    </div>

                    {/* Footer: Descanso + Notes */}
                    <div className="border-t border-zinc-300/80 dark:border-white/[3%] px-3 py-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 shrink-0">Descanso:</span>
                        <InlineNum value={pe.rest_seconds} min={0} max={300} saving={saving === pe.id} suffix="s" onChange={(v) => updateField(pe.id, "rest_seconds", v ?? 60)} />
                      </div>
                      <NotesField
                        value={pe.notes ?? ""}
                        saving={saving === pe.id}
                        onSave={(v: string) => updateNotes(pe.id, v)}
                      />
                    </div>
                  </>
                )}
              </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Weekly overview */}
      <div className="rounded-2xl border border-zinc-300 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 backdrop-blur-md p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Resumen semanal</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_SHORT.map((label, i) => {
            const count = days[i].exercises.length
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all",
                  selectedDay === i ? "bg-brand-700/20 ring-1 ring-brand-700/40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <span className="text-[10px] font-semibold text-zinc-500">{label}</span>
                <span className={cn(
                  "text-base font-black leading-none",
                  count > 0 ? "text-white" : "text-zinc-700"
                )}>
                  {count > 0 ? count : "–"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Muscle volume panel */}
      <div className="rounded-2xl border border-zinc-300 dark:border-white/[6%] bg-white dark:bg-zinc-950/60 backdrop-blur-md p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-red-500" />
              <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Volumen muscular semanal</p>
            </div>
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Series efectivas por grupo muscular</p>
          </div>
          {totalMuscleSets > 0 && (
            <div className="flex items-center gap-2 rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <Info className="h-3.5 w-3.5 text-zinc-500" />
              {totalMuscleSets} series totales
            </div>
          )}
        </div>

        {muscleVolumeStats.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-500">Agregá grupos musculares a los ejercicios para ver el análisis.</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
            <div className="min-w-0">
              <div className="mb-3 grid grid-cols-[176px_1fr_116px_156px] items-center gap-4 px-1 text-[10px] font-semibold text-zinc-500 max-lg:hidden">
                <span />
                <span>Series efectivas</span>
                <span className="text-center">Rango recomendado</span>
                <span className="text-center">Estado</span>
              </div>

              <div className="space-y-3">
                {muscleVolumeStats.map(({ muscle, sets, zone, range, status }) => {
                  const progress = Math.min(100, Math.round((sets / range[1]) * 100))
                  return (
                    <div key={muscle} className="grid items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-white/[6%] dark:hover:bg-white/[2%] lg:grid-cols-[176px_1fr_116px_156px]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[3%]">
                          <MuscleSilhouette zone={zone} className="h-10 w-7" />
                        </div>
                        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{muscle}</span>
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[6%]">
                          <div
                            className="h-full rounded-full bg-red-600 shadow-[0_0_16px_rgba(220,38,38,0.55)] transition-[width] duration-200 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-sm font-black tabular-nums text-red-500">{sets}</span>
                      </div>

                      <span className="text-center text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                        {range[0]} - {range[1]}
                      </span>

                      <div className="flex lg:justify-center">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-black uppercase", statusClass(status))}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-300/70 bg-zinc-50/70 p-5 dark:border-white/[7%] dark:bg-white/[3%]">
                <p className="mb-4 text-sm font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200">Resumen semanal</p>
                <div
                  className="mx-auto grid h-52 w-52 place-items-center rounded-full"
                  style={{ background: `conic-gradient(rgb(239 68 68) ${Math.min(360, totalMuscleSets * 8)}deg, rgba(113,113,122,.25) 0deg)` }}
                >
                  <div className="grid h-40 w-40 place-items-center rounded-full bg-white text-center shadow-inner dark:bg-zinc-950">
                    <div>
                      <p className="text-5xl font-black text-zinc-900 dark:text-white">{totalMuscleSets}</p>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Series totales</p>
                      <p className="text-xs text-zinc-500">esta semana</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-300/70 bg-zinc-50/70 p-5 dark:border-white/[7%] dark:bg-white/[3%]">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-black uppercase tracking-wide text-red-500">Recomendación</p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {recommendedMuscles.length > 0
                    ? `Considerá aumentar ligeramente ${recommendedMuscles.join(", ")} para balancear mejor el estímulo semanal.`
                    : "Tu volumen está bien balanceado. Mantené el estímulo y revisá la recuperación semana a semana."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Exercise picker — trainer only */}
      {!readOnly && <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col sm:max-w-lg [&>button:last-child]:hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-zinc-50">
                Agregar a {DAY_FULL[selectedDay]}
              </DialogTitle>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={refreshExercises}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-all disabled:opacity-50"
                  title="Actualizar lista"
                >
                  <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                  Actualizar
                </button>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-all"
                  title="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              className="pl-9"
              placeholder="Buscar ejercicio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                {search ? "Sin resultados" : "Todos los ejercicios ya están en este día"}
              </p>
            ) : (
              filtered.slice(0, 50).map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {(() => { const Icon = CATEGORY_ICONS[ex.category] ?? StrengthIcon; return <Icon size={24} /> })()}
                  <div className="min-w-0">
                    <p className="truncate text-sm capitalize text-zinc-100">{ex.name}</p>
                    <p className="text-xs capitalize text-zinc-500">{ex.category}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-zinc-800 px-3 py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-bold text-zinc-200">{value}</span>
    </div>
  )
}

function NumberField({ label, value, min, max, saving, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  saving: boolean; onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value))

  useEffect(() => { setLocal(String(value)) }, [value])

  function handleBlur() {
    const parsed = parseInt(local, 10)
    if (isNaN(parsed)) { setLocal(String(value)); return }
    const clamped = Math.min(max, Math.max(min, parsed))
    setLocal(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={local}
        disabled={saving}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
        className={cn(
          "w-14 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          saving && "opacity-50"
        )}
      />
    </div>
  )
}

function NotesField({ value, saving, onSave }: {
  value: string; saving: boolean; onSave: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  return (
    <input
      type="text"
      value={local}
      disabled={saving}
      placeholder="Notas (ej: @ 75-80% 1RM, explosivo…)"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onSave(local) }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
      className={cn(
        "w-full rounded-md border border-zinc-300 dark:border-zinc-700/50 bg-transparent px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:text-zinc-800 dark:focus:text-zinc-300",
        saving && "opacity-50"
      )}
    />
  )
}

function InlineNum({ value, min, max, saving, onChange, suffix, placeholder }: {
  value: number | null; min: number; max: number; saving: boolean
  onChange: (v: number | null) => void; suffix?: string; placeholder?: string
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "")
  useEffect(() => { setLocal(value != null ? String(value) : "") }, [value])

  function handleBlur() {
    if (local === "") { onChange(null); return }
    const parsed = parseInt(local, 10)
    if (isNaN(parsed)) { setLocal(value != null ? String(value) : ""); return }
    const clamped = Math.min(max, Math.max(min, parsed))
    setLocal(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        min={min}
        max={max}
        value={local}
        placeholder={placeholder ?? ""}
        disabled={saving}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
        className={cn(
          "w-10 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-center text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          saving && "opacity-50"
        )}
      />
      {suffix && <span className="text-zinc-500 text-xs">{suffix}</span>}
    </div>
  )
}

function SetConfigRow({ config, saving, onChange, onRemove }: {
  config: SetConfig
  saving: boolean
  onChange: (field: keyof Omit<SetConfig, "id" | "set_number">, value: number | null) => void
  onRemove: () => void
}) {
  const isTimed = config.duration_seconds != null

  return (
    <div className="grid grid-cols-[56px_1fr_120px_64px] items-center gap-x-4 px-3 py-2.5 border-b border-zinc-300/60 dark:border-white/[3%]">
      {/* Serie */}
      <span className="text-center text-base font-semibold text-zinc-300">{config.set_number}</span>

      {/* Tiempo o Reps */}
      <div className="flex items-center justify-center gap-1.5">
        {isTimed ? (
          <>
            <span className="text-zinc-500 text-sm select-none px-1">—</span>
            <InlineNum value={config.duration_seconds} min={1} max={300} saving={saving} suffix="s" onChange={(v) => onChange("duration_seconds", v)} />
          </>
        ) : (
          <>
            <InlineNum value={config.reps} min={1} max={99} saving={saving} onChange={(v) => onChange("reps", v)} />
            <span className="text-zinc-500 text-sm select-none px-1">—</span>
            <InlineNum value={config.reps_max} min={1} max={99} saving={saving} placeholder="—" onChange={(v) => onChange("reps_max", v)} />
          </>
        )}
      </div>

      {/* 1RM % */}
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-xs text-zinc-500 shrink-0">1RM</span>
        <InlineNum value={config.percent_1rm} min={1} max={100} saving={saving} suffix="%" onChange={(v) => onChange("percent_1rm", v)} />
      </div>

      {/* Eliminar */}
      <button
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 dark:border-white/[12%] text-zinc-400 dark:text-zinc-500 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all"
        aria-label="Eliminar serie"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

