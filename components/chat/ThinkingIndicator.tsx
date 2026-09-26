"use client"

import { ThinkingOrb, resolvePreset } from "thinking-orbs"
import { cn } from "@/lib/utils"
import { voltiaBoltFrame } from "@/lib/voltia-bolt-orb"

const ORB_SIZE = 32
// The orb feeds its frame `seconds * preset speed`; cancel the preset so `t` is in seconds.
const ORB_SPEED = 1 / resolvePreset("working", ORB_SIZE).speed

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-zinc-100 py-2 pl-2 pr-4 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
        className
      )}
    >
      <ThinkingOrb
        size={ORB_SIZE}
        frame={voltiaBoltFrame}
        speed={ORB_SPEED}
        color="#ef4444"
        aria-hidden
      />
      <span>Pensando</span>
    </div>
  )
}
