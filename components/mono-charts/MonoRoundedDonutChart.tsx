"use client"

import { useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

// Adapted from Mono Charts (MIT): https://github.com/Subhan-code/Monocharts
export interface MonoDonutSegment {
  name: string
  value: number
}

interface MonoRoundedDonutChartProps {
  data: MonoDonutSegment[]
  centerValue: string
  centerLabel: string
  valueFormatter?: (value: number) => string
}

const fills = ["#D50000", "#71717a", "#a1a1aa", "#d4d4d8"]

export function MonoRoundedDonutChart({ data, centerValue, centerLabel, valueFormatter = String }: MonoRoundedDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <div className="h-44 rounded-[14px] border border-border/70 bg-muted/20 p-2 dark:bg-white/[0.025]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={6}
            cornerRadius={8}
            stroke="none"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((item, index) => (
              <Cell
                key={item.name}
                fill={fills[index % fills.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
              />
            ))}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" className="fill-foreground text-xl font-black">{centerValue}</text>
          <text x="50%" y="62%" textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{centerLabel}</text>
          <Tooltip
            content={({ active, payload }) => active && payload?.length ? (
              <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-sm shadow-xl backdrop-blur dark:bg-zinc-950/95">
                <p className="text-xs text-muted-foreground">{payload[0].name}</p>
                <p className="mt-1 font-bold text-foreground">{valueFormatter(Number(payload[0].value))}</p>
              </div>
            ) : null}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
