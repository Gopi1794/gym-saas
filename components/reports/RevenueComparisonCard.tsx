"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface Props {
  thisMonth: number
  lastMonth: number
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

export default function RevenueComparisonCard({ thisMonth, lastMonth }: Props) {
  const delta = lastMonth === 0 ? null : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  const up = delta !== null && delta > 0
  const down = delta !== null && delta < 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 px-4 py-4">
        <p className="text-xs text-muted-foreground mb-1">Este mes</p>
        <p className="text-2xl font-black text-brand-500 leading-none">{fmt(thisMonth)}</p>
        {delta !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${up ? "text-emerald-500" : down ? "text-red-500" : "text-muted-foreground"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {up ? "+" : ""}{delta}% vs mes pasado
          </div>
        )}
      </div>
      <div className="rounded-xl bg-muted/50 border border-border px-4 py-4">
        <p className="text-xs text-muted-foreground mb-1">Mes anterior</p>
        <p className="text-2xl font-black text-foreground leading-none">{fmt(lastMonth)}</p>
        <p className="text-xs text-muted-foreground mt-2">pagos aprobados</p>
      </div>
    </div>
  )
}
