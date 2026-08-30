"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface PaymentRow {
  amount: number
  created_at: string
}

interface RevenueChartProps {
  payments: PaymentRow[]
}

type Range = 3 | 6 | 12

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2.5 text-sm shadow-xl backdrop-blur dark:bg-zinc-950/95">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-brand-600 dark:text-brand-400">{formatARS(payload[0].value)}</p>
    </div>
  )
}

export default function RevenueChart({ payments }: RevenueChartProps) {
  const [range, setRange] = useState<Range>(6)

  const data = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; total: number }[] = []

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        total: 0,
      })
    }

    for (const payment of payments) {
      const date = new Date(payment.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const month = months.find((item) => item.key === key)
      if (month) month.total += payment.amount
    }

    return months.map(({ label, total }) => ({ label, total }))
  }, [payments, range])

  const hasData = data.some((item) => item.total > 0)
  const total = data.reduce((sum, item) => sum + item.total, 0)
  const peak = Math.max(...data.map((item) => item.total), 0)

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-zinc-950/70 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(213,0,0,0.16),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,34,34,0.14),transparent_70%)]" />
      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Ingresos</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">Tendencia mensual</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasData ? `${formatARS(total)} acumulados · pico ${formatARS(peak)}` : "Todavía no hay pagos para este período"}
          </p>
        </div>
        <div className="flex rounded-xl border border-border bg-muted/50 p-1">
          {([3, 6, 12] as Range[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              aria-pressed={range === item}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                range === item
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {item}M
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-56">
        {!hasData ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-muted/20 text-center">
            <p className="max-w-48 text-sm text-muted-foreground">Cuando se aprueben pagos, vas a ver la evolución mensual acá.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D50000" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#D50000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#D50000", strokeWidth: 1, strokeDasharray: "3 4" }} />
              <Area type="monotone" dataKey="total" stroke="#D50000" strokeWidth={3} fill="url(#revenue-area)" activeDot={{ r: 5, fill: "#D50000", stroke: "hsl(var(--card))", strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
