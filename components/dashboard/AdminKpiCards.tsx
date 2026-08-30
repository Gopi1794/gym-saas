import { DollarSign, Users, UserPlus, BadgeCheck, type LucideIcon } from "lucide-react"

interface AdminKpiCardsProps {
  revenueThisMonth: number
  revenueSub: string
  activeMembers: number
  newMembersThisMonth: number
  membersUpToDateRate: number
}

const ACCENTS = {
  revenue: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
  members: "border-brand-500/25 bg-brand-500/10 text-brand-600 dark:text-brand-400",
  newMembers: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  upToDate: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub: string
  accent: keyof typeof ACCENTS
}) {
  const color = ACCENTS[accent]

  return (
    <article className="group relative isolate overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-lg dark:bg-zinc-950/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/55 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{value}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${color}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-3">
        <span className={`h-1.5 w-1.5 rounded-full ${color.split(" ")[1]}`} />
        <p className="min-w-0 text-xs text-muted-foreground">{sub}</p>
      </div>
    </article>
  )
}

export default function AdminKpiCards({
  revenueThisMonth,
  revenueSub,
  activeMembers,
  newMembersThisMonth,
  membersUpToDateRate,
}: AdminKpiCardsProps) {
  const revenueFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(revenueThisMonth)

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Pulso comercial</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">Este mes</h2>
        </div>
        <p className="text-xs text-muted-foreground">Actualizado hoy</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard icon={DollarSign} label="Ingresos" value={revenueFormatted} sub={revenueSub} accent="revenue" />
        <KpiCard icon={Users} label="Membresías activas" value={String(activeMembers)} sub="con vencimiento vigente hoy" accent="members" />
        <KpiCard icon={UserPlus} label="Nuevos miembros" value={String(newMembersThisMonth)} sub="altas registradas este mes" accent="newMembers" />
        <KpiCard icon={BadgeCheck} label="Socios al día" value={`${membersUpToDateRate}%`} sub="membresía vigente hoy" accent="upToDate" />
      </div>
    </section>
  )
}
