"use client";

import { motion } from "framer-motion";
import { Check, CheckCircle2, Lock, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInstantAR } from "@/lib/date-ar";
import { describeCondition, formatCount } from "@/lib/achievements/describe";
import {
  formatProgress,
  formatProgressValue,
  type AchievementProgress,
} from "@/lib/achievements/progress";
import type { Achievement } from "@/types";
import AchievementMedal from "./AchievementMedal";

type Props = {
  // The condition and the reward are optional: callers that only know the
  // name/icon (dashboard strip) still render, without those blocks.
  achievement: Pick<Achievement, "id" | "name" | "description" | "icon"> &
    Partial<Pick<Achievement, "xp_reward" | "condition_type" | "condition_value" | "condition_target">>;
  variant: "earned" | "locked" | "just-earned" | "compact-earned" | "compact-locked";
  earned_at?: string;
  /** Real progress of a locked achievement. Null/undefined: no progress block. */
  progress?: AchievementProgress | null;
  onClose?: () => void;
};

function formatDate(iso: string) {
  return formatInstantAR(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AchievementPanel({
  achievement,
  variant,
  earned_at,
  progress,
  onClose,
}: Props) {
  const isLocked = variant === "locked" || variant === "compact-locked";
  const isJustEarned = variant === "just-earned";
  const isCompact = variant === "compact-earned" || variant === "compact-locked";

  if (isCompact) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            "relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border transition-all duration-150",
            isLocked
              ? "border-zinc-800 bg-zinc-900/60"
              : "border-brand-500/30 bg-brand-950/50 shadow-[0_0_20px_rgba(213,0,0,0.18)]",
          )}
        >
          <AchievementMedal
            icon={achievement.icon}
            size="lg"
            tile={false}
            className={cn("h-[46px] w-[46px]", isLocked && "grayscale opacity-30")}
          />

          {isLocked ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]">
              <Lock className="h-5 w-5 text-zinc-500" />
            </div>
          ) : (
            <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_8px_rgba(213,0,0,0.6)]">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <span
          className={cn(
            "max-w-[80px] text-center text-[10px] font-semibold leading-tight",
            isLocked ? "text-zinc-600" : "text-zinc-300",
          )}
        >
          {achievement.name}
        </span>
      </div>
    );
  }

  const sentence =
    achievement.condition_type !== undefined && achievement.condition_value !== undefined
      ? describeCondition({
          condition_type: achievement.condition_type,
          condition_value: achievement.condition_value,
          condition_target: achievement.condition_target,
        })
      : null;
  const reward =
    typeof achievement.xp_reward === "number" && achievement.xp_reward > 0 ? achievement.xp_reward : null;

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.96, opacity: 0, y: 8 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="relative w-full max-w-[420px] mx-auto"
    >
      {/* OUTER GLOW */}
      <div className="absolute inset-0 rounded-[40px] bg-red-500/10 blur-3xl" />

      {/* MAIN PANEL */}
      <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-white shadow-[0_0_120px_rgba(255,0,0,0.18)] dark:bg-[#111111]">
        {/* TOP LIGHT */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

        {/* RED RADIAL */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.24),transparent_42%)]" />

        {/* INNER SHADOW */}
        <div className="pointer-events-none absolute inset-0 dark:shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />

        {/* SIDE LIGHTS */}
        <div className="absolute left-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_24px_rgba(255,0,0,0.9)]" />
        <div className="absolute right-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_24px_rgba(255,0,0,0.9)]" />

        {/* CLOSE */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#a1a1aa] backdrop-blur-md transition-all duration-150 hover:border-red-500/40 hover:text-white active:scale-95"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center px-5 pb-6 pt-8 sm:px-8">
          {/* MEDAL AREA */}
          <div className="relative mb-5">
            <motion.div
              animate={{ rotate: isJustEarned ? 360 : 0 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-12px] rounded-full border border-red-500/20"
            />
            <div className="absolute inset-[-24px] rounded-full bg-red-500/20 blur-3xl" />

            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-[#3f3f46] dark:bg-gradient-to-b dark:from-[#27272a] dark:to-black dark:shadow-[inset_0_0_50px_rgba(255,255,255,0.05)]">
              <div className="absolute inset-3 rounded-full border border-red-500/30 shadow-[0_0_25px_rgba(255,0,0,0.45)]" />

              <AchievementMedal
                icon={achievement.icon}
                size="hero"
                tile={false}
                className={cn(
                  "relative z-10 drop-shadow-[0_0_30px_rgba(255,0,0,0.35)]",
                  isLocked && "grayscale opacity-40",
                )}
              />

              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm">
                  <div className="rounded-full border border-white/10 bg-black/60 p-3">
                    <Lock className="h-6 w-6 text-[#d4d4d8]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STATUS */}
          <div
            className={cn(
              "mb-4 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em]",
              isLocked
                ? "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-[#3f3f46] dark:bg-[#27272a] dark:text-[#a1a1aa]"
                : "border-red-500/40 bg-red-500/15 text-red-700 shadow-[0_0_20px_rgba(255,0,0,0.2)] dark:text-red-300",
            )}
          >
            {isLocked ? "BLOQUEADA" : "DESBLOQUEADA"}
          </div>

          {/* TITLE */}
          <h2 className="text-center text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            {achievement.name}
          </h2>

          {/* DESCRIPTION PILL */}
          {achievement.description && (
            <div className="mt-3 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-center text-xs font-medium text-red-700 dark:text-red-300">
              {achievement.description}
            </div>
          )}

          {/* WHAT IT TAKES */}
          {sentence && (
            <p className="mt-3 text-center text-sm text-zinc-600 dark:text-zinc-400">{sentence}</p>
          )}

          {/* REWARD */}
          {reward !== null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-brand-700 dark:text-brand-300">
              <Zap className="h-4 w-4" aria-hidden="true" />
              {!isJustEarned && (
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80">Recompensa</span>
              )}
              <span className="text-sm font-black">+{formatCount(reward)} XP</span>
            </div>
          )}

          {/* PROGRESS (locked, real numbers only) */}
          {isLocked && progress && (
            <div className="mt-5 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/30">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Progreso</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{progress.label}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                    {formatProgressValue(progress)}
                  </p>
                  <p className="text-xs text-zinc-500">{progress.unit}</p>
                </div>
              </div>

              <div
                role="progressbar"
                aria-label={progress.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.pct)}
                aria-valuetext={formatProgress(progress)}
                className="relative h-5 overflow-hidden rounded-full border border-red-500/20 bg-zinc-200 dark:bg-[#18181b]"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ duration: 1 }}
                  className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-300 shadow-[0_0_35px_rgba(255,0,0,0.9)]"
                >
                  <motion.div
                    animate={{ x: ["-100%", "220%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 w-1/3 skew-x-[-18deg] bg-white/20 blur-sm"
                  />
                </motion.div>
              </div>
            </div>
          )}

          {/* COMPLETED (earned: nothing left to measure) */}
          {!isLocked && (
            <div className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-brand-500/25 bg-brand-500/[0.07] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_14px_rgba(213,0,0,0.5)]">
                <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">
                  Completado
                </p>
                {earned_at && (
                  <p className="mt-0.5 text-xs text-zinc-500">Conseguida el {formatDate(earned_at)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
