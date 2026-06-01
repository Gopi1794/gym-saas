import { Check, Moon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

type DayStatus = "completed" | "missed" | "rest" | "today-pending" | "future";

interface Props {
  trainingDows: number[]; // 0=Mon…6=Sun — days that have exercises in the plan
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
          "flex h-8 w-8 items-center justify-center rounded-full transition-all",
          status === "completed" && "bg-emerald-500",
          status === "missed" && "bg-red-500/80",
          status === "rest" && "bg-red-500/80",
          status === "today-pending" &&
            "bg-emerald-500 ring-2 ring-emerald-400/40",
          status === "future" && "bg-zinc-800/50",
        )}
      >
        {status === "completed" && (
          <Check className="h-4 w-4 !text-white" strokeWidth={3} />
        )}
        {status === "missed" && (
          <X className="h-4 w-4 text-white" strokeWidth={3} />
        )}
        {status === "rest" && <Moon className="h-3.5 w-3.5 text-white/80" />}
        {status === "today-pending" && (
          <span className="h-2 w-2 rounded-full bg-white" />
        )}
        {status === "future" && null}
      </div>
      <span
        className={cn(
          "text-[11px] font-semibold",
          status === "future" ? "text-zinc-700" : "text-zinc-500",
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
  // Stats — count only elapsed days (0…todayDow inclusive)
  const elapsedDays = todayDow + 1;
  const elapsedTraining = trainingDows.filter((d) => d <= todayDow).length;
  const elapsedRest = elapsedDays - elapsedTraining;
  const completedThisWeek = completedDows.filter((d) => d <= todayDow).length;

  const onTrackDays = completedThisWeek + elapsedRest;
  const onTrackPct =
    elapsedDays > 0 ? Math.round((onTrackDays / elapsedDays) * 100) : 100;

  const todayPending = trainingDows.includes(todayDow) && !completedDows.includes(todayDow)

  return (
    <div className={cn(
      "rounded-2xl border bg-zinc-900/60 p-4",
      todayPending
        ? "border-emerald-500/40 animate-border-glow-green"
        : "border-brand-700/20"
    )}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-sm tracking-widest text-brand-500">
          Tu semana
        </p>
        <span className="relative flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", todayPending ? "bg-emerald-400" : "bg-brand-500")} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", todayPending ? "bg-emerald-500" : "bg-brand-700")} />
        </span>
      </div>

      {/* Day dots */}
      <div className="flex items-end justify-between">
        {DAY_SHORT.map((label, dow) => (
          <DayDot
            key={dow}
            label={label}
            status={dayStatus(dow, todayDow, trainingDows, completedDows)}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-3 border-t border-brand-700/10 pt-3">
        <div className="flex-1">
          <p className="font-display text-2xl tabular-nums text-zinc-50">
            {completedThisWeek}
            <span className="font-sans text-sm font-medium text-zinc-500">
              /{elapsedTraining || trainingDows.length}
            </span>
          </p>
          <p className="font-heading text-xs tracking-wider text-zinc-500">Completados</p>
        </div>
        <div className="h-12 w-px bg-brand-700/15" />
        <div className="flex-1 text-right">
          <p className="font-display text-2xl tabular-nums text-brand-500">
            {onTrackPct}
            <span className="font-sans text-sm font-medium text-brand-700/60">%</span>
          </p>
          <p className="font-heading text-xs tracking-wider text-zinc-500">En camino</p>
        </div>
      </div>
    </div>
  );
}
