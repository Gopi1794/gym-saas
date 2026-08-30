"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface Props {
  byHour: number[]
}

export default function AttendanceChart({ byHour }: Props) {
  const max = Math.max(...byHour, 1)
  const data = byHour.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}h`,
    count,
  }))
  const total = byHour.reduce((sum, count) => sum + count, 0)
  const peakHour = byHour.indexOf(max)

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin registros de asistencia aún.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <p className="text-muted-foreground">Check-ins <span className="font-bold text-foreground">{total.toLocaleString("es-AR")}</span></p>
        <p className="text-muted-foreground">Horario pico <span className="font-bold text-brand-600 dark:text-brand-400">{peakHour.toString().padStart(2, "0")}:00</span></p>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="16%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(value) => [`${value} check-ins`, "Asistencias"]}
            />
            <Bar dataKey="count" radius={[999, 999, 999, 999]}>
              {data.map((item) => <Cell key={item.hour} fill="#D50000" fillOpacity={item.count === max ? 1 : 0.22} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
