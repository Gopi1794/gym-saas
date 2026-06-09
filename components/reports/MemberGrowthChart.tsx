"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface Props {
  months: { label: string; count: number }[]
}

export default function MemberGrowthChart({ months }: Props) {
  const total = months.reduce((a, b) => a + b.count, 0)
  const max = Math.max(...months.map(m => m.count), 1)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin socios registrados en los últimos 6 meses.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Nuevos (6 meses): </span>
          <span className="font-semibold text-foreground">{total}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Mejor mes: </span>
          <span className="font-semibold text-brand-500">{months.find(m => m.count === max)?.label}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={months} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(v) => [`${v} socios`, "Nuevos"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {months.map((m, i) => (
              <Cell
                key={i}
                fill={m.count === max ? "#D50000" : "hsl(var(--muted-foreground))"}
                fillOpacity={m.count === max ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
