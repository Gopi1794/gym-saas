import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  ArrowLeft, Dumbbell, User, Phone, AlertTriangle,
  Target, Calendar, Clock, QrCode, Hand, CheckCircle2,
  XCircle, Zap, Activity, CreditCard,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { isMembershipActive } from "@/lib/utils"
import PlanCard from "@/components/planes/PlanCard"
import CreatePlanForMember from "@/components/members/CreatePlanForMember"
import MemberPhysicalEdit from "@/components/members/MemberPhysicalEdit"
import MemberMembershipEdit from "@/components/members/MemberMembershipEdit"
import MemberTrainerEdit from "@/components/members/MemberTrainerEdit"
import MemberWorkoutHistory from "@/components/members/MemberWorkoutHistory"
import { cn } from "@/lib/utils"

interface Props { params: { id: string } }

type MemberRow = {
  id: string; full_name: string | null; avatar_url: string | null
  role: string; membership_type: string | null; membership_expires_at: string | null
  weight_kg: number | null; height_cm: number | null
  phone: string | null; date_of_birth: string | null
  emergency_name: string | null; emergency_phone: string | null
  goal: string | null; medical_conditions: string | null
  training_frequency: string | null; total_xp: number; created_at: string
  trainer_id: string | null
}

type PlanRow = {
  id: string; name: string; description: string | null; created_at: string; assigned_to: string | null
  workout_plan_days: { id: string; day_of_week: number; workout_plan_exercises: { id: string }[] }[]
}

type CheckInRow = { id: string; checked_in_at: string; checked_out_at: string | null; method: "qr" | "manual" }
type PaymentRow = { id: string; amount: number; status: string; created_at: string; mp_payment_id: string | null }
type SessionSetRow = { exercise_name: string; set_number: number; actual_reps: number | null; planned_reps: number | null; reps: number | null; weight_kg: number | null }
type SessionRow = { id: string; day_name: string; completed_at: string; exercises_count: number; workout_session_sets: SessionSetRow[] }

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Bajar de peso",
  gain_muscle: "Ganar músculo",
  performance: "Mejorar rendimiento",
  maintain: "Mantenerme",
}

