"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
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
    <Link href="/profile" className="block">
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-4 transition-colors hover:bg-zinc-900/80">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-sm tracking-widest text-brand-500">
            Tus logros recientes
          </p>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </div>

        {badges.length > 0 ? (
          <div className="flex items-start gap-3">
            {badges.slice(0, 3).map((b) => (
              <AchievementBadge
                key={b.id}
                size="sm"
                variant="earned"
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
          <p className="text-sm text-zinc-500">
            Aún no ganaste ningún logro — ¡completá tu primera sesión!
          </p>
        )}
      </div>
    </Link>
  )
}
