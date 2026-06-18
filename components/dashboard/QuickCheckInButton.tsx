"use client"

import { useState, useTransition } from "react"
import { LogIn, LogOut, Loader2, CheckCircle2 } from "lucide-react"
import { selfCheckIn } from "@/app/actions/self-check-in"

type Props = {
  gymId: string
  isCheckedIn: boolean
}

export default function QuickCheckInButton({ gymId, isCheckedIn: initialState }: Props) {
  const [checkedIn, setCheckedIn] = useState(initialState)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await selfCheckIn(gymId)
      if (result.success) {
        setCheckedIn(result.action === "checkin")
        setDone(true)
        setTimeout(() => setDone(false), 3000)
      }
    })
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-500">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">
          {checkedIn ? "¡Check-in registrado!" : "Salida registrada"}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4 text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : checkedIn ? (
        <LogOut className="h-5 w-5 text-brand-500" />
      ) : (
        <LogIn className="h-5 w-5 text-brand-500" />
      )}
      <div className="text-left">
        <p className="text-sm font-semibold">
          {checkedIn ? "Registrar salida" : "Registrar entrada"}
        </p>
        <p className="text-xs text-zinc-500">
          {checkedIn ? "Ya estás dentro del gym" : "Marcá tu llegada al gym"}
        </p>
      </div>
    </button>
  )
}
