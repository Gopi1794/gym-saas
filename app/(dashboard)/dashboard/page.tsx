import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"
import FeaturedCard from "@/components/dashboard/FeaturedCard"
import ActivityCard from "@/components/dashboard/ActivityCard"
import RecentCheckIns from "@/components/dashboard/RecentCheckIns"
import TodayWorkoutCard from "@/components/dashboard/TodayWorkoutCard"
import WeeklyTrainingSummary from "@/components/dashboard/WeeklyTrainingSummary"
import LeaderboardCard, { type LeaderboardRow } from "@/components/dashboard/LeaderboardCard"
import BadgeStrip, { type RecentBadge } from "@/components/dashboard/BadgeStrip"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import AdminKpiCards from "@/components/dashboard/AdminKpiCards"
import RevenueChart from "@/components/dashboard/RevenueChart"
import OnboardingTour from "@/components/onboarding/OnboardingTour"
import RenewMembershipCard from "@/components/dashboard/RenewMembershipCard"
import NutritionSummaryCard from "@/components/dashboard/NutritionSummaryCard"
import { getMemberNutritionPlan } from "@/app/actions/nutrition"
import { getNutritionStreak, getTodayConsumedMacros, getWaterToday } from "@/app/actions/nutrition-tracking"
import WeightReminderBanner from "@/components/dashboard/WeightReminderBanner"
import MonthlyTrainingCalendar from "@/components/dashboard/MonthlyTrainingCalendar"
import PersonalRecordsCard from "@/components/dashboard/PersonalRecordsCard"
import { todayAR, todayDateAR, hourAR, dayOfWeekAR, mondayOfWeekAR, firstOfMonthAR, firstOfMonthsAgoAR, daysAgoAR, startOfTodayAR } from "@/lib/date-ar"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Dashboard" }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single()

  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: user!.id, full_name: user!.user_metadata?.full_name ?? null } as never)
      .select("*")
      .single()
    profile = created
  }

  const p = profile as Profile | null

  // Fire-and-forget: crea notificaciones de membresía por vencer (idempotente)
  supabase.rpc("notify_expiring_memberships" as never).then(() => {})

  const todayStr = todayAR()
  const firstOfMonth = firstOfMonthAR()
  const twelveMonthsAgo = firstOfMonthsAgoAR(11)
  const sevenDaysAgo = daysAgoAR(6)

  const [
    { count: totalMembers },
    { count: todayCheckIns },
    { count: activeMembers },
    { count: totalCheckIns },
    { data: recentCheckIns },
    { data: leaderboardRows },
    { data: paymentsThisMonth },
    { count: newMembersThisMonth },
    { data: paymentsLast12Months },
    { data: checkInsLast7Days },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? ""),
    supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? "")
      .gte("checked_in_at", startOfTodayAR()),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? "")
      .gte("membership_expires_at", new Date().toISOString()),
    supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? ""),
    supabase
      .from("check_ins")
      .select("*, profiles(full_name, avatar_url, membership_type)")
      .eq("gym_id", p?.gym_id ?? "")
      .order("checked_in_at", { ascending: false })
      .limit(6),
    supabase
      .from("profiles" as never)
      .select("id, full_name, avatar_url, total_xp, user_achievements(count)")
      .eq("gym_id", p?.gym_id ?? "")
      .eq("role", "member")
      .order("total_xp", { ascending: false })
      .limit(10) as unknown as Promise<{ data: LeaderboardRow[] | null }>,
    supabase
      .from("payments")
      .select("amount")
      .eq("gym_id", p?.gym_id ?? "")
      .eq("status", "approved")
      .gte("created_at", firstOfMonth),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? "")
      .eq("role", "member")
      .gte("created_at", firstOfMonth),
    supabase
      .from("payments")
      .select("amount, created_at")
      .eq("gym_id", p?.gym_id ?? "")
      .eq("status", "approved")
      .gte("created_at", twelveMonthsAgo),
    supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("gym_id", p?.gym_id ?? "")
      .gte("checked_in_at", sevenDaysAgo),
  ])

  // ── Member: fetch today's workout + weekly summary ──
  // JS getDay: 0=Sun → app dow: 0=Mon…6=Sun → (jsDay + 6) % 7
  const todayDate = todayDateAR()
  const todayDow = (dayOfWeekAR() + 6) % 7
  let todayWorkout: { planName: string; dayName: string; exercises: { name: string; sets: number; reps: number }[] } | null = null
  let weeklySummary: { trainingDows: number[]; completedDows: number[] } | null = null
  let memberActivity: { completedThisWeek: number; trainingDaysThisWeek: number; totalSessions: number; streak: number; sessionsByWeek: number[]; recentDays: number[] } | null = null
  let recentBadges: RecentBadge[] | null = null
  let membershipPlans: { type: "basic" | "premium" | "vip"; label: string; price: number; duration_days: number; features: string[] }[] = []
  let memberNutritionPlan: Awaited<ReturnType<typeof getMemberNutritionPlan>> = null
  let nutritionStreak = 0
  let memberConsumed = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  let memberWaterGlasses = 0
  let daysSinceLastWeightLog: number | null = null
  let personalRecords: { exercise_name: string; weight_kg: number }[] = []
  let monthSessionDates: string[] = []

  if (p?.role === "member") {
    type PlanRow = { id: string; name: string }
    type DayRow = { workout_plan_exercises: { sets: number; reps: number; reps_max: number | null; order_index: number; duration_seconds: number | null; exercises: { name: string } }[] }
    type PlanDayRow = { day_of_week: number; workout_plan_exercises: { id: string }[] }
    type SessionRow = { day_of_week: number }

    const { data: plan } = await (supabase
      .from("workout_plans" as never)
      .select("id, name")
      .eq("assigned_to", user!.id)
      .eq("is_template", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as Promise<{ data: PlanRow | null }>)



    if (plan) {
      const jsDay = dayOfWeekAR()
      const monday = mondayOfWeekAR()

      type RecentSessionRow = { completed_at: string }

      const [{ data: todayDays }, { data: allPlanDays }, { data: weekSessions }, { count: totalSessions }, { data: recentSessions }] = await Promise.all([
        supabase
          .from("workout_plan_days" as never)
          .select("workout_plan_exercises(sets, reps, reps_max, order_index, duration_seconds, exercises(name))")
          .eq("plan_id", plan.id)
          .eq("day_of_week", todayDow) as unknown as Promise<{ data: DayRow[] | null }>,
        supabase
          .from("workout_plan_days" as never)
          .select("day_of_week, workout_plan_exercises(id)")
          .eq("plan_id", plan.id) as unknown as Promise<{ data: PlanDayRow[] | null }>,
        supabase
          .from("workout_sessions" as never)
          .select("day_of_week")
          .eq("user_id", user!.id)
          .gte("completed_at", monday) as unknown as Promise<{ data: SessionRow[] | null }>,
        supabase
          .from("workout_sessions" as never)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id) as unknown as Promise<{ count: number | null }>,
        supabase
          .from("workout_sessions" as never)
          .select("completed_at")
          .eq("user_id", user!.id)
          .order("completed_at", { ascending: false })
          .limit(60) as unknown as Promise<{ data: RecentSessionRow[] | null }>,
      ])


      const exercises = (todayDays ?? [])
        .flatMap((d) => d.workout_plan_exercises ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((pe) => ({ name: pe.exercises.name, sets: pe.sets, reps: pe.reps, reps_max: pe.reps_max, duration_seconds: pe.duration_seconds }))

      todayWorkout = { planName: plan.name, dayName: DAYS[dayOfWeekAR()], exercises }

      const trainingDows = (allPlanDays ?? [])
        .filter((d) => d.workout_plan_exercises.length > 0)
        .map((d) => d.day_of_week)

      const completedDows = [...new Set((weekSessions ?? []).map((s) => s.day_of_week))]

      weeklySummary = { trainingDows, completedDows }

      // Consecutive day streak
      const sessionDays = new Set((recentSessions ?? []).map((s) => s.completed_at.split("T")[0]))
      let streak = 0
      const cursor = new Date(`${todayAR()}T00:00:00Z`)
      while (sessionDays.has(cursor.toISOString().split("T")[0])) {
        streak++
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      }

      // Sessions per week for the last 7 weeks (bar chart)
      const daysToMonday = jsDay === 0 ? 6 : jsDay - 1
      const sessionsByWeek = Array.from({ length: 7 }, (_, wi) => {
        const wMonday = new Date(todayDate)
        wMonday.setDate(todayDate.getDate() - daysToMonday - (6 - wi) * 7)
        wMonday.setHours(0, 0, 0, 0)
        const wSunday = new Date(wMonday)
        wSunday.setDate(wMonday.getDate() + 7)
        return (recentSessions ?? []).filter(s => {
          const d = new Date(s.completed_at)
          return d >= wMonday && d < wSunday
        }).length
      })

      // Last 7 days: 1 = trained, 0 = not (line/sparkline chart)
      const recentDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(todayDate)
        day.setDate(todayDate.getDate() - (6 - i))
        const dayStr = day.toISOString().split("T")[0]
        return (recentSessions ?? []).some(s => s.completed_at.startsWith(dayStr)) ? 1 : 0
      })

      memberActivity = {
        completedThisWeek: completedDows.length,
        trainingDaysThisWeek: trainingDows.filter((d) => d <= todayDow).length,
        totalSessions: totalSessions ?? 0,
        streak,
        sessionsByWeek,
        recentDays,
      }
    }

    // Recent badges for BadgeStrip
    const { data: recentBadgesData } = await (supabase
      .from("user_achievements" as never)
      .select("id, earned_at, achievements(name, icon, description)")
      .eq("user_id", user!.id)
      .order("earned_at", { ascending: false })
      .limit(3) as unknown as Promise<{ data: RecentBadge[] | null }>)
    recentBadges = recentBadgesData

    // Nutrition plan + streak + today's consumed + water + last weight log
    const [nutritionPlan, streak, consumed, waterGlasses, lastWeightLog] = await Promise.all([
      getMemberNutritionPlan(user!.id),
      getNutritionStreak(user!.id),
      getTodayConsumedMacros(user!.id, todayStr),
      getWaterToday(user!.id),
      supabase
        .from("weight_logs" as never)
        .select("log_date")
        .eq("member_id", user!.id)
        .order("log_date", { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as Promise<{ data: { log_date: string } | null }>,
    ])
    memberNutritionPlan = nutritionPlan
    nutritionStreak = streak
    memberConsumed = consumed
    memberWaterGlasses = waterGlasses

    const lastLogDate = lastWeightLog.data?.log_date ?? null
    if (lastLogDate) {
      const diffMs = new Date(todayStr).getTime() - new Date(lastLogDate).getTime()
      daysSinceLastWeightLog = Math.floor(diffMs / 86_400_000)
    }

    // Fetch gym's configured membership plans (only when member may need renewal)
    const exp = p?.membership_expires_at
    const daysLeft = exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / 86_400_000) : null
    if (p?.gym_id && (daysLeft === null || daysLeft <= 7)) {
      const { data: plansData } = await (supabase
        .from("membership_plans" as never)
        .select("type, label, price, duration_days, features")
        .eq("gym_id", p.gym_id)
        .eq("is_active", true)
        .order("type") as unknown as Promise<{
          data: { type: "basic" | "premium" | "vip"; label: string; price: number; duration_days: number; features: string[] }[] | null
        }>)
      membershipPlans = plansData ?? []
    }

    // Personal records (latest max per exercise)
    const { data: maxesData } = await (supabase
      .from("exercise_maxes" as never)
      .select("weight_kg, exercises(name)")
      .eq("user_id", user!.id)
      .order("recorded_at", { ascending: false }) as unknown as Promise<{
        data: { weight_kg: number; exercises: { name: string } }[] | null
      }>)
    const seen = new Set<string>()
    personalRecords = (maxesData ?? []).reduce<{ exercise_name: string; weight_kg: number }[]>((acc, r) => {
      const name = r.exercises?.name ?? ""
      if (!seen.has(name)) { seen.add(name); acc.push({ exercise_name: name, weight_kg: Number(r.weight_kg) }) }
      return acc
    }, []).slice(0, 8)

    // Sessions this month for calendar
    const { data: monthSessions } = await (supabase
      .from("workout_sessions" as never)
      .select("completed_at")
      .eq("user_id", user!.id)
      .gte("completed_at", firstOfMonthAR()) as unknown as Promise<{ data: { completed_at: string }[] | null }>)
    monthSessionDates = (monthSessions ?? []).map(s => s.completed_at)
  }

  const revenueThisMonth = (paymentsThisMonth ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const renewalRate = activeMembers && activeMembers > 0
    ? Math.round(((paymentsThisMonth?.length ?? 0) / activeMembers) * 100)
    : 0

  // Admin chart data
  const adminMembersProgress = totalMembers ? (activeMembers ?? 0) / totalMembers : 0
  const checkInWeekData = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(todayDate)
    day.setDate(todayDate.getDate() - (6 - i))
    const dayStr = day.toISOString().split("T")[0]
    return (checkInsLast7Days ?? []).filter(ci => ci.checked_in_at.startsWith(dayStr)).length
  })
  const revenueTrend = Array.from({ length: 7 }, (_, i) => {
    const m = new Date(todayDate.getFullYear(), todayDate.getMonth() - (6 - i), 1)
    return (paymentsLast12Months ?? [])
      .filter(pay => { const d = new Date(pay.created_at); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear() })
      .reduce((sum, pay) => sum + (pay.amount ?? 0), 0)
  })

  const hour = hourAR()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"
  const firstName = p?.full_name?.split(" ")[0] ?? ""
  const dateLabel = `${DAYS[dayOfWeekAR()]}, ${todayDate.getDate()} ${MONTHS[todayDate.getMonth()]}`

  return (
    <div className="space-y-5 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <ProfileAvatar src={p?.avatar_url} name={p?.full_name} size={44} />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white leading-tight">
              {greeting}{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="font-heading text-xs tracking-widest text-zinc-900 dark:text-white/80 uppercase">{dateLabel}</p>
          </div>
        </div>
      </div>

      {/* Membership renewal — members expiring ≤7 days or already expired */}
      {p?.role === "member" && (() => {
        const exp = p.membership_expires_at
        const daysLeft = exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / 86_400_000) : null
        if (daysLeft === null || daysLeft <= 7) {
          return (
            <RenewMembershipCard
              expiresAt={exp}
              currentType={p.membership_type}
              plans={membershipPlans}
            />
          )
        }
        return null
      })()}

      {/* Weight reminder — members only, when > 7 days or never logged */}
      {p?.role === "member" && (
        <WeightReminderBanner daysSinceLastLog={daysSinceLastWeightLog} />
      )}

      {/* Today's workout — members only */}
      {todayWorkout && (
        <div data-tour="today-workout">
          <TodayWorkoutCard
            planName={todayWorkout.planName}
            dayName={todayWorkout.dayName}
            exercises={todayWorkout.exercises}
            hasPlan
            gender={p?.gender}
          />
        </div>
      )}

      {/* Weekly training summary — members only */}
      {weeklySummary && (
        <div data-tour="weekly-summary">
          <WeeklyTrainingSummary
            trainingDows={weeklySummary.trainingDows}
            completedDows={weeklySummary.completedDows}
            todayDow={todayDow}
          />
        </div>
      )}

      {/* Nutrition summary — members only */}
      {p?.role === "member" && (
        <NutritionSummaryCard plan={memberNutritionPlan} streak={nutritionStreak} consumed={memberConsumed} waterGlasses={memberWaterGlasses} />
      )}

      {/* KPI cards — admin only */}
      {p?.role !== "member" && (
        <>
          <div data-tour="kpi-cards">
            <AdminKpiCards
              revenueThisMonth={revenueThisMonth}
              activeMembers={activeMembers ?? 0}
              newMembersThisMonth={newMembersThisMonth ?? 0}
              renewalRate={renewalRate}
            />
          </div>
          <div data-tour="revenue-chart">
            <RevenueChart payments={paymentsLast12Months ?? []} />
          </div>
        </>
      )}

      {/* Featured card — admin/trainer only */}
      {p?.role !== "member" && (
        <FeaturedCard
          value={totalCheckIns ?? 0}
          label="Check-ins Totales"
          sublabel="Asistencias registradas en tu gimnasio"
          href="/check-in"
        />
      )}

      {/* Activity section */}
      {memberActivity ? (
        <div data-tour="activity-cards">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Mi actividad</h2>
            <span className="text-xs font-medium text-brand-500">Esta semana</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ActivityCard
              label="Esta semana"
              value={memberActivity.completedThisWeek}
              unit={memberActivity.trainingDaysThisWeek > 0 ? `/${memberActivity.trainingDaysThisWeek}` : undefined}
              chart="ring"
              color="emerald"
              progress={memberActivity.trainingDaysThisWeek > 0 ? memberActivity.completedThisWeek / memberActivity.trainingDaysThisWeek : 0}
            />
            <ActivityCard label="Total" value={memberActivity.totalSessions} chart="bar" color="brand" data={memberActivity.sessionsByWeek} />
            <ActivityCard label="Racha" value={memberActivity.streak} unit="días" chart="line" color="cyan" data={memberActivity.recentDays} />
          </div>
        </div>
      ) : p?.role !== "member" ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Actividad</h2>
            <span className="text-xs font-medium text-brand-500">Hoy</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ActivityCard label="Miembros" value={totalMembers ?? 0} chart="ring" color="violet" progress={adminMembersProgress} />
            <ActivityCard label="Check-ins hoy" value={todayCheckIns ?? 0} chart="bar" color="cyan" data={checkInWeekData} />
            <ActivityCard label="Activos" value={activeMembers ?? 0} chart="line" color="emerald" data={revenueTrend} />
          </div>
        </div>
      ) : null}

      {/* Badge strip — members only */}
      {p?.role === "member" && (
        <BadgeStrip badges={recentBadges ?? []} />
      )}

      {/* Member extras: peso, calendario, PRs */}
      {p?.role === "member" && (
        <>
          <MonthlyTrainingCalendar
            sessionDates={monthSessionDates}
            year={todayDate.getFullYear()}
            month={todayDate.getMonth()}
          />
          <PersonalRecordsCard records={personalRecords} />
        </>
      )}

      {/* Leaderboard */}
      <LeaderboardCard rows={leaderboardRows ?? []} viewerId={user!.id} />

      {/* Recent check-ins — admin/trainer only */}
      {p?.role !== "member" && (
        <div data-tour="recent-checkins">
          <RecentCheckIns checkIns={recentCheckIns ?? []} />
        </div>
      )}

      {/* Onboarding tour — solo en el primer login */}
      {!p?.onboarding_seen && p?.role && (
        <OnboardingTour role={p.role} />
      )}
    </div>
  )
}
