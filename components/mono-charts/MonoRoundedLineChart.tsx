"use client"

import type { ReactNode } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// Adapted from Mono Charts (MIT): https://github.com/Subhan-code/Monocharts
export interface MonoLineDatum {
  label: string
  value: number
}

interface MonoRoundedLineChartProps {
  data: MonoLineDatum[]
  valueFormatter: (value: number) => string
  emptyMessage: string
  toolbar?: ReactNode
}

export function MonoRoundedLineChart({ data, valueFormatter, emptyMessage, toolbar }: MonoRoundedLineChartProps) {
  const hasData = data.some((item) => item.value > 0)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const peak = Math.max(...data.map((item) => item.value), 0)

  return (
    <section className="relative isolate overflow-hidden rounded-[24px] border border-border bg-card p-4 shadow-sm dark:bg-zinc-950 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(213,0,0,0.14),transparent_70%)]" />
      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Ingresos</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">Tendencia mensual</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasData ? `${valueFormatter(total)} acumulados · pico ${valueFormatter(peak)}` : "Todavía no hay pagos para este período"}
          </p>
        </div>
        {toolbar}
      </div>

      <div className="relative h-56 rounded-[14px] border border-border/70 bg-muted/20 p-2 dark:bg-white/[0.025]">
        {!hasData ? (
          <div className="grid h-full place-items-center text-center">
            <p className="max-w-52 text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="mono-rounded-line-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D50000" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#D50000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "#D50000", strokeWidth: 1, strokeDasharray: "3 4" }}
                content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="rounded-xl border border-border bg-card/95 px-3 py-2.5 text-sm shadow-xl backdrop-blur dark:bg-zinc-950/95">
                    <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                    <p className="font-bold text-brand-600 dark:text-brand-400">{valueFormatter(Number(payload[0].value))}</p>
                  </div>
                ) : null}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#D50000"
                strokeWidth={3}
                strokeLinecap="round"
                fill="url(#mono-rounded-line-fill)"
                activeDot={{ r: 5, fill: "#D50000", stroke: "hsl(var(--card))", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
