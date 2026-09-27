import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getAchievementProgress, type AchievementMetrics } from "@/lib/achievements/progress"
import AchievementBadge from "./AchievementBadge"

const METRICS: AchievementMetrics = {
  total_sessions: 12,
  total_xp: 2450,
  sessions_week: 3,
  streak_days: 0,
  total_volume_kg: 12500,
  total_cardio_minutes: 42.5,
  sessions_by_category: { strength: 9 },
}

const CLUB = {
  id: "club",
  name: "Club de las 100",
  description: "Cien sesiones en el gimnasio",
  icon: "/medallas/medalla_fuerza.png",
  xp_reward: 500,
  condition_type: "total_sessions" as const,
  condition_value: 100,
  condition_target: null,
}

const PROGRESS = getAchievementProgress(CLUB, METRICS, 0)

describe("AchievementBadge panel", () => {
  it("shows the real progress of a locked achievement", () => {
    render(<AchievementBadge achievement={CLUB} variant="locked" progress={PROGRESS} />)

    expect(screen.getByText("BLOQUEADA")).toBeInTheDocument()
    expect(screen.getByText("Sesiones completadas")).toBeInTheDocument()
    expect(screen.getByText("12 / 100")).toBeInTheDocument()
    expect(screen.getByText("sesiones")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "12 / 100 sesiones")
  })

  it("has no fake defaults: no 19/19 and no 'Asistencias completadas'", () => {
    for (const variant of ["locked", "earned", "just-earned"] as const) {
      const { container, unmount } = render(
        <AchievementBadge
          achievement={{ id: "x", name: "Sin datos", description: null, icon: null }}
          variant={variant}
          earned_at="2026-08-03T15:00:00Z"
        />,
      )
      expect(container).not.toHaveTextContent("19")
      expect(container).not.toHaveTextContent("Asistencias completadas")
      unmount()
    }
  })

  it("shows no progress block for a locked achievement when progress is unknown", () => {
    const { rerender } = render(<AchievementBadge achievement={CLUB} variant="locked" />)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText("Progreso")).not.toBeInTheDocument()

    rerender(<AchievementBadge achievement={CLUB} variant="locked" progress={null} />)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("shows the condition sentence and the reward when they are known", () => {
    render(<AchievementBadge achievement={CLUB} variant="locked" progress={PROGRESS} />)

    expect(screen.getByText("Completar 100 sesiones en total")).toBeInTheDocument()
    expect(screen.getByText("Recompensa")).toBeInTheDocument()
    expect(screen.getByText("+500 XP")).toBeInTheDocument()
    expect(screen.getByText("Cien sesiones en el gimnasio")).toBeInTheDocument()
  })

  it("groups a big reward with es-AR thousands separators", () => {
    render(<AchievementBadge achievement={{ ...CLUB, xp_reward: 1500 }} variant="locked" />)
    expect(screen.getByText("+1.500 XP")).toBeInTheDocument()
  })

  it("omits the reward when it is unknown or zero", () => {
    const { rerender } = render(<AchievementBadge achievement={{ ...CLUB, xp_reward: undefined }} variant="locked" />)
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()

    rerender(<AchievementBadge achievement={{ ...CLUB, xp_reward: 0 }} variant="locked" />)
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()
  })

  it("omits the condition sentence when the condition is unknown", () => {
    render(
      <AchievementBadge
        achievement={{ id: "x", name: "Solo nombre", description: null, icon: null }}
        variant="locked"
      />,
    )
    expect(screen.queryByText(/Completar/)).not.toBeInTheDocument()
  })

  it("shows an earned achievement as completed instead of a bar", () => {
    render(<AchievementBadge achievement={CLUB} variant="earned" earned_at="2026-08-03T15:00:00Z" progress={PROGRESS} />)

    expect(screen.getByText("DESBLOQUEADA")).toBeInTheDocument()
    expect(screen.getByText("Completado")).toBeInTheDocument()
    expect(screen.getByText("Conseguida el 03/08/2026")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText("Progreso")).not.toBeInTheDocument()
  })

  it("reads the earned date in Argentina time", () => {
    // 02:30 UTC of the 4th is 23:30 of the 3rd in Argentina.
    render(<AchievementBadge achievement={CLUB} variant="earned" earned_at="2026-08-04T02:30:00Z" />)
    expect(screen.getByText("Conseguida el 03/08/2026")).toBeInTheDocument()
  })

  it("shows a just-earned achievement as completed with its plain reward", () => {
    render(
      <AchievementBadge
        achievement={{ id: "x", name: "Primera sesión", description: null, icon: "🔥", xp_reward: 200 }}
        variant="just-earned"
        earned_at="2026-08-03T15:00:00Z"
      />,
    )

    expect(screen.getByText("Completado")).toBeInTheDocument()
    expect(screen.getByText("+200 XP")).toBeInTheDocument()
    expect(screen.queryByText("Recompensa")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("renders the medal through the shared component: emoji as text, missing image as a trophy", () => {
    const { container, rerender } = render(
      <AchievementBadge achievement={{ ...CLUB, icon: "🔥" }} variant="locked" />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container).toHaveTextContent("🔥")

    rerender(<AchievementBadge achievement={{ ...CLUB, icon: null }} variant="locked" />)
    expect(container).toHaveTextContent("🏆")

    rerender(<AchievementBadge achievement={{ ...CLUB, icon: "/medallas/missing.png" }} variant="locked" />)
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(container).toHaveTextContent("🏆")
  })

  it("calls onClose from the 44px close button", () => {
    const onClose = vi.fn()
    render(<AchievementBadge achievement={CLUB} variant="locked" onClose={onClose} />)

    const close = screen.getByRole("button", { name: "Cerrar" })
    expect(close).toHaveClass("h-11", "w-11")
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("AchievementBadge compact variants", () => {
  const stripAchievement = { id: "x", name: "Racha", description: null, icon: "/medallas/medalla_hierro.png" }

  it("renders the name and the medal without any progress or reward", () => {
    const { container } = render(
      <AchievementBadge achievement={stripAchievement} variant="compact-earned" earned_at="2026-08-03T15:00:00Z" />,
    )

    expect(screen.getByText("Racha")).toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", "/medallas/medalla_hierro.png")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent("XP")
  })

  it("does not fall back to the missing default image", () => {
    const { container } = render(
      <AchievementBadge achievement={{ ...stripAchievement, icon: null }} variant="compact-locked" />,
    )

    expect(container.querySelector("img")).toBeNull()
    expect(container).toHaveTextContent("🏆")
  })
})
