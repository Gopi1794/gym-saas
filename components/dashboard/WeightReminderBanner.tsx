"use client"

import { useState, useTransition } from "react"
import { Scale, ArrowRight, X } from "lucide-react"
import { logWeight } from "@/app/actions/nutrition-tracking"
import { sileo } from "sileo"

interface Props {
  daysSinceLastLog: number | null  // null = nunca registró
}

export default function WeightReminderBanner({ daysSinceLastLog }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  const never = daysSinceLastLog === null
  const title = never ? "Registrá tu peso" : `Hace ${daysSinceLastLog} días sin registrar`
  const subtitle = never
    ? "para hacer seguimiento de tu progreso"
    : "Registrá tu peso para seguir tu progreso"

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
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-zinc-600 transition-colors hover:text-zinc-400"
        aria-label="Descartar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-wrap items-center gap-3 pr-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-700">
          <Scale className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-zinc-400">{subtitle}</p>
        </div>

        <div className="shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-1.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={20}
              max={300}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLog()}
              className="w-14 bg-transparent text-sm text-zinc-100 outline-none"
            />
            <span className="text-xs text-zinc-500">kg</span>
          </div>
          <p className="mt-1 text-center text-[10px] text-zinc-500">Ej: 78.5 kg</p>
        </div>

        <button
          onClick={handleLog}
          disabled={isPending || !input}
          aria-label="Guardar peso"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
        >
          {isPending ? "…" : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
