export default function DashboardLoading() {
  return (
    <div className="space-y-5 pb-2 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-md bg-zinc-800" />
          <div className="h-3 w-28 rounded-md bg-zinc-800/60" />
        </div>
      </div>

      {/* Card skeleton */}
      <div className="h-36 rounded-2xl bg-zinc-800/60" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-2xl bg-zinc-800/60" />
        <div className="h-24 rounded-2xl bg-zinc-800/60" />
        <div className="h-24 rounded-2xl bg-zinc-800/60" />
      </div>

      {/* List skeleton */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-zinc-800/60" />
        ))}
      </div>
    </div>
  )
}