const FREQ_LABELS: Record<string, string> = {
  never: "Nunca entrené",
  "1-2": "1-2 veces/sem",
  "3-4": "3-4 veces/sem",
  "5+": "5+ veces/sem",
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Aprobado",   cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" },
  pending:   { label: "Pendiente",  cls: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" },
  rejected:  { label: "Rechazado",  cls: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10" },
  cancelled: { label: "Cancelado",  cls: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800" },
  refunded:  { label: "Reembolsado", cls: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800" },
  cash:      { label: "Efectivo",   cls: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default async function MemberDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentProfile } = await supabase
    .from("profiles").select("role, gym_id").eq("id", user!.id).single()

  const profile = currentProfile as { role: string; gym_id: string | null } | null
  const role = profile?.role ?? ""
  const gymId = profile?.gym_id ?? null
  if (!["admin", "trainer"].includes(role)) redirect("/dashboard")
  if (!gymId) redirect("/dashboard")

  const { data: rawMember } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, membership_type, membership_expires_at, weight_kg, height_cm, phone, date_of_birth, emergency_name, emergency_phone, goal, medical_conditions, training_frequency, total_xp, created_at, trainer_id")
    .eq("id", params.id)
    .eq("gym_id", gymId)
    .single() as unknown as { data: MemberRow | null }

  if (!rawMember) notFound()
  const member = rawMember

  const planSelect = `id, name, description, created_at, assigned_to, workout_plan_days(id, day_of_week, workout_plan_exercises(id))`

  const [
    { data: rawPlan },
    { data: membershipPlans },
    { data: recentCheckIns },
    { count: totalCheckIns },
    { data: recentPayments },
    { data: gymTrainers },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from("workout_plans" as never).select(planSelect)
      .eq("assigned_to", params.id).eq("is_template", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle() as unknown as Promise<{ data: PlanRow | null }>,

    supabase.from("membership_plans" as never).select("type, price, duration_days, is_active")
      .eq("gym_id", gymId) as unknown as Promise<{ data: { type: "basic"|"premium"|"vip"; price: number; duration_days: number; is_active: boolean }[] | null }>,

    supabase.from("check_ins").select("id, checked_in_at, checked_out_at, method")
      .eq("user_id", params.id).eq("gym_id", gymId)
      .order("checked_in_at", { ascending: false }).limit(6) as unknown as Promise<{ data: CheckInRow[] | null }>,

    supabase.from("check_ins").select("*", { count: "exact", head: true })
      .eq("user_id", params.id).eq("gym_id", gymId),

    supabase.from("payments").select("id, amount, status, created_at, mp_payment_id")
      .eq("member_id", params.id).eq("gym_id", gymId)
      .order("created_at", { ascending: false }).limit(5) as unknown as Promise<{ data: PaymentRow[] | null }>,

    supabase.from("profiles").select("id, full_name, avatar_url")
      .eq("gym_id", gymId).eq("role", "trainer")
      .order("full_name") as unknown as Promise<{ data: { id: string; full_name: string | null; avatar_url: string | null }[] | null }>,

    supabase.from("workout_sessions" as never)
      .select("id, day_name, completed_at, exercises_count, workout_session_sets(exercise_name, set_number, actual_reps, planned_reps, reps, weight_kg)")
      .eq("user_id", params.id)
      .order("completed_at", { ascending: false })
      .limit(5) as unknown as Promise<{ data: SessionRow[] | null }>,
  ])

  const memberName = member.full_name ?? "Miembro"
  const active = isMembershipActive(member.membership_expires_at)
  const lastVisit = recentCheckIns?.[0]?.checked_in_at ?? null

  return (
    <div className="space-y-6 pb-8">
      <Link href="/members" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Volver a miembros
      </Link>

      {/* Header */}
      <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={member.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">
            <User className="h-7 w-7 text-zinc-400" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{memberName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Miembro desde {formatDate(member.created_at)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">{member.role}</Badge>
            <Badge variant="outline" className={
              member.membership_type === "vip"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : member.membership_type === "premium"
                ? "border-brand-700/30 bg-brand-700/10 text-brand-600 dark:text-brand-400"
                : "border-zinc-300 dark:border-zinc-600/30 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }>
              {member.membership_type ?? "basic"}
            </Badge>
            <Badge variant={active ? "success" : "secondary"}>
              {active ? "Activo" : "Vencido"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <Activity className="h-4 w-4 text-brand-500" />,
            label: "Asistencias",
            value: String(totalCheckIns ?? 0),
          },
          {
            icon: <Clock className="h-4 w-4 text-blue-500" />,
            label: "Última visita",
            value: lastVisit ? new Date(lastVisit).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "—",
          },
          {
            icon: <Zap className="h-4 w-4 text-amber-500" />,
            label: "XP total",
            value: member.total_xp.toLocaleString("es-AR"),
          },
          {
            icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
            label: "Pagos",
            value: String(recentPayments?.filter(p => p.status === "approved" || p.status === "cash").length ?? 0),
          },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
            <p className="text-xl font-black text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Membership + Physical */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MemberMembershipEdit
          memberId={params.id}
          initialType={member.membership_type as "basic" | "premium" | "vip" | null}
          initialExpiresAt={member.membership_expires_at}
          plans={membershipPlans ?? []}
        />
        <MemberPhysicalEdit
          memberId={params.id}
          initialWeight={member.weight_kg}
          initialHeight={member.height_cm}
        />
      </div>

      {/* Trainer assignment — solo admins */}
      {role === "admin" && (
        <MemberTrainerEdit
          memberId={params.id}
          initialTrainerId={member.trainer_id}
          trainers={gymTrainers ?? []}
        />
      )}

      {/* Contact & profile info */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Datos de contacto</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoCell icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={member.phone ?? "—"} />
          <InfoCell icon={<Calendar className="h-3.5 w-3.5" />} label="Nacimiento"
            value={member.date_of_birth ? formatDate(member.date_of_birth) : "—"} />
          <InfoCell icon={<Target className="h-3.5 w-3.5" />} label="Objetivo"
            value={member.goal ? (GOAL_LABELS[member.goal] ?? member.goal) : "—"} />
          <InfoCell icon={<Activity className="h-3.5 w-3.5" />} label="Frecuencia"
            value={member.training_frequency ? (FREQ_LABELS[member.training_frequency] ?? member.training_frequency) : "—"} />
          <InfoCell icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Contacto emergencia"
            value={member.emergency_name ? `${member.emergency_name}${member.emergency_phone ? ` · ${member.emergency_phone}` : ""}` : "—"}
            span={2} />
        </div>
        {member.medical_conditions && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Condiciones médicas</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{member.medical_conditions}</p>
          </div>
        )}
      </div>

      {/* Recent check-ins */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Asistencia reciente</h3>
        {!recentCheckIns?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin registros de asistencia</p>
        ) : (
          <ul className="space-y-2">
            {recentCheckIns.map(ci => (
              <li key={ci.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {ci.method === "qr"
                    ? <QrCode className="h-4 w-4 text-blue-500 shrink-0" />
                    : <Hand className="h-4 w-4 text-zinc-400 shrink-0" />}
                  <span className="text-sm text-foreground">{formatDateTime(ci.checked_in_at)}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{ci.method}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payment history */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pagos recientes</h3>
        {!recentPayments?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin historial de pagos</p>
        ) : (
          <ul className="space-y-2">
            {recentPayments.map(p => {
              const st = PAYMENT_STATUS[p.status] ?? { label: p.status, cls: "text-zinc-400 bg-zinc-800" }
              return (
                <li key={p.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {p.status === "approved"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-zinc-400 shrink-0" />}
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        ${Number(p.amount).toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", st.cls)}>
                    {st.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Workout history */}
      {recentSessions && recentSessions.length > 0 && (
        <MemberWorkoutHistory
          sessions={recentSessions.map(s => ({
            id: s.id,
            day_name: s.day_name,
            completed_at: s.completed_at,
            sets: s.workout_session_sets.map(set => ({
              exercise_name: set.exercise_name,
              set_number: set.set_number,
              actual_reps: set.actual_reps ?? set.reps,
              planned_reps: set.planned_reps,
              weight_kg: set.weight_kg,
            })),
          }))}
          member={{ goal: member.goal, training_frequency: member.training_frequency }}
        />
      )}

      {/* Workout plan */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plan de entrenamiento</h2>
            <p className="text-sm text-muted-foreground">
              {rawPlan ? "Plan asignado actualmente" : "Este miembro no tiene un plan asignado"}
            </p>
          </div>
          {!rawPlan && (
            <CreatePlanForMember memberId={params.id} memberName={memberName} trainerId={user!.id} gymId={gymId} />
          )}
        </div>

        {rawPlan ? (
          <div className="max-w-sm">
            <PlanCard plan={rawPlan} isTemplate={false} trainerId={user!.id} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Creá un plan personalizado para {memberName}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCell({ icon, label, value, span }: { icon: React.ReactNode; label: string; value: string; span?: number }) {
  return (
    <div className={cn("rounded-xl bg-muted/50 px-4 py-3 space-y-1", span === 2 && "col-span-2")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
