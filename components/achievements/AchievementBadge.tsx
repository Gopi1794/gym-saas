"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { Achievement } from "@/types"

type Props = {
  achievement: Pick<Achievement, "id" | "name" | "description" | "icon">
  variant: "earned" | "locked" | "just-earned"
  earned_at?: string
  size?: "sm" | "md"
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function isImagePath(icon: string): boolean {
  return /\.(png|jpg|jpeg|svg|webp|avif)$/i.test(icon)
}

export default function AchievementBadge({
  achievement,
  variant,
  earned_at,
  size = "md",
}: Props) {
  const sizeClass = size === "sm" ? "w-16 h-16" : "w-24 h-24"
  const imgSize = size === "sm" ? 32 : 48
  const iconSizeClass = size === "sm" ? "text-2xl" : "text-4xl"
  const nameSizeClass = size === "sm" ? "text-[9px]" : "text-[11px]"

  const isLocked = variant === "locked"
  const isJustEarned = variant === "just-earned"

  const iconValue = achievement.icon ?? "🏆"
  const iconNode = isImagePath(iconValue) ? (
    <Image
      src={iconValue}
      alt={achievement.name}
      width={imgSize}
      height={imgSize}
      className="object-contain"
    />
  ) : (
    <span className={iconSizeClass} role="img" aria-label={achievement.name}>
      {iconValue}
    </span>
  )

  const tileContent = (
    <div
      className={[
        sizeClass,
        "relative flex flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-all",
        isLocked
          ? "border-zinc-800 bg-zinc-900/60 opacity-40 grayscale"
          : "border-brand-700/40 bg-zinc-900/80 ring-2 ring-brand-500/50",
      ].join(" ")}
    >
      {iconNode}

      <span
        className={[
          nameSizeClass,
          "font-semibold uppercase tracking-wide text-zinc-200 leading-tight",
        ].join(" ")}
      >
        {achievement.name}
      </span>

      {!isLocked && earned_at && (
        <span className="text-[8px] text-zinc-500">{formatDate(earned_at)}</span>
      )}

      {isLocked && (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-2xl text-base"
          aria-hidden="true"
        >
          🔒
        </span>
      )}
    </div>
  )

  if (isJustEarned) {
    return (
      <motion.div
        animate={{
          boxShadow: [
            "0 0 0px rgba(213,0,0,0)",
            "0 0 20px rgba(213,0,0,0.7)",
            "0 0 0px rgba(213,0,0,0)",
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-2xl"
      >
        {tileContent}
      </motion.div>
    )
  }

  return tileContent
}
