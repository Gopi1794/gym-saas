import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import RetentionChart from "@/components/reports/RetentionChart"
import ChurnList from "@/components/reports/ChurnList"
import AttendanceChart from "@/components/reports/AttendanceChart"
import PeakDaysChart from "@/components/reports/PeakDaysChart"
import RevenueComparisonCard from "@/components/reports/RevenueComparisonCard"
import ProductKpiCards from "@/components/reports/ProductKpiCards"
import MemberGrowthChart from "@/components/reports/MemberGrowthChart"
import AtRiskList, { type AtRiskMember } from "@/components/reports/AtRiskList"
import { firstOfMonthsAgoAR, daysAgoAR, todayDateAR } from "@/lib/date-ar"
import { computeMonthToDateRevenue } from "@/lib/revenue"
import { getProductReport } from "@/app/actions/products"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Reportes" }

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles").select("role, gym_id").eq("id", user!.id).single()

  if ((profile as any)?.role !== "admin") redirect("/dashboard")
  const gymId = (profile as any).gym_id as string
  if (!gymId) redirect("/dashboard")

  const now = new Date()
  const todayDate = todayDateAR()
  const ninetyDaysAgo = daysAgoAR(89)
  const thirtyDaysAgo = daysAgoAR(29)
  const firstOfLastMonth = firstOfMonthsAgoAR(1)
  const _firstOf6MonthsAgo = firstOfMonthsAgoAR(5)
  const productReportResult = await getProductReport()

  const [
    { data: members },
    { data: checkIns },
    { data: recentCheckIns },
    { data: paymentsThisAndLastMonth },
    { data: renewalPayments },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, membership_type, membership_expires_at, created_at")
      .eq("gym_id", gymId)
      .eq("role", "member"),

    supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("gym_id", gymId)
      .gte("checked_in_at", ninetyDaysAgo),

    supabase
      .from("check_ins")
      .select("user_id, checked_in_at")
      .eq("gym_id", gymId)
      .gte("checked_in_at", thirtyDaysAgo),

    // Cubre "este mes" y "mismo tramo del mes pasado" en un solo query —
    // computeMonthToDateRevenue hace el resto.
    supabase
      .from("payments")
      .select("amount, created_at")
      .eq("gym_id", gymId)
      .eq("status", "approved")
      .gte("created_at", firstOfLastMonth),

    supabase
      .from("payments")
      .select("member_id, created_at")
      .eq("gym_id", gymId)
      .eq("status", "approved")
      .gte("created_at", ninetyDaysAgo),
  ])

  // ── Socios al día ── mismo corte que activeMembers del dashboard:
  // membership_expires_at >= ahora cuenta como al día, "por vencer" es un
  // subconjunto informativo de "al día", no una categoría que le resta.
  const upToDate = (members ?? []).filter(m => m.membership_expires_at && new Date(m.membership_expires_at) >= now).length
  const expiringSoon = (members ?? []).filter(m => m.membership_expires_at && new Date(m.membership_expires_at) >= now && Math.ceil((new Date(m.membership_expires_at).getTime() - now.getTime()) / 86_400_000) <= 7).length
  const expired = (members ?? []).filter(m => !m.membership_expires_at || new Date(m.membership_expires_at) < now).length

  // ── Churn ──
  const churned = (members ?? [])
    .filter(m => m.membership_expires_at && new Date(m.membership_expires_at) <= now && new Date(m.membership_expires_at) >= new Date(ninetyDaysAgo))
    .sort((a, b) => new Date(b.membership_expires_at!).getTime() - new Date(a.membership_expires_at!).getTime())

  // ── Asistencia por horario y día de semana (AR timezone) ──
  const byHour = Array(24).fill(0) as number[]
  const byDay  = Array(7).fill(0) as number[]  // 0=Mon … 6=Sun
  for (const ci of checkIns ?? []) {
    const d = new Date(ci.checked_in_at)
    const hStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hour12: false }).format(d)
    const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short" }).format(d)
    const h = parseInt(hStr) % 24
    byHour[h]++
    const jsDay = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dayStr)
    const monIdx = (jsDay + 6) % 7
    byDay[monIdx]++
  }

  // ── Ingresos: este mes vs mismo tramo del mes pasado ──
  const revenueComparison = computeMonthToDateRevenue(paymentsThisAndLastMonth ?? [], todayDate)
  const revenueThisMonth = revenueComparison.thisMonthToDate
  const revenueLastMonth = revenueComparison.sameTramoLastMonth

  // ── Nuevos socios últimos 6 meses ──
  const memberGrowth = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - (5 - i), 1)
    const m = monthDate.getMonth()
    const y = monthDate.getFullYear()
    const count = (members ?? []).filter(mem => {
      const d = new Date(mem.created_at)
      return d.getMonth() === m && d.getFullYear() === y
    }).length
    return { label: `${MONTH_LABELS[m]} ${String(y).slice(2)}`, count }
  })

  // ── Socios en riesgo (activos sin asistir 14+ días) ──
  const fourteenDaysAgoMs = Date.now() - 14 * 86_400_000
  const checkedInLast14 = new Set(
    (recentCheckIns ?? [])
      .filter(ci => new Date(ci.checked_in_at).getTime() >= fourteenDaysAgoMs)
      .map(ci => ci.user_id)
  )
  const lastCheckInByMember = new Map<string, string>()
  for (const ci of recentCheckIns ?? []) {
    const prev = lastCheckInByMember.get(ci.user_id)
    if (!prev || ci.checked_in_at > prev) lastCheckInByMember.set(ci.user_id, ci.checked_in_at)
  }
  const atRisk: AtRiskMember[] = (members ?? [])
    .filter(m => m.membership_expires_at && new Date(m.membership_expires_at) > now)
    .filter(m => !checkedInLast14.has(m.id))
    .map(m => {
      const last = lastCheckInByMember.get(m.id) ?? null
      const daysAgo = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null
      return { id: m.id, full_name: m.full_name, avatar_url: m.avatar_url, daysAgo }
    })
    .sort((a, b) => (b.daysAgo ?? 999) - (a.daysAgo ?? 999))
    .slice(0, 10)

  // ── Frecuencia promedio semanal ──
  const activeCount = upToDate
  const avgVisitsPerWeek = activeCount > 0
    ? Math.round(((recentCheckIns ?? []).length / activeCount / 30) * 7 * 10) / 10
    : 0

  // ── Retención: de los que vencieron en los últimos 90 días, cuántos volvieron a pagar ──
  const renewalPaymentUsers = new Map<string, string>()
  for (const p of renewalPayments ?? []) renewalPaymentUsers.set(p.member_id, p.created_at)
  const churnedWithRenewal = churned.filter(m =>
    renewalPaymentUsers.has(m.id) &&
    new Date(renewalPaymentUsers.get(m.id)!) > new Date(m.membership_expires_at!)
  ).length
  const retentionRate = churned.length > 0 ? Math.round((churnedWithRenewal / churned.length) * 100) : null

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Reportes</h1>
        <p className="text-muted-foreground">Métricas clave de tu gimnasio</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Socios activos</p>
          <p className="text-3xl font-black text-foreground leading-none">{activeCount}</p>
          <p className="text-xs text-muted-foreground">de {(members ?? []).length} totales</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Visitas / semana</p>
          <p className="text-3xl font-black text-brand-500 leading-none">{avgVisitsPerWeek}</p>
          <p className="text-xs text-muted-foreground">promedio por socio</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Retención</p>
          <p className="text-3xl font-black text-foreground leading-none">
            {retentionRate !== null ? `${retentionRate}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">vencidos hace ≤90 días que volvieron a pagar</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">En riesgo</p>
          <p className={`text-3xl font-black leading-none ${atRisk.length > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {atRisk.length}
          </p>
          <p className="text-xs text-muted-foreground">sin asistir 14+ días</p>
        </div>
      </div>

      <ProductKpiCards report={productReportResult.report ?? { revenue: 0, margin: 0, units: 0, topProducts: [], byMethod: { cash: 0, mercadopago: 0, transfer: 0, card: 0, other: 0 }, bySeller: [], lowStock: [] }} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Socios al día */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Socios al día</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Estado actual de las membresías</p>
          </div>
          <RetentionChart upToDate={upToDate} expiringSoon={expiringSoon} expired={expired} />
        </div>

        {/* Días pico */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Días pico</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Asistencia por día de la semana (últimos 90 días)</p>
          </div>
          <PeakDaysChart byDay={byDay} />
        </div>

        {/* Asistencia por horario */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Horarios pico</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Distribución de check-ins a lo largo del día</p>
          </div>
          <AttendanceChart byHour={byHour} />
        </div>

        {/* Ingresos */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Ingresos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Este mes vs mes anterior</p>
          </div>
          <RevenueComparisonCard
            thisMonth={revenueThisMonth}
            lastMonth={revenueLastMonth}
            daysIntoMonth={revenueComparison.daysIntoMonth}
            isFullMonth={revenueComparison.isFullMonth}
          />
        </div>

        {/* Nuevos socios */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Nuevos socios</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Altas de los últimos 6 meses</p>
          </div>
          <MemberGrowthChart months={memberGrowth} />
        </div>

        {/* En riesgo */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Socios en riesgo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Activos sin asistir en los últimos 14 días</p>
          </div>
          <AtRiskList members={atRisk} />
        </div>

        {/* Churn */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Churn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Socios cuya membresía venció y no renovaron</p>
          </div>
          <ChurnList members={churned as any} />
        </div>
      </div>
    </div>
  )
}



