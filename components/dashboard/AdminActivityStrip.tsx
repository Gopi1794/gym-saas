interface AdminActivityStripProps {
  totalMembers: number
  activeMembers: number
  todayCheckIns: number
  checkInWeekData: number[]
  membersUpToDateRate: number
}

export default function AdminActivityStrip({
  totalMembers,
  activeMembers,
  todayCheckIns,
  checkInWeekData,
  membersUpToDateRate,
}: AdminActivityStripProps) {
  const maxCheckIns = Math.max(...checkInWeekData, 1)
  const coverage = Math.max(0, Math.min(membersUpToDateRate, 100))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Actividad</h2>
        <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Hoy</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="relative overflow-hidden rounded-[20px] border border-border bg-card p-4 shadow-sm dark:bg-zinc-950">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-r from-brand-600/10 via-transparent to-transparent" />
          <div className="relative flex h-full min-h-28 flex-col justify-between">
            <p className="text-xs font-medium text-muted-foreground">Socios</p>
            <div>
              <p className="text-3xl font-black tracking-tight text-foreground">{totalMembers.toLocaleString("es-AR")}</p>
              <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-brand-600 dark:text-brand-400">{activeMembers}</span> activos · {coverage}% al día</p>
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[20px] border border-border bg-card p-4 shadow-sm dark:bg-zinc-950">
          <div className="relative flex min-h-28 flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Check-ins</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{todayCheckIns.toLocaleString("es-AR")}</p>
              </div>
              <div className="flex h-12 w-24 items-end justify-end gap-1" aria-label="Check-ins de los últimos siete días">
                {checkInWeekData.map((value, index) => (
                  <span
                    key={index}
                    className="w-2 rounded-t-full bg-brand-600"
                    style={{ height: `${Math.max(4, Math.round((value / maxCheckIns) * 48))}px`, opacity: index === checkInWeekData.length - 1 ? 1 : 0.25 }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Últimos 7 días · <span className="font-semibold text-brand-600 dark:text-brand-400">hoy</span></p>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[20px] border border-border bg-card p-4 shadow-sm dark:bg-zinc-950">
          <div className="relative flex min-h-28 flex-col justify-between">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cobertura de membresías</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{coverage}%</p>
              </div>
              <p className="pb-1 text-xs font-medium text-muted-foreground"><span className="text-foreground">{activeMembers}</span> de {totalMembers}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${coverage}%` }} />
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
