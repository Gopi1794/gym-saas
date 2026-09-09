import { Check, Moon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

type DayStatus = "completed" | "missed" | "rest" | "today-pending" | "future";

interface Props {
  trainingDows: number[]; // 0=Mon ... 6=Sun; days that have exercises in the plan
  completedDows: number[]; // days this week where a session was completed
  todayDow: number;
}

function dayStatus(
  dow: number,
  todayDow: number,
  trainingDows: number[],
  completedDows: number[],
): DayStatus {
  const isTraining = trainingDows.includes(dow);
  const isCompleted = completedDows.includes(dow);
  const isPast = dow < todayDow;
  const isToday = dow === todayDow;

  if (isCompleted) return "completed";
  if (isToday && isTraining) return "today-pending";
  if (isToday && !isTraining) return "rest";
  if (isPast && isTraining) return "missed";
  if (isPast && !isTraining) return "rest";
  return "future";
}

function DayDot({ label, status }: { label: string; status: DayStatus }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-[transform,background-color,box-shadow] duration-200 ease-out active:scale-95",
          status === "completed" && "bg-emerald-500 shadow-[0_0_18px_rgba(52,211,153,0.3)]",
          status === "missed" && "bg-red-500/85",
          status === "rest" && "bg-zinc-800/70 text-zinc-500",
          status === "today-pending" &&
            "bg-emerald-500 ring-2 ring-emerald-400/40 shadow-[0_0_18px_rgba(52,211,153,0.35)]",
          status === "future" && "bg-zinc-800/45",
        )}
      >
        {status === "completed" && (
          <Check className="h-4 w-4 !text-white" strokeWidth={3} />
        )}
        {status === "missed" && (
          <X className="h-4 w-4 text-white" strokeWidth={3} />
        )}
        {status === "rest" && <Moon className="h-3.5 w-3.5 text-zinc-500" />}
        {status === "today-pending" && (
          <span className="h-2 w-2 rounded-full bg-white" />
        )}
        {status === "future" && null}
      </div>
      <span
        className={cn(
          "text-[11px] font-semibold",
          status === "today-pending" && "text-emerald-300",
          status === "completed" && "text-emerald-400/80",
          status === "missed" && "text-red-300/90",
          status === "rest" && "text-zinc-600",
          status === "future" && "text-zinc-700",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function WeeklyTrainingSummary({
  trainingDows,
  completedDows,
  todayDow,
}: Props) {
  // Stats: count only elapsed days (0...todayDow inclusive)
  const elapsedDays = todayDow + 1;
  const elapsedTraining = trainingDows.filter((d) => d <= todayDow).length;
  const elapsedRest = elapsedDays - elapsedTraining;
  const completedThisWeek = completedDows.filter((d) => d <= todayDow).length;

  const onTrackDays = completedThisWeek + elapsedRest;
  const onTrackPct =
    elapsedDays > 0 ? Math.round((onTrackDays / elapsedDays) * 100) : 100;

  const todayPending = trainingDows.includes(todayDow) && !completedDows.includes(todayDow)
  const pendingTrainingDays = Math.max(elapsedTraining - completedThisWeek, 0)
  const statusText = todayPending
    ? "Hoy toca entrenar"
    : pendingTrainingDays > 0
      ? `${pendingTrainingDays} pendiente${pendingTrainingDays === 1 ? "" : "s"}`
      : "Al día"

  return (
    <div className={cn(
      "rounded-2xl border bg-zinc-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      todayPending
        ? "border-emerald-500/40 animate-border-glow-green"
        : "border-brand-700/20"
    )}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm tracking-widest text-brand-500">
            Tu semana
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Rutina, descanso y progreso real.</p>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-black",
          todayPending ? "bg-emerald-500/15 text-emerald-300" : "bg-brand-700/15 text-brand-400"
        )}>
          {statusText}
        </span>
      </div>

      <div className="flex items-end justify-between">
        {DAY_SHORT.map((label, dow) => (
          <DayDot
            key={dow}
            label={label}
            status={dayStatus(dow, todayDow, trainingDows, completedDows)}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-brand-700/10 pt-3">
        <div className="rounded-xl bg-black/15 px-3 py-2">
          <p className="font-display text-2xl tabular-nums text-zinc-50">
            {completedThisWeek}
            <span className="font-sans text-sm font-medium text-zinc-500">
              /{elapsedTraining || trainingDows.length}
            </span>
          </p>
          <p className="font-heading text-[11px] tracking-wider text-zinc-500">Completados</p>
        </div>
        <div className="rounded-xl bg-black/15 px-3 py-2 text-right">
          <p className="font-display text-2xl tabular-nums text-brand-500">
            {onTrackPct}
            <span className="font-sans text-sm font-medium text-brand-700/60">%</span>
          </p>
          <p className="font-heading text-[11px] tracking-wider text-zinc-500">En camino</p>
        </div>
      </div>
    </div>
  );
}
