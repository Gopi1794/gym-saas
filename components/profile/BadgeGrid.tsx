import type { Achievement } from "@/types"
import AchievementBadge from "@/components/achievements/AchievementBadge"

type Props = {
  all: Achievement[]
  earned: Map<string, string>
}

export default function BadgeGrid({ all, earned }: Props) {
  return (
    <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-4 mt-4">
      {/* Header */}
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
            return earnedAt !== undefined ? (
              <AchievementBadge
                key={a.id}
                variant="earned"
                achievement={a}
                earned_at={earnedAt}
              />
            ) : (
              <AchievementBadge
                key={a.id}
                variant="locked"
                achievement={a}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
