"use client"

import { MonoRoundedBarChart } from "@/components/mono-charts/MonoRoundedBarChart"

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
      <MonoRoundedBarChart data={months.map(({ label, count }) => ({ label, value: count }))} valueLabel="socios" />
    </div>
  )
}
