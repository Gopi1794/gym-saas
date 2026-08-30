"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface Props {
  byDay: number[]
}

export default function PeakDaysChart({ byDay }: Props) {
  const max = Math.max(...byDay, 1)
  const data = byDay.map((count, index) => ({ day: DAYS[index], count }))
  const total = byDay.reduce((sum, count) => sum + count, 0)
  const peakIndex = byDay.indexOf(max)

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin registros aún.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <p className="text-muted-foreground">Día pico <span className="font-bold text-brand-600 dark:text-brand-400">{DAYS[peakIndex]}</span></p>
        <p className="text-muted-foreground">Asistencias <span className="font-bold text-foreground">{max}</span></p>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(value) => [`${value} check-ins`, "Asistencias"]}
            />
            <Bar dataKey="count" radius={[8, 8, 8, 8]}>
              {data.map((item) => <Cell key={item.day} fill="#D50000" fillOpacity={item.count === max ? 1 : 0.22} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
