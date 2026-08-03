"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface Props {
  upToDate: number
  expiringSoon: number  // subconjunto de upToDate (vencen en ≤7 días) — informativo, no una porción propia del gráfico
  expired: number
}

const COLORS = ["#10b981", "#ef4444"]

export default function RetentionChart({ upToDate, expiringSoon, expired }: Props) {
  const total = upToDate + expired
  const data = [
    { name: "Al día",   value: upToDate },
    { name: "Vencidos", value: expired },
  ].filter(d => d.value > 0)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin socios registrados.</p>
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-2xl font-black text-emerald-500">{upToDate}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Al día</p>
          {expiringSoon > 0 && (
            <p className="text-[11px] text-amber-500 mt-1">{expiringSoon} vencen en ≤7 días</p>
          )}
        </div>
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-center">
          <p className="text-2xl font-black text-red-500">{expired}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Vencidos</p>
        </div>
      </div>

      {/* Donut */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[["Al día", "Vencidos"].indexOf(data[i].name)]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`${v} socios (${Math.round(Number(v) / total * 100)}%)`, ""]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
