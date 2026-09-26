"use client"

import { useSyncExternalStore } from "react"
import { MetalFx } from "metal-fx"
import { useTheme } from "next-themes"

export type MetalPlan = "basic" | "premium" | "vip"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY)
  query?.addEventListener("change", onChange)
  return () => query?.removeEventListener("change", onChange)
}

const getReducedMotion = () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
const getServerReducedMotion = () => false

/**
 * Wraps a plan card in the metal-fx liquid-metal ring. The per-plan color
 * comes from the `.metal-plan` rules in globals.css, keyed on
 * `data-metal-plan`. Without WebGL2 the library renders the plain card.
 */
export function MetalPlanCard({ plan, children }: { plan: MetalPlan; children: React.ReactElement }) {
  const { resolvedTheme } = useTheme()
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, getServerReducedMotion)

  return (
    <MetalFx
      preset="silver"
      // "auto" would follow the OS; the app has its own light/dark toggle.
      theme={resolvedTheme === "light" ? "light" : "dark"}
      borderRadius={16}
      ringCssPx={3}
      innerShadow
      // The wandering halo lands in the 16px gaps between cards as a hard-edged
      // smudge, so only the ring is kept. The card keeps its own border and
      // shadow, hence no host-style normalization.
      disableGlow
      normalizeHostStyles={false}
      paused={reducedMotion}
      className="metal-plan w-full"
      data-metal-plan={plan}
    >
      {children}
    </MetalFx>
  )
}
