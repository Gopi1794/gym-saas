"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Search, Moon, Copy } from "lucide-react"
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

type PlanExercise = {
  id: string; sets: number; reps: number; reps_max: number | null
  rest_seconds: number; order_index: number; notes: string | null
  duration_seconds: number | null
  exercises: Exercise
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
  const [saving, setSaving] = useState<string | null>(null)
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const copyMenuRef = useRef<HTMLDivElement>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const currentDay = days[selectedDay]
  const inPlanIds = new Set(currentDay.exercises.map((pe) => pe.exercises.id))
  const filtered = allExercises.filter(
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
    try {
      const dayId = await ensureDayExists(selectedDay)
      const order = days[selectedDay].exercises.length

      const { data, error } = await supabase
        .from("workout_plan_exercises")
        .insert({ day_id: dayId, exercise_id: exercise.id, sets: 3, reps: 10, reps_max: null, rest_seconds: 60, order_index: order, duration_seconds: exercise.is_timed ? 30 : null })
        .select("id, sets, reps, reps_max, rest_seconds, order_index, notes, duration_seconds")
        .single() as unknown as { data: Omit<PlanExercise, "exercises"> | null; error: unknown }

      console.error("[addExercise] dayId:", dayId, "error:", error, "data:", data)

      if (!error && data) {
        setDays((prev) => ({
          ...prev,
          [selectedDay]: {
            ...prev[selectedDay],
            exercises: [...prev[selectedDay].exercises, { ...data, exercises: exercise }],
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
      const startOrder = days[selectedDay].exercises.length

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
        const newEntries = data.map((row, i) => ({
          ...row,
          exercises: sourceExercises[i].exercises,
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
                  : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
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
      <div className="rounded-2xl border border-white/8 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
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
              <Button
                onClick={() => setPickerOpen(true)}
                size="sm"
                className="bg-brand-700 hover:bg-brand-800 text-white"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar
              </Button>
            </div>
          )}
        </div>

        {currentDay.exercises.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Moon className="h-5 w-5 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Día de descanso</p>
            {!readOnly && (
              <Button
                onClick={() => setPickerOpen(true)}
                variant="outline" size="sm"
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar ejercicio
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {currentDay.exercises.map((pe, index) => (
              <div key={pe.id} className="flex flex-col">
                <div className="flex gap-4 p-4">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700/20 text-xs font-bold text-brand-500">
                    {index + 1}
                  </span>
                  {pe.exercises.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pe.exercises.image_url} alt={pe.exercises.name} className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-800">
                      {(() => { const Icon = CATEGORY_ICONS[pe.exercises.category] ?? StrengthIcon; return <Icon size={32} /> })()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium capitalize text-zinc-100">{pe.exercises.name}</p>
                  <p className="text-xs capitalize text-zinc-500">{pe.exercises.category}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {readOnly ? (
                      <>
                        <StatBadge label="Series" value={pe.sets} />
                        {pe.duration_seconds != null
                          ? <StatBadge label="Duración" value={`${pe.duration_seconds}s`} />
                          : <StatBadge label="Reps" value={pe.reps_max != null ? `${pe.reps}-${pe.reps_max}` : pe.reps} />}
                        <StatBadge label="Descanso" value={`${pe.rest_seconds}s`} />
                      </>
                    ) : (
                      <>
                        <NumberField label="Series" value={pe.sets} min={1} max={10} saving={saving === pe.id} onChange={(v) => updateField(pe.id, "sets", v)} />
                        {pe.duration_seconds != null ? (
                          <NumberField label="Duración (s)" value={pe.duration_seconds} min={5} max={3600} step={5} saving={saving === pe.id} onChange={(v) => updateField(pe.id, "duration_seconds", v)} />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-zinc-500">{pe.reps_max != null ? "Reps min–max" : "Reps"}</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={1} max={100}
                                value={pe.reps}
                                disabled={saving === pe.id}
                                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateField(pe.id, "reps", v) }}
                                className="w-10 rounded-md border border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              {pe.reps_max != null && (
                                <>
                                  <span className="text-xs text-zinc-500">–</span>
                                  <input
                                    type="number" min={pe.reps + 1} max={100}
                                    value={pe.reps_max}
                                    disabled={saving === pe.id}
                                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateField(pe.id, "reps_max", v) }}
                                    className="w-10 rounded-md border border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </>
                              )}
                              <button
                                title={pe.reps_max != null ? "Quitar rango" : "Agregar rango"}
                                onClick={() => updateField(pe.id, "reps_max", pe.reps_max != null ? null : pe.reps + 2)}
                                className="rounded px-1 py-0.5 text-[10px] text-zinc-500 border border-zinc-700 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                              >
                                {pe.reps_max != null ? "×" : "+"}
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          title={pe.duration_seconds != null ? "Cambiar a reps" : "Cambiar a tiempo"}
                          onClick={() => updateField(pe.id, "duration_seconds", pe.duration_seconds != null ? null : 30)}
                          className="self-end mb-0.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                        >
                          {pe.duration_seconds != null ? "×" : "⏱"}
                        </button>
                        <NumberField label="Descanso (s)" value={pe.rest_seconds} min={0} max={300} step={15} saving={saving === pe.id} onChange={(v) => updateField(pe.id, "rest_seconds", v)} />
                      </>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <button
                    onClick={() => removeExercise(pe.id)}
                    className="shrink-0 self-start rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!readOnly && (
                <div className="px-4 pb-3">
                  <NotesField
                    value={pe.notes ?? ""}
                    saving={saving === pe.id}
                    onSave={(v: string) => updateNotes(pe.id, v)}
                  />
                </div>
              )}
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly overview */}
      <div className="rounded-2xl border border-white/8 bg-zinc-900/50 backdrop-blur-md p-4">
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
                  selectedDay === i ? "bg-brand-700/20 ring-1 ring-brand-700/40" : "hover:bg-zinc-800"
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

      {/* Exercise picker — trainer only */}
      {!readOnly && <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">
              Agregar a {DAY_FULL[selectedDay]}
            </DialogTitle>
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-800"
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
        "w-full rounded-md border border-zinc-700/50 bg-transparent px-2 py-1 text-xs text-zinc-400 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:text-zinc-300",
        saving && "opacity-50"
      )}
    />
  )
}
