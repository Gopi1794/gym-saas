"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface Props {
  months: { label: string; count: number }[]
}

export default function MemberGrowthChart({ months }: Props) {
  const total = months.reduce((sum, month) => sum + month.count, 0)
  const max = Math.max(...months.map((month) => month.count), 1)
  const peak = months.find((month) => month.count === max)?.label

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin socios registrados en los últimos 6 meses.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <p className="text-muted-foreground">Altas <span className="font-bold text-foreground">{total}</span></p>
        <p className="text-muted-foreground">Mejor mes <span className="font-bold text-brand-600 dark:text-brand-400">{peak}</span></p>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(value) => [`${value} socios`, "Nuevos"]}
            />
            <Bar dataKey="count" radius={[999, 999, 999, 999]}>
              {months.map((month) => <Cell key={month.label} fill="#D50000" fillOpacity={month.count === max ? 1 : 0.22} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
