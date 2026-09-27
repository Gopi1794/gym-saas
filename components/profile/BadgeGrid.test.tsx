import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Achievement } from "@/types"
import type { AchievementMetrics } from "@/lib/achievements/progress"
import BadgeGrid from "./BadgeGrid"

const METRICS: AchievementMetrics = {
  total_sessions: 12,
  total_xp: 2450,
  sessions_week: 3,
  streak_days: 0,
  total_volume_kg: 12500,
  total_cardio_minutes: 42.5,
  sessions_by_category: { strength: 9 },
}

function achievement(overrides: Partial<Achievement> & Pick<Achievement, "id" | "name">): Achievement {
  return {
    gym_id: "gym-1",
    description: null,
    icon: null,
    xp_reward: 0,
    condition_type: "total_sessions",
    condition_value: 100,
    condition_target: null,
    created_at: "2026-08-01T12:00:00Z",
    ...overrides,
  }
}

const CLUB = achievement({ id: "club", name: "Club de las 100", xp_reward: 500, icon: "/medallas/medalla_fuerza.png" })
const TONS = achievement({
  id: "tons",
  name: "Toneladas levantadas",
  condition_type: "total_volume_kg",
  condition_value: 100000,
})
const WEEK = achievement({ id: "week", name: "Semana perfecta", condition_type: "sessions_week", condition_value: 5 })
const STREAK = achievement({ id: "streak", name: "Constancia de hierro", condition_type: "streak_days", condition_value: 7 })
const STRENGTH = achievement({
  id: "strength",
  name: "Fuerza bruta",
  condition_type: "sessions_category",
  condition_value: 25,
  condition_target: "strength",
})
const FIRST = achievement({
  id: "first",
  name: "Primera sesión",
  description: "Completá tu primer entrenamiento",
  condition_value: 1,
  xp_reward: 50,
})

const ALL = [FIRST, CLUB, TONS, WEEK, STREAK, STRENGTH]

function card(name: string) {
  return screen.getByRole("button", { name: new RegExp(name) })
}

function renderGrid(props: Partial<React.ComponentProps<typeof BadgeGrid>> = {}) {
  return render(
    <BadgeGrid
      all={ALL}
      earned={new Map([["first", "2026-08-03T15:00:00Z"]])}
      metrics={METRICS}
      streak={4}
      {...props}
    />,
  )
}

describe("BadgeGrid progress", () => {
  it("shows each locked achievement's own real progress", () => {
    renderGrid()

    expect(card("Club de las 100")).toHaveTextContent("12 / 100 sesiones")
    expect(card("Toneladas levantadas")).toHaveTextContent("12.500 / 100.000 kg")
    expect(card("Semana perfecta")).toHaveTextContent("3 / 5 sesiones")
    expect(card("Fuerza bruta")).toHaveTextContent("9 / 25 sesiones de Fuerza")
  })

  it("uses the display streak, not the metric that is 0 until the member trains today", () => {
    renderGrid({ streak: 4 })
    expect(card("Constancia de hierro")).toHaveTextContent("4 / 7 días")
  })

  it("describes what it takes to unlock a locked achievement", () => {
    renderGrid()

    expect(card("Club de las 100")).toHaveTextContent("Completar 100 sesiones en total")
    expect(card("Toneladas levantadas")).toHaveTextContent("Levantar 100.000 kg en total")
    expect(card("Constancia de hierro")).toHaveTextContent("Entrenar 7 días seguidos")
    expect(card("Fuerza bruta")).toHaveTextContent("Completar 25 sesiones de Fuerza")
  })

  it("shows the reward of a locked achievement", () => {
    renderGrid()
    expect(card("Club de las 100")).toHaveTextContent("+500 XP")
  })

  it("never shows the same number for every achievement", () => {
    renderGrid()
    const progressTexts = [CLUB, TONS, WEEK, STREAK, STRENGTH].map(
      (a) => /(\d[\d.]* \/ \d[\d.]*)/.exec(card(a.name).textContent ?? "")?.[1],
    )
    expect(new Set(progressTexts).size).toBe(progressTexts.length)
  })

  it("keeps the earned date on an earned achievement and shows no progress for it", () => {
    renderGrid()

    const earned = card("Primera sesión")
    expect(earned).toHaveTextContent("03/08/2026")
    expect(earned).toHaveTextContent("Completá tu primer entrenamiento")
    expect(earned).not.toHaveTextContent(/\d \/ \d/)
    expect(earned).not.toHaveTextContent("+50 XP")
  })

  it("reads the earned date in Argentina time: 23:30 AR is already the next UTC day", () => {
    renderGrid({ earned: new Map([["first", "2026-08-04T02:30:00Z"]]) })
    expect(card("Primera sesión")).toHaveTextContent("03/08/2026")
  })

  it("shows no numbers when the metrics are unavailable, and says so", () => {
    renderGrid({ metrics: null, streak: null })

    for (const a of [CLUB, TONS, WEEK, STREAK, STRENGTH]) {
      expect(card(a.name)).not.toHaveTextContent(/\d \/ \d/)
    }
    // The sentence still tells the member what to do.
    expect(card("Club de las 100")).toHaveTextContent("Completar 100 sesiones en total")
    expect(screen.getByText(/no podemos mostrar tu progreso/i)).toBeInTheDocument()
  })

  it("keeps the streak progress when only the metrics are unavailable", () => {
    renderGrid({ metrics: null, streak: 3 })

    expect(card("Constancia de hierro")).toHaveTextContent("3 / 7 días")
    expect(card("Club de las 100")).not.toHaveTextContent(/\d \/ \d/)
    expect(screen.getByText(/no podemos mostrar tu progreso/i)).toBeInTheDocument()
  })

  it("does not warn when everything is known", () => {
    renderGrid()
    expect(screen.queryByText(/no podemos mostrar tu progreso/i)).not.toBeInTheDocument()
  })

  it("does not warn when every achievement is already earned", () => {
    renderGrid({
      metrics: null,
      streak: null,
      earned: new Map(ALL.map((a) => [a.id, "2026-08-03T15:00:00Z"])),
    })
    expect(screen.queryByText(/no podemos mostrar tu progreso/i)).not.toBeInTheDocument()
  })

  it("tells the gym has no achievements", () => {
    render(<BadgeGrid all={[]} earned={new Map()} />)
    expect(screen.getByText("Este gimnasio aún no configuró logros")).toBeInTheDocument()
  })
})

