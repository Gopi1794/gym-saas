"use client"

import { useState, useTransition } from "react"
import { QrCode, Plus, Trash2, Pencil, Dumbbell, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { showToast } from "nextjs-toast-notify"
import { QRCodeSVG } from "qrcode.react"
import {
  createMachine,
  deleteMachine,
  setMachineExercises,
  type MachineWithExercises,
  type MachineExercise,
} from "@/app/actions/machines"

interface Exercise {
  id: string
  name: string
  category: string
}

interface Props {
  gymId: string
  initialMachines: MachineWithExercises[]
  allExercises: Exercise[]
}

type Modal =
  | { type: "create" }
  | { type: "qr"; machine: MachineWithExercises }
  | { type: "edit"; machine: MachineWithExercises }
  | null

export default function MachinesPanel({ gymId, initialMachines, allExercises }: Props) {
  const [machines, setMachines] = useState(initialMachines)
  const [modal, setModal] = useState<Modal>(null)
  const [isPending, startTransition] = useTransition()

  // ── Create ────────────────────────────────────────────────────────────────
  function CreateModal() {
    const [name, setName] = useState("")
    const [desc, setDesc] = useState("")

    function handleCreate() {
      if (!name.trim()) return
      startTransition(async () => {
        const result = await createMachine(gymId, name.trim(), desc.trim())
        if (!result) {
          showToast.error("Error al crear la máquina", { duration: 3000, position: "top-right" })
          return
        }
        setMachines((prev) => [...prev, { id: result.id, name: name.trim(), description: desc.trim() || null, qr_identifier: result.id, exercises: [] }])
        showToast.success("Máquina creada", { duration: 2500, position: "top-right", transition: "bounceIn" })
        setModal(null)
      })
    }

    return (
      <ModalShell title="Nueva máquina" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Input placeholder="Nombre *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button className="w-full bg-brand hover:bg-brand-600" onClick={handleCreate} disabled={!name.trim() || isPending}>
            Crear máquina
          </Button>
        </div>
      </ModalShell>
    )
  }

  // ── Edit exercises ────────────────────────────────────────────────────────
  function EditModal({ machine }: { machine: MachineWithExercises }) {
    const [selected, setSelected] = useState<Set<string>>(
      new Set(machine.exercises.map((e) => e.id))
    )
    const [search, setSearch] = useState("")

    const filtered = allExercises.filter((e) =>
      e.name.toLowerCase().includes(search.toLowerCase())
    )

    function toggle(id: string) {
      setSelected((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }

    function handleSave() {
      startTransition(async () => {
        await setMachineExercises(machine.id, [...selected])
        setMachines((prev) =>
          prev.map((m) =>
            m.id === machine.id
              ? { ...m, exercises: allExercises.filter((e) => selected.has(e.id)) as MachineExercise[] }
              : m
          )
        )
        showToast.success("Ejercicios actualizados", { duration: 2500, position: "top-right", transition: "bounceIn" })
        setModal(null)
      })
    }

    return (
      <ModalShell title={`Ejercicios — ${machine.name}`} onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Input placeholder="Buscar ejercicio…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => toggle(ex.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${selected.has(ex.id) ? "border-brand bg-brand" : "border-zinc-400"}`}>
                  {selected.has(ex.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm text-foreground">{ex.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{ex.category}</span>
              </button>
            ))}
          </div>
          <Button className="w-full bg-brand hover:bg-brand-600" onClick={handleSave} disabled={isPending}>
            Guardar ({selected.size} ejercicios)
          </Button>
        </div>
      </ModalShell>
    )
  }

  // ── QR Modal ──────────────────────────────────────────────────────────────
  function QRModal({ machine }: { machine: MachineWithExercises }) {
    const qrValue = `MACHINE:${machine.qr_identifier}`
    return (
      <ModalShell title={`QR — ${machine.name}`} onClose={() => setModal(null)}>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={qrValue} size={200} />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Imprimí este QR y pegalo en la máquina.<br />
            Los socios lo escanean para ver los ejercicios.
          </p>
          <Button variant="outline" className="w-full" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </ModalShell>
    )
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete(machineId: string) {
    if (!confirm("¿Eliminar esta máquina?")) return
    startTransition(async () => {
      await deleteMachine(machineId)
      setMachines((prev) => prev.filter((m) => m.id !== machineId))
      showToast.success("Máquina eliminada", { duration: 2500, position: "top-right" })
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end">
        <Button className="bg-brand hover:bg-brand-600" onClick={() => setModal({ type: "create" })}>
          <Plus className="mr-2 h-4 w-4" /> Nueva máquina
        </Button>
      </div>

      {/* Grid */}
      {machines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Dumbbell className="h-5 w-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">No hay máquinas registradas</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => (
            <div
              key={machine.id}
              className="relative rounded-2xl border border-border bg-card p-5 space-y-3"
            >
              {/* Actions */}
              <div className="absolute top-4 right-4 flex gap-1">
                <button
                  onClick={() => setModal({ type: "qr", machine })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                  title="Ver QR"
                >
                  <QrCode className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setModal({ type: "edit", machine })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                  title="Editar ejercicios"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(machine.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div>
                <p className="font-semibold text-foreground pr-24">{machine.name}</p>
                {machine.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{machine.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Dumbbell className="h-3.5 w-3.5" />
                <span>{machine.exercises.length} ejercicio{machine.exercises.length !== 1 ? "s" : ""}</span>
              </div>

              {machine.exercises.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {machine.exercises.slice(0, 4).map((ex) => (
                    <span key={ex.id} className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand-600 dark:text-brand-400">
                      {ex.name}
                    </span>
                  ))}
                  {machine.exercises.length > 4 && (
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-muted-foreground">
                      +{machine.exercises.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === "create" && <CreateModal />}
      {modal?.type === "edit" && <EditModal machine={modal.machine} />}
      {modal?.type === "qr" && <QRModal machine={modal.machine} />}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
