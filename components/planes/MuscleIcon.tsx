"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { MUSCLE_ZONE_IMAGE, type MuscleZone } from "@/lib/muscle-anatomy"

export function MuscleIcon({ zone, className }: { zone: MuscleZone; className?: string }) {
  const [failed, setFailed] = useState(false)
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/muscles/${MUSCLE_ZONE_IMAGE[zone]}`
  if (failed) return <MuscleSilhouette zone={zone} className={className} />
  return (
    <img
      src={url}
      alt={zone}
      className={cn("object-contain", className)}
      onError={() => setFailed(true)}
    />
  )
}

export function MuscleSilhouette({ zone, className }: { zone: MuscleZone; className?: string }) {
  const active = (target: MuscleZone | MuscleZone[]) => {
    const targets = Array.isArray(target) ? target : [target]
    return targets.includes(zone)
  }

  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500/60">
        <circle cx="32" cy="10" r="6" fill="currentColor" className="text-zinc-500/45" />
        <path d="M25 20h14l5 23-4 26H24l-4-26 5-23Z" fill="currentColor" className="text-zinc-500/35" />
        <path d="M24 25 12 37M40 25l12 12M24 69l-7 20M40 69l7 20" strokeWidth="7" />
      </g>
      <g className="text-red-500 drop-shadow-[0_0_7px_rgba(239,68,68,0.7)]" fill="currentColor" opacity="0.95">
        {active("shoulders") && (
          <>
            <circle cx="22" cy="25" r="5" />
            <circle cx="42" cy="25" r="5" />
          </>
        )}
        {active("chest") && (
          <>
            <path d="M25 28c4-4 10-4 14 0l-2 11H27l-2-11Z" />
            <path d="M32 28v12" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
          </>
        )}
        {active("back") && <path d="M23 25c5 4 13 4 18 0l2 20c-7 5-15 5-22 0l2-20Z" />}
        {active("biceps") && (
          <>
            <path d="M15 36c5 2 7 9 4 15l-5-2c2-5 1-9-3-12l4-1Z" />
            <path d="M49 36c-5 2-7 9-4 15l5-2c-2-5-1-9 3-12l-4-1Z" />
          </>
        )}
        {active("triceps") && (
          <>
            <path d="M18 42c4 4 4 11 1 17l-5-2c2-5 2-10 0-14l4-1Z" />
            <path d="M46 42c-4 4-4 11-1 17l5-2c-2-5-2-10 0-14l-4-1Z" />
          </>
        )}
        {active("core") && <path d="M27 42h10l2 16H25l2-16Z" />}
        {active("glutes") && (
          <>
            <path d="M24 60c4-3 7-3 8 2v7h-8v-9Z" />
            <path d="M40 60c-4-3-7-3-8 2v7h8v-9Z" />
          </>
        )}
        {active("quads") && (
          <>
            <path d="M24 70h8l-2 19h-7l1-19Z" />
            <path d="M40 70h-8l2 19h7l-1-19Z" />
          </>
        )}
        {active("hamstrings") && (
          <>
            <path d="M23 69h7l-1 19h-7l1-19Z" />
            <path d="M41 69h-7l1 19h7l-1-19Z" />
          </>
        )}
        {active("calves") && (
          <>
            <path d="M22 82h7l-1 11h-8l2-11Z" />
            <path d="M42 82h-7l1 11h8l-2-11Z" />
          </>
        )}
      </g>
    </svg>
  )
}