describe("BadgeGrid medals", () => {
  it("never requests the missing default image; a trophy stands in for a missing icon", () => {
    const { container } = renderGrid()

    expect(container.querySelector('img[src="/badges/default.webp"]')).toBeNull()
    expect(card("Toneladas levantadas")).toHaveTextContent("🏆")
  })

  it("renders an image icon as an image and an emoji as text", () => {
    const withEmoji = achievement({ id: "fire", name: "En llamas", icon: "🔥", condition_value: 3 })
    const { container } = renderGrid({ all: [CLUB, withEmoji] })

    expect(container.querySelector('img[src="/medallas/medalla_fuerza.png"]')).not.toBeNull()
    expect(card("En llamas")).toHaveTextContent("🔥")
  })

  it("falls back to the trophy when an image fails to load", () => {
    const broken = achievement({ id: "broken", name: "Sin imagen", icon: "/medallas/missing.png" })
    const { container } = renderGrid({ all: [broken] })

    fireEvent.error(container.querySelector('img[src="/medallas/missing.png"]')!)
    expect(container.querySelector('img[src="/medallas/missing.png"]')).toBeNull()
    expect(card("Sin imagen")).toHaveTextContent("🏆")
  })
})

describe("BadgeGrid detail panel", () => {
  it("opens a locked achievement with its real progress, sentence and reward", () => {
    renderGrid()
    fireEvent.click(card("Club de las 100"))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("BLOQUEADA")).toBeInTheDocument()
    expect(within(dialog).getByText("Completar 100 sesiones en total")).toBeInTheDocument()
    expect(within(dialog).getByText("+500 XP")).toBeInTheDocument()

    const bar = within(dialog).getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuetext", "12 / 100 sesiones")
    expect(bar).toHaveAttribute("aria-valuenow", "12")
    expect(within(dialog).getByText("Sesiones completadas")).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent("19")
  })

  it("opens a locked achievement without a progress block when the numbers are unknown", () => {
    renderGrid({ metrics: null, streak: null })
    fireEvent.click(card("Club de las 100"))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).queryByRole("progressbar")).not.toBeInTheDocument()
    expect(within(dialog).getByText("Completar 100 sesiones en total")).toBeInTheDocument()
  })

  it("opens an earned achievement as completed, with no progress bar", () => {
    renderGrid()
    fireEvent.click(card("Primera sesión"))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("DESBLOQUEADA")).toBeInTheDocument()
    expect(within(dialog).getByText("Completado")).toBeInTheDocument()
    expect(within(dialog).getByText("Conseguida el 03/08/2026")).toBeInTheDocument()
    expect(within(dialog).queryByRole("progressbar")).not.toBeInTheDocument()
  })
})
