function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800 ${className}`} />
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-5 pb-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bone className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="space-y-2">
          <Bone className="h-6 w-44" />
          <Bone className="h-3 w-28" />
        </div>
      </div>

      {/* Today workout card */}
      <Bone className="h-36 w-full rounded-2xl" />

      {/* Weekly summary */}
      <Bone className="h-20 w-full rounded-2xl" />

      {/* Nutrition */}
      <Bone className="h-28 w-full rounded-2xl" />

      {/* Activity cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Bone className="h-4 w-24" />
          <Bone className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Bone className="h-24 rounded-2xl" />
          <Bone className="h-24 rounded-2xl" />
          <Bone className="h-24 rounded-2xl" />
        </div>
      </div>

      {/* Badge strip */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <Bone key={i} className="h-16 w-16 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Calendar */}
      <Bone className="h-52 w-full max-w-sm rounded-2xl" />

      {/* PRs */}
      <Bone className="h-36 w-full rounded-2xl" />

      {/* Leaderboard */}
      <Bone className="h-48 w-full rounded-2xl" />
    </div>
  )
}
