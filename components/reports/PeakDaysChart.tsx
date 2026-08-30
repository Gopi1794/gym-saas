"use client"

import { MonoRoundedBarChart } from "@/components/mono-charts/MonoRoundedBarChart"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface Props {
  byDay: number[]
}

export default function PeakDaysChart({ byDay }: Props) {
  const max = Math.max(...byDay, 1)
  const data = byDay.map((value, index) => ({ label: DAYS[index], value }))
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
      <MonoRoundedBarChart data={data} valueLabel="check-ins" />
    </div>
  )
}
