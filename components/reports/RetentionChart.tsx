"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface Props {
  active: number
  expiring: number
  expired: number
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444"]
const LABELS = ["Activos", "Por vencer", "Vencidos"]

export default function RetentionChart({ active, expiring, expired }: Props) {
  const total = active + expiring + expired
  const data = [
    { name: "Activos",     value: active },
    { name: "Por vencer",  value: expiring },
    { name: "Vencidos",    value: expired },
  ].filter(d => d.value > 0)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin socios registrados.</p>
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Activos",    value: active,   color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Por vencer", value: expiring,  color: "text-amber-500",   bg: "bg-amber-500/10" },
          { label: "Vencidos",   value: expired,   color: "text-red-500",     bg: "bg-red-500/10" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl ${bg} px-4 py-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
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
              <Cell key={i} fill={COLORS[["Activos","Por vencer","Vencidos"].indexOf(data[i].name)]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`${v} socios (${Math.round(Number(v) / total * 100)}%)`, ""]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
