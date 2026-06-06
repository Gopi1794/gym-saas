"use client"

import { useState, useTransition } from "react"
import { Plus, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { showToast } from "nextjs-toast-notify"
import { logWeight } from "@/app/actions/nutrition-tracking"
import type { WeightLog } from "@/app/actions/nutrition-tracking"

interface Props {
  history: WeightLog[]
  goalWeight?: number | null
}

function Sparkline({ data, goal }: { data: { date: string; weight: number }[]; goal?: number | null }) {
  if (data.length < 2) return null

  const W = 300, H = 80
  const weights = data.map(d => d.weight)
  const min = Math.min(...weights) - 1
  const max = Math.max(...weights) + 1
  const range = max - min || 1

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.weight - min) / range) * (H - 8) - 4,
  }))

  const line = pts.map(p => `${p.x},${p.y}`).join(" ")
  const area = `0,${H} ${line} ${W},${H}`

  const goalY = goal ? H - ((goal - min) / range) * (H - 8) - 4 : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 80 }}>
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#wg)" />
      <polyline points={line} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {goalY !== null && (
        <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill="#60a5fa" />
    </svg>
  )
}

export default function WeightChart({ history, goalWeight }: Props) {
  const [logs, setLogs] = useState(history)
  const [showAdd, setShowAdd] = useState(false)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()

  const data = logs.map(l => ({ date: l.log_date, weight: l.weight_kg }))
  const latest = data[data.length - 1]
  const prev = data[data.length - 2]
  const delta = latest && prev ? latest.weight - prev.weight : null
  const totalDelta = data.length >= 2 ? data[data.length - 1].weight - data[0].weight : null

  function handleLog() {
    const kg = parseFloat(input)
    if (!kg || kg < 20 || kg > 300) return
    startTransition(async () => {
      try {
        await logWeight(kg)
        const today = new Date().toISOString().split("T")[0]
        setLogs(prev => {
          const without = prev.filter(l => l.log_date !== today)
          return [...without, { id: crypto.randomUUID(), member_id: "", log_date: today, weight_kg: kg, notes: null }]
            .sort((a, b) => a.log_date.localeCompare(b.log_date))
        })
        showToast.success(`Peso registrado: ${kg} kg`, { duration: 3000, position: "top-right", transition: "bounceIn" })
        setInput("")
        setShowAdd(false)
      } catch {
        showToast.error("No se pudo registrar el peso", { duration: 4000, position: "top-right" })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Peso corporal</p>
          <p className="text-xs text-zinc-500">Últimos 90 días</p>
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <div className="text-right">
              <p className="text-lg font-black leading-none text-blue-400">
                {latest.weight}<span className="ml-0.5 text-xs font-medium text-zinc-500">kg</span>
              </p>
              {delta !== null && (
                <div className={`flex items-center justify-end gap-0.5 text-xs ${delta < 0 ? "text-emerald-400" : delta > 0 ? "text-red-400" : "text-zinc-500"}`}>
                  {delta < 0 ? <TrendingDown className="h-3 w-3" /> : delta > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ej: 78.5"
            step={0.1}
            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            onKeyDown={e => e.key === "Enter" && handleLog()}
            autoFocus
          />
          <span className="text-sm text-zinc-500">kg</span>
          <button
            onClick={handleLog}
            disabled={isPending}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? "…" : "Guardar"}
          </button>
        </div>
      )}

      {data.length >= 2 ? (
        <>
          <Sparkline data={data} goal={goalWeight} />
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{data[0].date}</span>
            {goalWeight && (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="inline-block h-1 w-3 border-t border-dashed border-emerald-400" />
                objetivo {goalWeight} kg
              </span>
            )}
            <span>{data[data.length - 1].date}</span>
          </div>
          {totalDelta !== null && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              Cambio total:{" "}
              <span className={`font-bold ${totalDelta < 0 ? "text-emerald-400" : totalDelta > 0 ? "text-red-400" : "text-zinc-400"}`}>
                {totalDelta > 0 ? "+" : ""}{totalDelta.toFixed(1)} kg
              </span>
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-zinc-500">
            {data.length === 1 ? "Registrá al menos 2 mediciones para ver el gráfico" : "Sin registros de peso aún"}
          </p>
          {data.length === 0 && (
            <p className="text-xs text-zinc-600">Tocá + para agregar tu peso de hoy</p>
          )}
        </div>
      )}
    </div>
  )
}
