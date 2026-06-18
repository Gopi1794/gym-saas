"use client"

import { TrendingUp, TrendingDown, Minus, Scale } from "lucide-react"
import Link from "next/link"

type WeightLog = { log_date: string; weight_kg: number }

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72, h = 28
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function WeightProgressCard({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return (
      <Link href="/progress" className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Scale className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tu peso</p>
          <p className="text-xs text-zinc-500">Registrá tu peso en Progreso</p>
        </div>
      </Link>
    )
  }

  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date))
  const current = sorted[sorted.length - 1]
  const first = sorted[0]
  const diff = +(Number(current.weight_kg) - Number(first.weight_kg)).toFixed(1)
  const values = sorted.map(l => Number(l.weight_kg))

  const TrendIcon = diff > 0.2 ? TrendingUp : diff < -0.2 ? TrendingDown : Minus
  const trendColor = diff > 0.2 ? "text-red-400" : diff < -0.2 ? "text-emerald-400" : "text-zinc-400"

  return (
    <Link href="/progress" className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Scale className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">Tu peso</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-zinc-900 dark:text-white">{current.weight_kg}</span>
            <span className="text-sm text-zinc-500">kg</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{diff > 0 ? `+${diff}` : diff} kg</span>
        </div>
        <div className={trendColor}>
          <Sparkline data={values} />
        </div>
      </div>
    </Link>
  )
}
