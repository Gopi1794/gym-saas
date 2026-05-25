"use client"

import { useState } from "react"
import type { Achievement } from "@/types"
import AchievementBadge from "@/components/achievements/AchievementBadge"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  all: Achievement[]
  earned: Map<string, string>
}

type Selected = { achievement: Achievement; earnedAt?: string }

export default function BadgeGrid({ all, earned }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null)

  return (
    <>
      <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-4 mt-4">
        <p className="font-heading text-sm tracking-widest text-brand-500 mb-3">
          Logros del gimnasio
        </p>

        {all.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Este gimnasio aún no configuró logros
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
            {all.map((a) => {
              const earnedAt = earned.get(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className="focus:outline-none"
                  onClick={() => setSelected({ achievement: a, earnedAt })}
                >
                  {earnedAt !== undefined ? (
                    <AchievementBadge
                      variant="earned"
                      achievement={a}
                      earned_at={earnedAt}
                    />
                  ) : (
                    <AchievementBadge
                      variant="locked"
                      achievement={a}
                    />
                  )}
                </button>
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
