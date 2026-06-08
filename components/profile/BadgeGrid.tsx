"use client"

import { useState } from "react"
import Image from "next/image"
import { Trophy, Calendar, TrendingUp, Lock } from "lucide-react"
import { motion } from "framer-motion"
import type { Achievement } from "@/types"
import AchievementBadge from "@/components/achievements/AchievementBadge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  all: Achievement[]
  earned: Map<string, string>
  totalCheckIns?: number
  userName?: string
}

type Selected = { achievement: Achievement; earnedAt?: string }

function formatDate(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function isImagePath(icon: string): boolean {
  return /\.(png|jpg|jpeg|svg|webp|avif)$/i.test(icon)
}

function HexIcon({ icon, name, earned }: { icon: string; name: string; earned: boolean }) {
  const hexId = `hex-${name.replace(/\s+/g, "-")}`
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      {earned && (
        <div className="absolute inset-4 rounded-full bg-brand-500/20 blur-2xl" />
      )}

      <svg viewBox="0 0 100 116" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          {earned && (
            <filter id={`${hexId}-glow`} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Outer hex */}
        <polygon
          points="50,3 97,28 97,88 50,113 3,88 3,28"
          fill={earned ? "rgba(18,4,4,0.97)" : "rgba(18,18,22,0.97)"}
          stroke={earned ? "rgba(213,0,0,0.90)" : "rgba(55,55,65,0.85)"}
          strokeWidth={earned ? "2.5" : "1.5"}
          filter={earned ? `url(#${hexId}-glow)` : undefined}
        />

        {/* Inner hex ring */}
        <polygon
          points="50,11 89,32 89,84 50,105 11,84 11,32"
          fill="none"
          stroke={earned ? "rgba(213,0,0,0.20)" : "rgba(255,255,255,0.04)"}
          strokeWidth="1"
        />
      </svg>

      <div className="relative z-10 flex h-[68px] w-[68px] items-center justify-center">
        {isImagePath(icon) ? (
          <Image
            src={icon}
            alt={name}
            width={62}
            height={62}
            className={cn(
              "object-contain drop-shadow-[0_0_16px_rgba(213,0,0,0.55)]",
              !earned && "grayscale opacity-25",
            )}
          />
        ) : (
          <span
            className={cn("text-[46px] leading-none", !earned && "grayscale opacity-25")}
            style={{ filter: earned ? "drop-shadow(0 0 10px rgba(213,0,0,0.6))" : undefined }}
          >
            {icon}
          </span>
        )}

        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-7 w-7 text-zinc-500" />
          </div>
        )}
      </div>
    </div>
  )
}

function AchievementCard({
  achievement,
  earnedAt,
  totalCheckIns,
  onClick,
  index,
}: {
  achievement: Achievement
  earnedAt?: string
  totalCheckIns: number
  onClick: () => void
  index: number
}) {
  const earned = earnedAt !== undefined
  const icon = achievement.icon ?? "/badges/default.webp"
  const progress = Math.min(totalCheckIns, achievement.condition_value ?? 0)
  const target = achievement.condition_value ?? 1
  const pct = Math.min((progress / target) * 100, 100)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      aria-label={`${achievement.name}${earned ? " — desbloqueado" : " — bloqueado"}`}
      className={cn(
        "group relative flex flex-col items-center rounded-2xl border p-5 text-left outline-none ring-brand-500/40",
        "transition-all duration-150 focus-visible:ring-2",
        earned
          ? "border-[#2a2a30] bg-[#18181c] hover:border-brand-500/30 hover:bg-[#1e1a1a] dark:border-[#2a2a30] dark:bg-[#18181c]"
          : "border-[#222228] bg-[#141418] hover:bg-[#18181c] dark:border-[#222228] dark:bg-[#141418]",
        "light:border-zinc-200 light:bg-white",
      )}
    >
      {earned && (
        <div className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_14px_rgba(213,0,0,0.7)]">
          <svg viewBox="0 0 12 12" className="h-[14px] w-[14px]" fill="none" aria-hidden>
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <HexIcon icon={icon} name={achievement.name} earned={earned} />

      <p className={cn(
        "mt-3 text-center text-[15px] font-bold leading-snug",
        earned ? "text-white" : "text-zinc-500",
      )}>
        {achievement.name}
      </p>

      {achievement.description && (
        <p className="mt-2 line-clamp-2 text-center text-[13px] leading-relaxed text-zinc-500">
          {achievement.description}
        </p>
      )}

      <div className="mt-4 w-full">
        {earned ? (
          <div className="flex items-center justify-center gap-2 rounded-full border border-brand-500/35 bg-brand-500/[0.08] px-4 py-2">
            <Calendar className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-[13px] font-semibold text-brand-400">
              {formatDate(earnedAt)}
            </span>
          </div>
        ) : target > 0 ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-[#2a2a30]">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-center text-[13px] font-medium text-zinc-500">
              {progress} / {target}
            </p>
          </div>
        ) : null}
      </div>
    </motion.button>
  )
}

export default function BadgeGrid({
  all,
  earned,
  totalCheckIns = 0,
  userName = "campeón",
}: Props) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const earnedCount = all.filter((a) => earned.has(a.id)).length
  const progressPct = all.length > 0 ? Math.round((earnedCount / all.length) * 100) : 0

  return (
    <>
      <div className="mt-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-[#2a2a30] dark:bg-[#111114]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 shadow-[0_0_20px_rgba(213,0,0,0.15)]">
              <Trophy className="h-6 w-6 text-brand-500" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-wide text-zinc-900 dark:text-white">
                Logros
              </h3>
              <p className="text-[13px] text-zinc-500">
                Tus metas, tu progreso, tu transformación.
              </p>
            </div>
          </div>

          {all.length > 0 && (
            <div className="shrink-0 text-right">
              <span className="inline-block rounded-full border border-brand-500/50 px-4 py-1.5 text-sm font-black text-zinc-900 dark:text-white">
                {earnedCount} / {all.length}
              </span>
              <p className="mt-1 text-[11px] text-zinc-500">Logros obtenidos</p>
            </div>
          )}
        </div>

        {all.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            Este gimnasio aún no configuró logros
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {all.map((a, i) => (
              <AchievementCard
                key={a.id}
                achievement={a}
                earnedAt={earned.get(a.id)}
                totalCheckIns={totalCheckIns}
                onClick={() => setSelected({ achievement: a, earnedAt: earned.get(a.id) })}
                index={i}
              />
            ))}
          </div>
        )}

        {all.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-[#2a2a30] dark:bg-[#0d0d10]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15">
                <TrendingUp className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-zinc-900 dark:text-white">
                  Sigue así, {userName}
                </p>
                <p className="text-[12px] text-zinc-500">
                  La disciplina de hoy construye la fuerza de mañana.
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[28px] font-black leading-none text-brand-500">{progressPct}%</p>
              <p className="mb-2 mt-0.5 text-[11px] text-zinc-500">Progreso general</p>
              <div className="flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 w-5 rounded-full",
                      i < Math.round((progressPct / 100) * 8)
                        ? "bg-brand-500"
                        : "bg-zinc-300 dark:bg-[#2a2a30]",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-[420px] border-none bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">
            {selected?.achievement.name}
          </DialogTitle>
          {selected && (
            <AchievementBadge
              variant={selected.earnedAt ? "earned" : "locked"}
              achievement={selected.achievement}
              earned_at={selected.earnedAt}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
