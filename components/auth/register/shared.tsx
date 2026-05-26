"use client"

import { cn } from "@/lib/utils"

export const inputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 transition-colors min-h-[48px]"

export const labelCls = "block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5"

export const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
  exit: (dir: number) => ({
    x: dir > 0 ? -56 : 56, opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  }),
}

export function Pill<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T | ""
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all min-h-[44px]",
            value === o.value
              ? "border-brand-500 bg-brand-700/20 text-brand-400 shadow-[0_0_12px_rgba(213,0,0,0.2)]"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 text-xs text-red-400">{msg}</p>
}
