"use client"

import { useState } from "react"
import Image from "next/image"
import { Lock, CheckCircle2 } from "lucide-react"
import type { Achievement } from "@/types"
import AchievementBadge from "@/components/achievements/AchievementBadge"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  all: Achievement[]
  earned: Map<string, string>
}

type Selected = { achievement: Achievement; earnedAt?: string }

function isImagePath(icon: string): boolean {
  return /\.(png|jpg|jpeg|svg|webp|avif)$/i.test(icon)
}

function BadgeTile({
  achievement,
  earnedAt,
  onClick,
}: {
  achievement: Achievement
  earnedAt?: string
  onClick: () => void
}) {
  const isLocked = earnedAt === undefined
  const icon = achievement.icon ?? "/badges/default.webp"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${achievement.name}${isLocked ? " — bloqueado" : " — desbloqueado"}`}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-2xl p-3 outline-none ring-brand-500/40 transition-all duration-150",
        "focus-visible:ring-2",
        isLocked
          ? "hover:bg-white/[0.02]"
          : "hover:bg-brand-500/[0.06]",
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          "relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl border transition-all duration-150",
          isLocked
            ? "border-zinc-800 bg-zinc-900/80"
            : "border-brand-500/30 bg-brand-950/60 shadow-[0_0_22px_rgba(213,0,0,0.18)] group-hover:shadow-[0_0_30px_rgba(213,0,0,0.28)]",
        )}
      >
        {/* Inner glow ring for earned */}
        {!isLocked && (
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(213,0,0,0.15),transparent_60%)]" />
        )}

        {isImagePath(icon) ? (
          <Image
            src={icon}
            alt={achievement.name}
            width={44}
            height={44}
            className={cn(
              "relative z-10 object-contain transition-transform duration-150 group-hover:scale-105",
              isLocked && "grayscale opacity-25",
            )}
          />
        ) : (
          <span className={cn("relative z-10 text-2xl", isLocked && "opacity-25 grayscale")}>
            {icon}
          </span>
        )}

        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-[2px]">
            <Lock className="h-5 w-5 text-zinc-600" />
          </div>
        )}

        {/* Earned check */}
        {!isLocked && (
          <div className="absolute -right-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_10px_rgba(213,0,0,0.7)]">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Name */}
      <span
        className={cn(
          "line-clamp-2 text-center text-[10px] font-semibold leading-tight",
          isLocked ? "text-zinc-600" : "text-zinc-300",
        )}
      >
        {achievement.name}
      </span>
    </button>
  )
}

export default function BadgeGrid({ all, earned }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const earnedCount = all.filter((a) => earned.has(a.id)).length

  return (
    <>
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-5 mt-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-heading text-sm tracking-widest text-brand-500">
            Logros del gimnasio
          </p>
          {all.length > 0 && (
            <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-400">
              {earnedCount}/{all.length}
            </span>
          )}
        </div>

        {all.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Este gimnasio aún no configuró logros
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1">
            {all.map((a) => {
              const earnedAt = earned.get(a.id)
              return (
                <BadgeTile
                  key={a.id}
                  achievement={a}
                  earnedAt={earnedAt}
                  onClick={() => setSelected({ achievement: a, earnedAt })}
                />
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-[560px] border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">
            {selected?.achievement.name}
          </DialogTitle>
          {selected && (
            <AchievementBadge
              variant={selected.earnedAt ? "earned" : "locked"}
              achievement={selected.achievement}
              earned_at={selected.earnedAt}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
