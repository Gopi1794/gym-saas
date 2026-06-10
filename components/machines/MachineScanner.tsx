"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X, QrCode, Plus, ChevronRight, Dumbbell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { showToast } from "nextjs-toast-notify"
import { scanMachineQR, addExerciseToTodayPlan, type MachineExercise, type ScanResult } from "@/app/actions/machines"

interface Props {
  userId: string
  planId: string
  hasWorkoutToday: boolean
  onStartExercise: (exerciseId: string) => void
  onClose: () => void
}

type Phase =
  | { step: "scanner" }
  | { step: "machine_info"; name: string; description: string | null; image_url: string | null }
  | { step: "exercise_in_plan"; machine: string; exercise: MachineExercise; sets: number; reps: number; reps_max: number | null; isFirst: boolean }
  | { step: "exercise_not_in_plan"; machine: string; exercise: MachineExercise }
  | { step: "multi_choice"; machine: string; exercises: MachineExercise[]; todayIds: Set<string> }

export default function MachineScanner({ userId, planId, hasWorkoutToday, onStartExercise, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ step: "scanner" })
  const [isStarted, setIsStarted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const scannerRef = useRef<unknown>(null)
  const processingRef = useRef(false)

  const stopCamera = useCallback(() => {
    const sc = scannerRef.current as { stop: () => Promise<void>; isScanning: boolean } | null
    if (sc?.isScanning) sc.stop().catch(() => {})
    setIsStarted(false)
  }, [])

  const handleScan = useCallback(async (raw: string) => {
    if (processingRef.current) return
    if (!raw.startsWith("MACHINE:")) return
    processingRef.current = true

    const qrIdentifier = raw.replace("MACHINE:", "")
    const result: ScanResult = await scanMachineQR(qrIdentifier, userId)

    stopCamera()

    if (!result.found) {
      showToast.error("Máquina no encontrada", { duration: 3000, position: "top-right" })
      processingRef.current = false
      setPhase({ step: "scanner" })
      return
    }

    const { machine, exercises, todayExercises } = result
    const todayIds = new Set(todayExercises.map((e) => e.exerciseId))

    if (exercises.length === 0) {
      setPhase({ step: "machine_info", name: machine.name, description: machine.description, image_url: machine.image_url })
      processingRef.current = false
      return
    }

    // Si solo hay un ejercicio
    if (exercises.length === 1) {
      const ex = exercises[0]
      const inPlan = todayExercises.find((t) => t.exerciseId === ex.id)
      if (inPlan) {
        setPhase({
          step: "exercise_in_plan",
          machine: machine.name,
          exercise: ex,
          sets: inPlan.sets,
          reps: inPlan.reps,
          reps_max: inPlan.reps_max,
          isFirst: !hasWorkoutToday,
        })
      } else {
        setPhase({ step: "exercise_not_in_plan", machine: machine.name, exercise: ex })
      }
      processingRef.current = false
      return
    }

    // Múltiples ejercicios → elegir
    setPhase({ step: "multi_choice", machine: machine.name, exercises, todayIds })
    processingRef.current = false
  }, [userId, stopCamera, hasWorkoutToday, onClose])

  useEffect(() => {
    if (!isStarted) return
    let scanner: { stop: () => Promise<void>; isScanning: boolean } | null = null

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode")
      const el = new Html5Qrcode("machine-qr-element")
      scanner = el
      scannerRef.current = el
      const config = { fps: 10, qrbox: { width: 220, height: 220 } }
      const onScan = (text: string) => { if (!processingRef.current) handleScan(text) }
      try {
        await el.start({ facingMode: "environment" }, config, onScan, () => {})
      } catch {
        try { await el.start({ facingMode: "user" }, config, onScan, () => {}) } catch (e) {
          showToast.error("No se pudo acceder a la cámara", { duration: 3000, position: "top-right" })
          setIsStarted(false)
        }
      }
    }
    start()
    return () => { if (scanner?.isScanning) scanner.stop().catch(() => {}) }
  }, [isStarted, handleScan])

  async function handleAddToPlan(exerciseId: string) {
    setIsPending(true)
    const res = await addExerciseToTodayPlan(userId, exerciseId)
    setIsPending(false)
    if (res.success) {
      showToast.success("Ejercicio agregado a tu rutina", { duration: 2500, position: "top-right", transition: "bounceIn" })
    } else {
      showToast.error(res.error ?? "Error al agregar", { duration: 3000, position: "top-right" })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-brand-500" />
            <span className="font-semibold text-foreground text-sm">Escanear máquina</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scanner ── */}
        {phase.step === "scanner" && (
          <div className="px-5 pb-5 space-y-4">
            <div className="relative overflow-hidden rounded-xl border border-border bg-black" style={{ minHeight: 260 }}>
              <div id="machine-qr-element" className="w-full" />
              {!isStarted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <QrCode className="h-10 w-10 text-zinc-600" />
                  <Button size="sm" className="bg-brand hover:bg-brand-600" onClick={() => setIsStarted(true)}>
                    Iniciar cámara
                  </Button>
                </div>
              )}
            </div>
            {isStarted && (
              <Button variant="outline" size="sm" className="w-full" onClick={stopCamera}>
                Detener cámara
              </Button>
            )}
          </div>
        )}

        {/* ── Info de máquina sin ejercicios ── */}
        {phase.step === "machine_info" && (
          <div className="pb-5 space-y-4">
            {phase.image_url && (
              <div className="h-40 w-full overflow-hidden">
                <img src={phase.image_url} alt={phase.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="px-5 space-y-2">
              <p className="font-semibold text-foreground text-base">{phase.name}</p>
              {phase.description && (
                <p className="text-sm text-muted-foreground">{phase.description}</p>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Esta máquina todavía no tiene ejercicios asignados en la biblioteca.
              </p>
            </div>
            <div className="px-5">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {/* ── Ejercicio en el plan ── */}
        {phase.step === "exercise_in_plan" && (
          <div className="px-5 pb-5 space-y-4">
            <p className="text-xs text-muted-foreground">{phase.machine}</p>
            <div className="rounded-xl border border-brand-600/30 bg-brand-950/20 p-4 space-y-1">
              <p className="font-semibold text-foreground">{phase.exercise.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{phase.exercise.category}</p>
              <p className="text-sm font-medium text-brand-400 mt-2">
                {phase.sets} series × {phase.reps_max ? `${phase.reps}–${phase.reps_max}` : phase.reps} reps
              </p>
            </div>
            <Button
              className={`w-full ${phase.isFirst ? "h-14 text-base font-bold bg-brand hover:bg-brand-600" : "bg-brand hover:bg-brand-600"}`}
              onClick={() => { onStartExercise(phase.exercise.id); onClose() }}
            >
              {phase.isFirst ? "¡COMENZAR!" : "Seguir con este ejercicio"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Ejercicio NO en el plan ── */}
        {phase.step === "exercise_not_in_plan" && (
          <div className="px-5 pb-5 space-y-4">
            <p className="text-xs text-muted-foreground">{phase.machine}</p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
              <p className="font-semibold text-foreground">{phase.exercise.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{phase.exercise.category}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Este ejercicio no está en tu rutina de hoy.<br />¿Querés agregarlo?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                No, volver
              </Button>
              <Button
                className="flex-1 bg-brand hover:bg-brand-600"
                disabled={isPending}
                onClick={() => handleAddToPlan(phase.exercise.id)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar
              </Button>
            </div>
          </div>
        )}

        {/* ── Múltiples ejercicios ── */}
        {phase.step === "multi_choice" && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-muted-foreground">{phase.machine} · Elegí un ejercicio</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {phase.exercises.map((ex) => {
                const inPlan = phase.todayIds.has(ex.id)
                return (
                  <button
                    key={ex.id}
                    onClick={() => {
                      if (inPlan) {
                        setPhase({ step: "exercise_in_plan", machine: phase.machine, exercise: ex, sets: 3, reps: 10, reps_max: null, isFirst: !hasWorkoutToday })
                      } else {
                        setPhase({ step: "exercise_not_in_plan", machine: phase.machine, exercise: ex })
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand-600/40 hover:bg-brand-950/10"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                      <Dumbbell className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{ex.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{ex.category}</p>
                    </div>
                    {inPlan && (
                      <span className="ml-auto shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand-500">En tu plan</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
