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

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  const [
    { count: totalMembers },
    { count: todayCheckIns },
    { count: activeMembers },
    { count: totalCheckIns },
    { data: recentCheckIns },
    { data: leaderboardRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? ""),
    supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? "")
      .gte("checked_in_at", todayStr),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", p?.gym_id ?? "")
      .gte("membership_expires_at", today.toISOString()),
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
  ])

  // ── Member: fetch today's workout + weekly summary ──
  // JS getDay: 0=Sun → app dow: 0=Mon…6=Sun → (jsDay + 6) % 7
  const todayDow = (today.getDay() + 6) % 7
  let todayWorkout: { planName: string; dayName: string; exercises: { name: string; sets: number; reps: number }[] } | null = null
  let weeklySummary: { trainingDows: number[]; completedDows: number[] } | null = null
  let memberActivity: { completedThisWeek: number; trainingDaysThisWeek: number; totalSessions: number; streak: number } | null = null
  let recentBadges: RecentBadge[] | null = null

  if (p?.role === "member") {
    type PlanRow = { id: string; name: string }
    type DayRow = { workout_plan_exercises: { sets: number; reps: number; order_index: number; exercises: { name: string } }[] }
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
      // Monday of current week
      const jsDay = today.getDay()
      const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
      const monday = new Date(today)
      monday.setDate(today.getDate() + mondayOffset)
      monday.setHours(0, 0, 0, 0)

      type RecentSessionRow = { completed_at: string }

      const [{ data: todayDays }, { data: allPlanDays }, { data: weekSessions }, { count: totalSessions }, { data: recentSessions }] = await Promise.all([
        supabase
          .from("workout_plan_days" as never)
          .select("workout_plan_exercises(sets, reps, order_index, exercises(name))")
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
          .gte("completed_at", monday.toISOString()) as unknown as Promise<{ data: SessionRow[] | null }>,
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
        .map((pe) => ({ name: pe.exercises.name, sets: pe.sets, reps: pe.reps }))

      todayWorkout = { planName: plan.name, dayName: DAYS[today.getDay()], exercises }

      const trainingDows = (allPlanDays ?? [])
        .filter((d) => d.workout_plan_exercises.length > 0)
        .map((d) => d.day_of_week)

      const completedDows = [...new Set((weekSessions ?? []).map((s) => s.day_of_week))]

      weeklySummary = { trainingDows, completedDows }

      // Consecutive day streak
      const sessionDays = new Set((recentSessions ?? []).map((s) => s.completed_at.split("T")[0]))
      let streak = 0
      const cursor = new Date(today)
      cursor.setHours(0, 0, 0, 0)
      while (sessionDays.has(cursor.toISOString().split("T")[0])) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      }

      memberActivity = {
        completedThisWeek: completedDows.length,
        trainingDaysThisWeek: trainingDows.filter((d) => d <= todayDow).length,
        totalSessions: totalSessions ?? 0,
        streak,
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
  }

  const hour = today.getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"
  const firstName = p?.full_name?.split(" ")[0] ?? ""
  const dateLabel = `${DAYS[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`

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
            <p className="font-heading text-xs tracking-widest text-zinc-500 uppercase">{dateLabel}</p>
          </div>
        </div>
      </div>

      {/* Today's workout — members only */}
      {todayWorkout && (
        <TodayWorkoutCard
          planName={todayWorkout.planName}
          dayName={todayWorkout.dayName}
          exercises={todayWorkout.exercises}
          hasPlan
          gender={p?.gender}
        />
      )}

      {/* Weekly training summary — members only */}
      {weeklySummary && (
        <WeeklyTrainingSummary
          trainingDows={weeklySummary.trainingDows}
          completedDows={weeklySummary.completedDows}
          todayDow={todayDow}
        />
      )}

      {/* Featured card */}
      <FeaturedCard
        value={totalCheckIns ?? 0}
        label="Check-ins Totales"
        sublabel="Asistencias registradas en tu gimnasio"
        href="/check-in"
      />

      {/* Activity section */}
      {memberActivity ? (
        <div>
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
            />
            <ActivityCard label="Total" value={memberActivity.totalSessions} chart="bar" color="brand" />
            <ActivityCard label="Racha" value={memberActivity.streak} unit="días" chart="line" color="cyan" />
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Actividad</h2>
            <span className="text-xs font-medium text-brand-500">Hoy</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ActivityCard label="Miembros" value={totalMembers ?? 0} chart="ring" color="violet" />
            <ActivityCard label="Check-ins hoy" value={todayCheckIns ?? 0} chart="bar" color="cyan" />
            <ActivityCard label="Activos" value={activeMembers ?? 0} chart="line" color="emerald" />
          </div>
        </div>
      )}

      {/* Badge strip — members only */}
      {p?.role === "member" && (
        <BadgeStrip badges={recentBadges ?? []} />
      )}

      {/* Leaderboard */}
      <LeaderboardCard rows={leaderboardRows ?? []} viewerId={user!.id} />

      {/* Recent check-ins */}
      <RecentCheckIns checkIns={recentCheckIns ?? []} />
    </div>
  )
}
