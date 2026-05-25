"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="rounded-full bg-red-950/40 p-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-zinc-100">Algo salió mal</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          Ocurrió un error al cargar esta página. Podés intentar de nuevo.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        <RefreshCw className="h-4 w-4" />
        Reintentar
      </button>
    </div>
  )
}
