import { Medal, Trophy } from "lucide-react"
import { ProfileAvatar } from "@/components/ui/profile-avatar"

export type LeaderboardRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  total_xp: number
  user_achievements: { count: number }[]
}

type Props = {
  rows: LeaderboardRow[]
  viewerId: string
}

const RANK_COLORS: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-zinc-400",
  3: "text-orange-600",
}

export default function LeaderboardCard({ rows, viewerId }: Props) {
  return (
    <div className="rounded-2xl border border-brand-700/20 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-sm tracking-widest text-brand-500">
          Tabla de posiciones
        </p>
        <Trophy className="h-4 w-4 text-amber-400" />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay miembros en el ranking</p>
      ) : (
        <ol className="space-y-2">
          {rows.slice(0, 5).map((row, index) => {
            const rank = index + 1
            const isViewer = row.id === viewerId
            const badgeCount = row.user_achievements?.[0]?.count ?? 0
            const rankColor = RANK_COLORS[rank] ?? "text-zinc-500"

            return (
              <li
                key={row.id}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 ease-out",
                  isViewer ? "bg-brand-700/20" : "hover:bg-zinc-800/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-6 shrink-0 text-center text-sm font-bold tabular-nums",
                    rankColor,
                  ].join(" ")}
                >
                  #{rank}
                </span>

                <ProfileAvatar
                  src={row.avatar_url}
                  name={row.full_name}
                  size={32}
                  className="shrink-0"
                />

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                  {row.full_name ?? "Sin nombre"}
                  {isViewer && (
                    <span className="ml-1 text-xs text-brand-400">(vos)</span>
                  )}
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-400">
                  {row.total_xp.toLocaleString("es-AR")}{" "}
                  <span className="text-xs font-normal text-zinc-500">XP</span>
                </span>

                <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                  <Medal className="h-3.5 w-3.5" /> {badgeCount}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
