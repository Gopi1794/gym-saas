import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Achievement } from "@/types"
import AchievementList from "./AchievementList"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  saveAchievement: vi.fn(),
  deleteAchievement: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock("@/app/actions/achievements", () => ({
  saveAchievement: mocks.saveAchievement,
  deleteAchievement: mocks.deleteAchievement,
}))

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: "a1",
    gym_id: "gym-1",
    name: "Primera sesión",
    description: "Completá tu primer entrenamiento",
    icon: "/medallas/medalla_hierro.png",
    xp_reward: 50,
    condition_type: "total_sessions",
    condition_value: 1,
    condition_target: null,
    created_at: "2026-08-01T12:00:00Z",
    ...overrides,
  }
}

const FIRST = makeAchievement()
const SECOND = makeAchievement({
  id: "a2",
  name: "Fuerza bruta",
  description: null,
  icon: "🔥",
  xp_reward: 1000,
  condition_type: "sessions_category",
  condition_value: 10,
  condition_target: "strength",
})
const THIRD = makeAchievement({
  id: "a3",
  name: "Sin medalla",
  icon: null,
  xp_reward: 200,
  condition_type: "total_xp",
  condition_value: 10000,
})

function table() {
  return screen.getByRole("table")
}

beforeEach(() => {
  mocks.saveAchievement.mockResolvedValue({ ok: true })
  mocks.deleteAchievement.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("AchievementList", () => {
  it("renders the card list and the table (CSS picks one per breakpoint)", () => {
    render(<AchievementList items={[FIRST, SECOND]} />)

    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2)
    expect(table()).toBeInTheDocument()
    expect(within(table()).getAllByRole("row")).toHaveLength(3) // header + 2
  })

  it("shows how many achievements there are", () => {
    const { rerender } = render(<AchievementList items={[FIRST]} />)
    expect(screen.getByText("1 logro")).toBeInTheDocument()

    rerender(<AchievementList items={[FIRST, SECOND]} />)
    expect(screen.getByText("2 logros")).toBeInTheDocument()
  })

  describe("medal", () => {
    it("renders the medal image and never prints the path", () => {
      const { container } = render(<AchievementList items={[FIRST]} />)

      const images = container.querySelectorAll('img[src="/medallas/medalla_hierro.png"]')
      expect(images).toHaveLength(2) // card + table
      expect(screen.queryByText("/medallas/medalla_hierro.png")).not.toBeInTheDocument()
      expect(container.textContent).not.toContain("/medallas")
    })

    it("renders an emoji icon as text and the trophy when there is no icon", () => {
      const { container } = render(<AchievementList items={[SECOND, THIRD]} />)

      expect(container.querySelector("img")).toBeNull()
      expect(within(table()).getByText("🔥")).toBeInTheDocument()
      expect(within(table()).getByText("🏆")).toBeInTheDocument()
    })
  })

  describe("information", () => {
    it("shows the condition as a sentence in both layouts", () => {
      render(<AchievementList items={[SECOND]} />)

      expect(screen.getAllByText("Completar 10 sesiones de Fuerza")).toHaveLength(2)
      expect(within(table()).getByText("Completar 10 sesiones de Fuerza")).toBeInTheDocument()
      expect(
        within(screen.getByRole("list")).getByText("Completar 10 sesiones de Fuerza"),
      ).toBeInTheDocument()
    })

    it("uses singular and thousands separators in the sentences", () => {
      render(<AchievementList items={[FIRST, THIRD]} />)

      expect(screen.getAllByText("Completar 1 sesión en total")).toHaveLength(2)
      expect(screen.getAllByText("Acumular 10.000 XP")).toHaveLength(2)
    })

    it("shows name, description and XP reward in both layouts", () => {
      render(<AchievementList items={[FIRST, SECOND]} />)

      expect(screen.getAllByText("Primera sesión")).toHaveLength(2)
      expect(screen.getAllByText("Completá tu primer entrenamiento")).toHaveLength(2)
      expect(screen.getAllByText("+50 XP")).toHaveLength(2)
      expect(screen.getAllByText("+1.000 XP")).toHaveLength(2)
    })

    it("omits the description line when there is none", () => {
      render(<AchievementList items={[SECOND]} />)
      const card = within(screen.getByRole("list")).getByRole("listitem")
      // name + condition sentence + XP badge, no description paragraph
      expect(card.querySelectorAll("p")).toHaveLength(2)
    })
  })

  describe("empty state", () => {
    it("explains what achievements are and offers the create button", () => {
      render(<AchievementList items={[]} />)

      expect(screen.getByText("Todavía no hay logros")).toBeInTheDocument()
      expect(screen.getByText(/se desbloquean solos/)).toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: "Nuevo logro" })).toHaveLength(1)
      expect(screen.queryByRole("table")).not.toBeInTheDocument()
    })

    it("opens the create form from the empty state and can cancel back to it", () => {
      render(<AchievementList items={[]} />)

      fireEvent.click(screen.getByRole("button", { name: "Nuevo logro" }))
      expect(screen.getByRole("heading", { name: "Nuevo logro" })).toBeInTheDocument()
      expect(screen.queryByText("Todavía no hay logros")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
      expect(screen.queryByRole("heading", { name: "Nuevo logro" })).not.toBeInTheDocument()
      expect(screen.getByText("Todavía no hay logros")).toBeInTheDocument()
    })
  })

  describe("edit", () => {
    it("opens the form for the clicked row with its values", () => {
      render(<AchievementList items={[FIRST, SECOND]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Fuerza bruta" }))

      expect(screen.getByRole("heading", { name: "Editar logro" })).toBeInTheDocument()
      expect(screen.getByLabelText("Nombre *")).toHaveValue("Fuerza bruta")
      expect(screen.getByLabelText(/Recompensa en XP/)).toHaveValue(1000)
    })

    it("works from the card layout too", () => {
      render(<AchievementList items={[FIRST]} />)

      fireEvent.click(
        within(screen.getByRole("list")).getByRole("button", { name: "Editar Primera sesión" }),
      )
      expect(screen.getByLabelText("Nombre *")).toHaveValue("Primera sesión")
    })

    it("shows the second row's values when switching from one edited row to another", () => {
      render(<AchievementList items={[FIRST, SECOND]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Primera sesión" }))
      fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "Cambio a medias" } })

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Fuerza bruta" }))

      expect(screen.getByLabelText("Nombre *")).toHaveValue("Fuerza bruta")
      expect(screen.getByLabelText(/Tipo de condición/)).toHaveValue("sessions_category")
      expect(screen.getByLabelText(/Cantidad/)).toHaveValue(10)
    })

    it("starts from a blank form when creating after editing", () => {
      render(<AchievementList items={[FIRST]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Primera sesión" }))
      fireEvent.click(screen.getByRole("button", { name: "Nuevo logro" }))

      expect(screen.getByRole("heading", { name: "Nuevo logro" })).toBeInTheDocument()
      expect(screen.getByLabelText("Nombre *")).toHaveValue("")
    })

    it("closes the form and refreshes after a successful save", async () => {
      render(<AchievementList items={[FIRST]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Primera sesión" }))
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
      expect(mocks.saveAchievement).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a1", name: "Primera sesión" }),
      )
      expect(screen.queryByRole("heading", { name: "Editar logro" })).not.toBeInTheDocument()
    })
  })

  describe("delete", () => {
    it("deletes the row after the confirmation and refreshes", async () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
      render(<AchievementList items={[FIRST, SECOND]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Eliminar Fuerza bruta" }))

      expect(confirm).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(mocks.deleteAchievement).toHaveBeenCalledWith("a2"))
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    })

    it("does nothing when the confirmation is dismissed", () => {
      vi.spyOn(window, "confirm").mockReturnValue(false)
      render(<AchievementList items={[FIRST]} />)

      fireEvent.click(
        within(screen.getByRole("list")).getByRole("button", { name: "Eliminar Primera sesión" }),
      )

      expect(mocks.deleteAchievement).not.toHaveBeenCalled()
      expect(mocks.refresh).not.toHaveBeenCalled()
    })

    it("tells the admin when the delete fails and keeps the row", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true)
      mocks.deleteAchievement.mockResolvedValue({ ok: false, error: "boom" })
      render(<AchievementList items={[FIRST]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Eliminar Primera sesión" }))

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos eliminar el logro")
      expect(mocks.refresh).not.toHaveBeenCalled()
      expect(within(table()).getByText("Primera sesión")).toBeInTheDocument()
    })

    it("closes the form when the row being edited is deleted", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true)
      render(<AchievementList items={[FIRST, SECOND]} />)

      fireEvent.click(within(table()).getByRole("button", { name: "Editar Primera sesión" }))
      fireEvent.click(within(table()).getByRole("button", { name: "Eliminar Primera sesión" }))

      await waitFor(() =>
        expect(screen.queryByRole("heading", { name: "Editar logro" })).not.toBeInTheDocument(),
      )
    })
  })

  it("names every action button and keeps a 44px target on the touch (card) layout", () => {
    render(<AchievementList items={[FIRST]} />)
    const cards = within(screen.getByRole("list"))

    for (const name of ["Editar Primera sesión", "Eliminar Primera sesión"]) {
      expect(cards.getByRole("button", { name })).toHaveClass("h-11", "w-11")
      expect(within(table()).getByRole("button", { name })).toBeInTheDocument()
    }
  })
})
