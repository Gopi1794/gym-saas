"use client"

import { useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
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
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-lg">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-emerald-400">{formatARS(payload[0].value)}</p>
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

    for (const p of payments) {
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const month = months.find((m) => m.key === key)
      if (month) month.total += p.amount
    }

    return months.map(({ label, total }) => ({ label, total }))
  }, [payments, range])

  const hasData = data.some((d) => d.total > 0)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Ingresos mensuales</h2>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 gap-0.5">
          {([3, 6, 12] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                range === r
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r}M
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        {!hasData ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            Sin datos de pagos aún
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
