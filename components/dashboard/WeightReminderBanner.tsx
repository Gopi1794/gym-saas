"use client"

import { useState, useTransition } from "react"
import { Scale, X } from "lucide-react"
import { logWeight } from "@/app/actions/nutrition-tracking"
import { showToast } from "nextjs-toast-notify"

interface Props {
  daysSinceLastLog: number | null  // null = nunca registró
}

export default function WeightReminderBanner({ daysSinceLastLog }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  const never = daysSinceLastLog === null
  const message = never
    ? "Registrá tu peso para hacer seguimiento de tu progreso"
    : `Hace ${daysSinceLastLog} días que no registrás tu peso`

  function handleLog() {
    const kg = parseFloat(input)
    if (!kg || kg < 20 || kg > 300) return
    startTransition(async () => {
      try {
        await logWeight(kg)
        showToast.success(`Peso registrado: ${kg} kg`, { duration: 3000, position: "top-right", transition: "bounceIn" })
        setDismissed(true)
      } catch {
        showToast.error("No se pudo registrar el peso", { duration: 4000, position: "top-right" })
      }
    })
  }

  return (
    <div className="relative rounded-2xl border border-blue-500/30 bg-zinc-900 px-4 py-3">

      <div className="flex flex-wrap items-center gap-3">
        <Scale className="h-4 w-4 shrink-0 text-blue-400" />

        <p className="flex-1 text-sm text-zinc-300">{message}</p>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={20}
              max={300}
              placeholder="Ej: 78.5"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLog()}
              className="w-20 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              autoFocus={false}
            />
            <span className="text-xs text-zinc-500">kg</span>
          </div>

          <button
            onClick={handleLog}
            disabled={isPending || !input}
            className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            {isPending ? "…" : "Guardar"}
          </button>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-600 transition-colors hover:text-zinc-400"
          aria-label="Descartar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
