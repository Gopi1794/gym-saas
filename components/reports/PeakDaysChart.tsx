"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface Props {
  byDay: number[]
}

export default function PeakDaysChart({ byDay }: Props) {
  const max = Math.max(...byDay, 1)
  const data = byDay.map((count, i) => ({ day: DAYS[i], count }))
  const total = byDay.reduce((a, b) => a + b, 0)
  const peakIdx = byDay.indexOf(max)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin registros aún.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Día pico: </span>
          <span className="font-semibold text-brand-500">{DAYS[peakIdx]}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Asistencias: </span>
          <span className="font-semibold text-foreground">{max}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
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
            formatter={(v) => [`${v} check-ins`, "Asistencias"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.count === max ? "#D50000" : "hsl(var(--muted-foreground))"}
                fillOpacity={d.count === max ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
