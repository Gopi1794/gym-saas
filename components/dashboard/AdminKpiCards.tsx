import { DollarSign, Users, UserPlus, RefreshCw } from "lucide-react"

interface AdminKpiCardsProps {
  revenueThisMonth: number
  activeMembers: number
  newMembersThisMonth: number
  renewalRate: number
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: "emerald" | "brand" | "cyan" | "amber"
}) {
  const colors = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    brand:   { bg: "bg-brand-500/10",   text: "text-brand-400",   border: "border-brand-500/20" },
    cyan:    { bg: "bg-cyan-500/10",     text: "text-cyan-400",    border: "border-cyan-500/20" },
    amber:   { bg: "bg-amber-500/10",    text: "text-amber-400",   border: "border-amber-500/20" },
  }
  const c = colors[color]

  return (
    <div
      className={`rounded-xl border ${c.border} bg-zinc-900/60 p-4 space-y-3`}
      aria-label={`${label}: ${value}`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} aria-hidden />
      </div>
      <div>
        <p className="text-xl font-bold text-zinc-100 leading-none">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
      </div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
    </div>
  )
}

export default function AdminKpiCards({
  revenueThisMonth,
  activeMembers,
  newMembersThisMonth,
  renewalRate,
}: AdminKpiCardsProps) {
  const revenueFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(revenueThisMonth)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Este mes</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={DollarSign}
          label="Ingresos del mes"
          value={revenueFormatted}
          color="emerald"
        />
        <KpiCard
          icon={Users}
          label="Membresías activas"
          value={String(activeMembers)}
          color="brand"
        />
        <KpiCard
          icon={UserPlus}
          label="Nuevos miembros"
          value={String(newMembersThisMonth)}
          sub="este mes"
          color="cyan"
        />
        <KpiCard
          icon={RefreshCw}
          label="Tasa de renovación"
          value={`${renewalRate}%`}
          sub="pagos aprobados / activos"
          color="amber"
        />
      </div>
    </div>
  )
}
