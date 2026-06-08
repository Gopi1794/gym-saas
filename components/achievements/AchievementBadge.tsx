"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types";

type Props = {
  achievement: Pick<Achievement, "id" | "name" | "description" | "icon">;
  variant: "earned" | "locked" | "just-earned" | "compact-earned" | "compact-locked";
  earned_at?: string;
  progress?: number;
  total?: number;
  onClose?: () => void;
};

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function isImagePath(icon: string): boolean {
  return /\.(png|jpg|jpeg|svg|webp|avif)$/i.test(icon);
}

export default function AchievementPanel({
  achievement,
  variant,
  earned_at,
  progress = 19,
  total = 19,
  onClose,
}: Props) {
  const isLocked = variant === "locked" || variant === "compact-locked";
  const isJustEarned = variant === "just-earned";
  const isCompact = variant === "compact-earned" || variant === "compact-locked";

  const iconValue = achievement.icon ?? "/badges/default.webp";

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
          {isImagePath(iconValue) ? (
            <Image
              src={iconValue}
              alt={achievement.name}
              width={46}
              height={46}
              className={cn(
                "object-contain",
                isLocked && "grayscale opacity-30",
              )}
            />
          ) : (
            <span className={cn("text-2xl", isLocked && "opacity-30 grayscale")}>{iconValue}</span>
          )}

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
            className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#a1a1aa] backdrop-blur-md transition-all duration-150 hover:border-red-500/40 hover:text-white active:scale-95"
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

              {isImagePath(iconValue) ? (
                <Image
                  src={iconValue}
                  alt={achievement.name}
                  width={110}
                  height={110}
                  className={cn(
                    "relative z-10 object-contain drop-shadow-[0_0_30px_rgba(255,0,0,0.35)]",
                    isLocked && "grayscale opacity-40",
                  )}
                />
              ) : (
                <span className={cn("text-5xl", isLocked && "grayscale opacity-40")}>{iconValue}</span>
              )}

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
                ? "border-[#3f3f46] bg-[#27272a] text-[#a1a1aa]"
                : "border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_20px_rgba(255,0,0,0.2)]",
            )}
          >
            {isLocked ? "BLOQUEADA" : "DESBLOQUEADA"}
          </div>

          {/* TITLE */}
          <h2 className="text-center text-3xl font-black tracking-tight text-[#ffffff]">
            {achievement.name}
          </h2>

          {/* CONDITION PILL */}
          {achievement.description && (
            <div className="mt-3 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-300">
              {achievement.description}
            </div>
          )}

          {/* DATE */}
          {!isLocked && earned_at && (
            <p className="mt-3 text-xs text-zinc-500">
              Conseguida el {formatDate(earned_at)}
            </p>
          )}

          {/* PROGRESS */}
          <div className="mt-5 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/30">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#71717a]">
                  Progreso
                </p>
                <p className="mt-0.5 text-xs text-[#71717a]">Asistencias completadas</p>
              </div>
              <p className="text-2xl font-black tracking-tight text-[#ffffff]">
                {Math.min(progress, total)}/{total}
              </p>
            </div>

            <div className="relative h-5 overflow-hidden rounded-full border border-red-500/20 bg-[#18181b]">
              <div className="absolute inset-0 bg-red-500/10 blur-md" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((progress / total) * 100, 100)}%` }}
                transition={{ duration: 1 }}
                className="relative h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-300 shadow-[0_0_35px_rgba(255,0,0,0.9)]"
              >
                <motion.div
                  animate={{ x: ["-100%", "220%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 w-1/3 skew-x-[-18deg] bg-white/20 blur-sm"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
