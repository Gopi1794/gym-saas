"use client"

import { MonoRoundedBarChart } from "@/components/mono-charts/MonoRoundedBarChart"

interface Props {
  byHour: number[]
}

export default function AttendanceChart({ byHour }: Props) {
  const max = Math.max(...byHour, 1)
  const data = byHour.map((value, hour) => ({ label: `${hour.toString().padStart(2, "0")}h`, value }))
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
      <MonoRoundedBarChart data={data} valueLabel="check-ins" interval={2} />
    </div>
  )
}
