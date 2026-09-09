"use client"

import { useState, useTransition } from "react"
import { Scale, ArrowRight, X } from "lucide-react"
import { logWeight } from "@/app/actions/nutrition-tracking"
import { sileo } from "sileo"

interface Props {
  daysSinceLastLog: number | null // null = nunca registró
}

export default function WeightReminderBanner({ daysSinceLastLog }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  const never = daysSinceLastLog === null
  const title = never ? "Registrá tu peso" : `Hace ${daysSinceLastLog} días sin registrar`
  const subtitle = never
    ? "Primer registro para medir tu progreso."
    : "Actualizá el seguimiento semanal."

  function handleLog() {
    const kg = parseFloat(input)
    if (!kg || kg < 20 || kg > 300) return
    startTransition(async () => {
      try {
        await logWeight(kg)
        sileo.success({ title: `Peso registrado: ${kg} kg`, description: "Se guardó en tu historial de seguimiento.", duration: 3000 })
        setDismissed(true)
      } catch {
        sileo.error({ title: "No se pudo registrar el peso", description: "Intentá de nuevo en unos segundos.", duration: 4000 })
      }
    })
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-700/20 bg-zinc-900/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 z-10 rounded-full p-1 text-zinc-600 transition-colors duration-150 ease-out hover:text-zinc-300 active:scale-95"
        aria-label="Descartar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 pr-8">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 shadow-[0_0_22px_rgba(213,0,0,0.35)]">
          <Scale className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-white">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-400">{subtitle}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
        <label className="flex h-11 min-w-0 items-center rounded-xl border border-zinc-700/80 bg-zinc-950/55 px-3 focus-within:border-brand-600/60">
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={20}
            max={300}
            value={input}
            placeholder="Ej: 78.5"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLog()}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <span className="ml-2 shrink-0 text-xs text-zinc-500">kg</span>
        </label>

        <button
          onClick={handleLog}
          disabled={isPending || !input}
          aria-label="Guardar peso"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-[transform,background-color,opacity] duration-150 ease-out hover:bg-brand-600 active:scale-95 disabled:opacity-40"
        >
          {isPending ? "..." : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
