import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { EarnedAchievement } from "@/lib/achievements/types"
import WorkoutResults from "./WorkoutResults"

vi.mock("@/components/ui/lottie-player", () => ({ default: () => null }))

function earned(overrides: Partial<EarnedAchievement> & Pick<EarnedAchievement, "id" | "name">): EarnedAchievement {
  return {
    description: null,
    icon: null,
    xp_reward: 0,
    earned_at: "2026-08-03T15:00:00Z",
    ...overrides,
  }
}

function renderResults(achievements: EarnedAchievement[], onClose = vi.fn()) {
  render(
    <WorkoutResults
      result={{ ok: true, xp_earned: 100, new_total_xp: 2750, earned_achievements: achievements }}
      onClose={onClose}
    />,
  )
  return onClose
}

describe("WorkoutResults", () => {
  it("shows the XP reward of each unlocked achievement", () => {
    renderResults([
      earned({ id: "a", name: "Primera sesión", xp_reward: 200 }),
      earned({ id: "b", name: "Constancia de hierro", xp_reward: 1500 }),
    ])

    expect(screen.getByText("¡Logros desbloqueados!")).toBeInTheDocument()
    expect(screen.getByText("Primera sesión")).toBeInTheDocument()
    expect(screen.getByText("+200 XP")).toBeInTheDocument()
    expect(screen.getByText("Constancia de hierro")).toBeInTheDocument()
    expect(screen.getByText("+1.500 XP")).toBeInTheDocument()
  })

  it("shows unlocked achievements as completed, with no made-up progress", () => {
    renderResults([earned({ id: "a", name: "Primera sesión", xp_reward: 200 })])

    expect(screen.getByText("Completado")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText("Asistencias completadas")).not.toBeInTheDocument()
  })

  it("does not show a reward for an achievement that pays none", () => {
    renderResults([earned({ id: "a", name: "Sin premio", xp_reward: 0 })])

    expect(screen.getByText("Sin premio")).toBeInTheDocument()
    expect(screen.queryByText(/^\+0 XP$/)).not.toBeInTheDocument()
  })

  it("keeps the session XP and the total as they were", () => {
    renderResults([earned({ id: "a", name: "Primera sesión", xp_reward: 200 })])

    expect(screen.getByText("+100")).toBeInTheDocument()
    expect(screen.getByText("2750 XP")).toBeInTheDocument()
  })

  it("shows the encouragement instead when nothing was unlocked", () => {
    renderResults([])

    expect(screen.queryByText("¡Logros desbloqueados!")).not.toBeInTheDocument()
    expect(screen.getByText(/Buen entrenamiento/)).toBeInTheDocument()
  })

  it("closes with the CTA", () => {
    const onClose = renderResults([])
    fireEvent.click(screen.getByRole("button", { name: "Volver a mi rutina" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
