"use client"

import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

interface Props {
  upToDate: number
  expiringSoon: number
  expired: number
}

const COLORS = ["#D50000", "#71717a"]

export default function RetentionChart({ upToDate, expiringSoon, expired }: Props) {
  const total = upToDate + expired
  const data = [
    { name: "Al día", value: upToDate },
    { name: "Vencidos", value: expired },
  ].filter((item) => item.value > 0)

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin socios registrados.</p>
  }

  const rate = Math.round((upToDate / total) * 100)

  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_190px]">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 px-4 py-3">
          <p className="text-2xl font-black tracking-tight text-brand-600 dark:text-brand-400">{upToDate}</p>
          <p className="mt-1 text-xs font-medium text-foreground">Al día</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{expiringSoon > 0 ? `${expiringSoon} vencen esta semana` : "sin vencimientos próximos"}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/35 px-4 py-3">
          <p className="text-2xl font-black tracking-tight text-foreground">{expired}</p>
          <p className="mt-1 text-xs font-medium text-foreground">Vencidos</p>
          <p className="mt-1 text-[11px] text-muted-foreground">requieren seguimiento</p>
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={5} cornerRadius={8} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={COLORS[item.name === "Al día" ? 0 : 1]} />)}
              <Label value={`${rate}%`} position="center" className="fill-foreground text-xl font-black" />
              <Label value="al día" position="center" dy={18} className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider" />
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} socios`, ""]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
