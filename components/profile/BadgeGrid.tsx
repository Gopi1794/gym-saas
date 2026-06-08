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
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      {earned && <div className="absolute inset-2 rounded-full bg-brand-500/25 blur-2xl" />}

      <svg viewBox="0 0 100 116" className="absolute inset-0 h-full w-full drop-shadow-lg" aria-hidden>
        {earned && (
          <filter id={`glow-${name.replace(/\s/g, "")}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        <polygon
          points="50,3 97,28 97,88 50,113 3,88 3,28"
          fill={earned ? "rgba(30,4,4,0.90)" : "rgba(28,28,32,0.92)"}
          stroke={earned ? "rgba(213,0,0,0.55)" : "rgba(80,80,90,0.7)"}
          strokeWidth={earned ? "2" : "1.5"}
          filter={earned ? `url(#glow-${name.replace(/\s/g, "")})` : undefined}
        />
        <polygon
          points="50,10 90,32 90,84 50,106 10,84 10,32"
          fill="none"
          stroke={earned ? "rgba(213,0,0,0.18)" : "rgba(255,255,255,0.04)"}
          strokeWidth="1"
        />
      </svg>

      <div className="relative z-10 flex h-14 w-14 items-center justify-center">
        {isImagePath(icon) ? (
          <Image
            src={icon}
            alt={name}
            width={52}
            height={52}
            className={cn(
              "object-contain drop-shadow-[0_0_12px_rgba(213,0,0,0.4)]",
              !earned && "grayscale opacity-25",
            )}
          />
        ) : (
          <span className={cn("text-4xl", !earned && "grayscale opacity-25")}>{icon}</span>
        )}
        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-6 w-6 text-zinc-500" />
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      aria-label={`${achievement.name}${earned ? " — desbloqueado" : " — bloqueado"}`}
      className={cn(
        "group relative flex flex-col items-center rounded-2xl border p-5 text-left outline-none ring-brand-500/40",
        "transition-all duration-150 focus-visible:ring-2",
        earned
          ? "border-zinc-200 bg-white hover:border-brand-500/40 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:hover:border-brand-500/25 dark:hover:bg-zinc-900"
          : "border-zinc-200/80 bg-zinc-100/60 hover:bg-zinc-100 dark:border-zinc-800/50 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60",
      )}
    >
      {earned && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_12px_rgba(213,0,0,0.7)]">
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <HexIcon icon={icon} name={achievement.name} earned={earned} />

      <p className={cn(
        "mt-4 text-center text-base font-bold leading-tight",
        earned ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500",
      )}>
        {achievement.name}
      </p>

      {achievement.description && (
        <p className="mt-1.5 line-clamp-2 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">
          {achievement.description}
        </p>
      )}

      <div className="mt-4 w-full">
        {earned ? (
          <div className="flex items-center justify-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5">
            <Calendar className="h-3 w-3 text-brand-600 dark:text-brand-400" />
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
              {formatDate(earnedAt)}
            </span>
          </div>
        ) : target > 0 ? (
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-center text-[11px] text-zinc-500">
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
      <div className="mt-4 space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900/60">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 shadow-[0_0_20px_rgba(213,0,0,0.14)] dark:bg-brand-700/20">
              <Trophy className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
                Logros
              </h3>
              <p className="text-xs text-zinc-500">
                Tus metas, tu progreso, tu transformación.
              </p>
            </div>
          </div>

          {all.length > 0 && (
            <div className="shrink-0 text-right">
              <span className="inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-black text-brand-700 dark:text-brand-300">
                {earnedCount} / {all.length}
              </span>
              <p className="mt-1 text-[10px] text-zinc-500">Logros obtenidos</p>
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
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 dark:bg-brand-700/20">
                <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Sigue así, {userName}
                </p>
                <p className="text-[10px] text-zinc-500">
                  La disciplina de hoy construye la fuerza de mañana.
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xl font-black text-brand-600 dark:text-brand-400">{progressPct}%</p>
              <p className="mb-1.5 text-[10px] text-zinc-500">Progreso general</p>
              <div className="flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-4 rounded-full",
                      i < Math.round((progressPct / 100) * 8)
                        ? "bg-brand-500"
                        : "bg-zinc-300 dark:bg-zinc-700",
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
