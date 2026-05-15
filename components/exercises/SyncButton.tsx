"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    setResult(null)

    const res = await fetch("/api/exercises/sync", { method: "POST" })
    const data = await res.json()

    setLoading(false)
    if (res.ok) {
      setResult(`✓ ${data.synced} exercises synced from wger.de`)
      router.refresh()
    } else {
      setResult(`Error: ${data.error}`)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        size="sm"
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync Exercises"}
      </Button>
      {result && (
        <p className={`text-xs ${result.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
          {result}
        </p>
      )}
    </div>
  )
}
