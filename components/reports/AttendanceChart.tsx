"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface Props {
  /** Array of 24 numbers, index = hour 0-23 */
  byHour: number[]
}

export default function AttendanceChart({ byHour }: Props) {
  const max = Math.max(...byHour, 1)
  const data = byHour.map((count, h) => ({
    hour: `${h.toString().padStart(2, "0")}h`,
    count,
  }))

  const total = byHour.reduce((a, b) => a + b, 0)
  const peakHour = byHour.indexOf(max)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin registros de asistencia aún.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Total check-ins: </span>
          <span className="font-semibold text-foreground">{total.toLocaleString("es-AR")}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Horario pico: </span>
          <span className="font-semibold text-brand-500">{peakHour.toString().padStart(2, "0")}:00 hs</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval={2}
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
            formatter={(v) => [`${v} check-ins`, "Asistencias"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.count === max ? "hsl(var(--brand-500, 220 100% 60%))" : "hsl(var(--muted-foreground))"}
                fillOpacity={d.count === max ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
