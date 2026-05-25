"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";
import type { Achievement } from "@/types";

type Props = {
  achievement: Pick<Achievement, "id" | "name" | "description" | "icon">;
  variant: "earned" | "locked" | "just-earned";
  earned_at?: string;
  progress?: number;
  total?: number;
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
}: Props) {
  const isLocked = variant === "locked";
  const isJustEarned = variant === "just-earned";

  const iconValue = achievement.icon ?? "/badges/default.webp";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        duration: 0.4,
      }}
      className="relative mx-auto w-full max-w-[520px]"
    >
      {/* OUTER GLOW */}
      <motion.div
        animate={
          isJustEarned
            ? {
                opacity: [0.5, 1, 0.5],
              }
            : {}
        }
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
        className="absolute inset-0 rounded-[36px] bg-red-500/10 blur-3xl"
      />

      {/* MAIN PANEL */}
      <div className="relative overflow-hidden rounded-[36px] border border-zinc-700 bg-[#111111] shadow-2xl">
        {/* RED ENERGY OVERLAY */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,80,80,0.25),transparent_45%)]" />

        {/* METAL TEXTURE */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />

        {/* INNER SHADOW */}
        <div className="pointer-events-none absolute inset-0 rounded-[36px] shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />

        {/* SIDE LIGHTS */}
        <div className="absolute left-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_20px_rgba(255,0,0,0.9)]" />

        <div className="absolute right-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_20px_rgba(255,0,0,0.9)]" />

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center px-8 py-10">
          {/* MEDAL */}
          <div className="relative mb-6">
            {/* GLOW RING */}
            <motion.div
              animate={
                isJustEarned
                  ? {
                      rotate: 360,
                    }
                  : {}
              }
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-[-14px] rounded-full border border-red-500/30"
            />

            {/* ENERGY */}
            <div className="absolute inset-[-24px] rounded-full bg-red-500/20 blur-2xl" />

            {/* MEDAL CONTAINER */}
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow-[inset_0_0_40px_rgba(255,255,255,0.08)]">
              {/* INNER RED RING */}
              <div className="absolute inset-3 rounded-full border border-red-500/30 shadow-[0_0_25px_rgba(255,0,0,0.5)]" />

              {/* ICON */}
              {isImagePath(iconValue) ? (
                <Image
                  src={iconValue}
                  alt={achievement.name}
                  width={120}
                  height={120}
                  className={[
                    "relative z-10 object-contain drop-shadow-[0_0_20px_rgba(255,0,0,0.4)]",
                    isLocked ? "grayscale opacity-40" : "",
                  ].join(" ")}
                />
              ) : (
                <span className="text-7xl">{iconValue}</span>
              )}

              {/* LOCK */}
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                  <Lock className="h-10 w-10 text-zinc-300" />
                </div>
              )}
            </div>
          </div>

          {/* STATUS */}
          <div
            className={[
              "mb-5 rounded-full border px-6 py-2 text-sm font-bold uppercase tracking-[0.25em]",
              isLocked
                ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                : "border-red-500/40 bg-red-500/20 text-red-300 shadow-[0_0_20px_rgba(255,0,0,0.25)]",
            ].join(" ")}
          >
            {isLocked ? "Bloqueada" : "Desbloqueada"}
          </div>

          {/* TITLE */}
          <h2 className="text-center text-5xl font-black tracking-tight text-white">
            {achievement.name}
          </h2>

          {/* SUBTITLE */}
          <div className="mt-4 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2 text-lg text-red-300">
            {achievement.description}
          </div>

          {/* DESCRIPTION */}
          <p className="mt-8 max-w-md text-center text-xl leading-relaxed text-zinc-400">
            Tu primera marca dentro de GymFlow.
            <br />
            Arrancaste el camino, ahora toca sostenerlo.
          </p>

          {/* DATE */}
          {!isLocked && earned_at && (
            <div className="mt-5 text-sm text-zinc-500">
              Conseguida el {formatDate(earned_at)}
            </div>
          )}

          {/* PROGRESS */}
          <div className="mt-10 w-full rounded-[24px] border border-zinc-800 bg-black/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                Progreso
              </span>

              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle2 className="h-5 w-5 text-red-400" />

                <span className="text-3xl font-black">
                  {progress}/{total}
                </span>
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="relative h-5 overflow-hidden rounded-full border border-red-500/20 bg-zinc-900">
              {/* BACKGROUND GLOW */}
              <div className="absolute inset-0 bg-red-500/10 blur-md" />

              {/* FILL */}
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(progress / total) * 100}%`,
                }}
                transition={{
                  duration: 1.2,
                }}
                className="relative h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-300 shadow-[0_0_30px_rgba(255,0,0,0.8)]"
              >
                {/* ELECTRIC EFFECT */}
                <motion.div
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.8,
                    ease: "linear",
                  }}
                  className="absolute inset-0 w-1/3 skew-x-[-20deg] bg-white/20 blur-sm"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
