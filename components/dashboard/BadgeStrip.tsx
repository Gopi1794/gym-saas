"use client"

import Link from "next/link"
import { ChevronRight, Sparkles } from "lucide-react"
import AchievementBadge from "@/components/achievements/AchievementBadge"

export type RecentBadge = {
  id: string
  earned_at: string
  achievements: {
    name: string
    icon: string | null
    description: string | null
  } | null
}

type Props = {
  badges: RecentBadge[]
}

export default function BadgeStrip({ badges }: Props) {
  return (
    <Link href="/profile" className="block transition-transform duration-150 ease-out active:scale-[0.99]">
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-4 transition-colors duration-150 ease-out hover:bg-zinc-900/80">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-sm tracking-widest text-brand-500">
            Tus logros recientes
          </p>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </div>

        {badges.length > 0 ? (
          <div className="flex items-start gap-4">
            {badges.slice(0, 4).map((b) => (
              <AchievementBadge
                key={b.id}
                variant="compact-earned"
                achievement={{
                  id: b.id,
                  name: b.achievements?.name ?? "",
                  description: b.achievements?.description ?? null,
                  icon: b.achievements?.icon ?? null,
                }}
                earned_at={b.earned_at}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-black/15 px-3 py-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-700/20 text-brand-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-xs leading-snug text-zinc-400">
              Primer logro cerca: completá una sesión y lo desbloqueás.
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
