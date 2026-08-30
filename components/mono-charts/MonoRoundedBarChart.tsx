"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// Adapted from Mono Charts (MIT): https://github.com/Subhan-code/Monocharts
export interface MonoBarDatum {
  label: string
  value: number
}

interface MonoRoundedBarChartProps {
  data: MonoBarDatum[]
  valueLabel: string
  valueFormatter?: (value: number) => string
  interval?: number
}

export function MonoRoundedBarChart({ data, valueLabel, valueFormatter = String, interval }: MonoRoundedBarChartProps) {
  const maximum = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="h-52 rounded-[14px] border border-border/70 bg-muted/20 p-2 dark:bg-white/[0.025]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 2, left: -20, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval={interval}
          />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-sm shadow-xl backdrop-blur dark:bg-zinc-950/95">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-bold text-foreground">{valueFormatter(Number(payload[0].value))} {valueLabel}</p>
              </div>
            ) : null}
          />
          <Bar dataKey="value" radius={[8, 8, 8, 8]}>
            {data.map((item) => (
              <Cell key={item.label} fill="#D50000" fillOpacity={item.value === maximum ? 1 : 0.22} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
