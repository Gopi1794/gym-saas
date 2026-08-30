"use client"

import { useMemo, useState } from "react"
import { MonoRoundedLineChart } from "@/components/mono-charts/MonoRoundedLineChart"

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

export default function RevenueChart({ payments }: RevenueChartProps) {
  const [range, setRange] = useState<Range>(6)

  const data = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; value: number }[] = []

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        value: 0,
      })
    }

    for (const payment of payments) {
      const date = new Date(payment.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const month = months.find((item) => item.key === key)
      if (month) month.value += payment.amount
    }

    return months.map(({ label, value }) => ({ label, value }))
  }, [payments, range])

  return (
    <MonoRoundedLineChart
      data={data}
      valueFormatter={formatARS}
      emptyMessage="Cuando se aprueben pagos, vas a ver la evolución mensual acá."
      toolbar={
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
      }
    />
  )
}
