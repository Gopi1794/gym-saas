"use client"

import { useState, useTransition } from "react"
import { sileo } from "sileo"
import { cn } from "@/lib/utils"
import { setTrainerCanCollectPayments } from "@/app/actions/staff"

interface Props {
  trainerId: string
  initialValue: boolean
}

export default function TrainerPaymentAccessToggle({ trainerId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !value
    setValue(next)
    startTransition(async () => {
      const res = await setTrainerCanCollectPayments(trainerId, next)
      if (res.error) {
        setValue(!next)
        sileo.error({ title: "No se pudo actualizar el permiso", description: res.error, duration: 3000 })
      }
    })
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={toggle}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
          value ? "bg-brand-600" : "bg-zinc-300 dark:bg-zinc-700",
          isPending && "opacity-60",
        )}
      >
        <div className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          value ? "translate-x-4" : "translate-x-0.5",
        )} />
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Puede cobrar membresías</span>
    </label>
  )
}
