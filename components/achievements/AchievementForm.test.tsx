import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Achievement } from "@/types"
import AchievementForm from "./AchievementForm"

const mocks = vi.hoisted(() => ({
  saveAchievement: vi.fn(),
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
}))

vi.mock("@/app/actions/achievements", () => ({
  saveAchievement: mocks.saveAchievement,
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

function renderForm(props: Partial<React.ComponentProps<typeof AchievementForm>> = {}) {
  return render(
    <AchievementForm
      mode="create"
      onSuccess={mocks.onSuccess}
      onCancel={mocks.onCancel}
      {...props}
    />,
  )
}

const nameField = () => screen.getByLabelText("Nombre *") as HTMLInputElement
const typeField = () => screen.getByLabelText(/Tipo de condición/) as HTMLSelectElement
const valueField = () => screen.getByLabelText(/Cantidad/) as HTMLInputElement
const xpField = () => screen.getByLabelText(/Recompensa en XP/) as HTMLInputElement
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Crear logro|Guardar cambios/ }))

beforeEach(() => {
  mocks.saveAchievement.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("AchievementForm", () => {
  describe("cancel", () => {
    it("calls onCancel from the Cancelar button without saving", () => {
      renderForm()

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

      expect(mocks.onCancel).toHaveBeenCalledTimes(1)
      expect(mocks.saveAchievement).not.toHaveBeenCalled()
    })

    it("has a 44px Cancelar target", () => {
      renderForm()
      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("min-h-[44px]")
    })
  })

  describe("switching the edited item", () => {
    it("shows the new item's values when the parent changes the key", () => {
      const first = makeAchievement()
      const second = makeAchievement({
        id: "a2",
        name: "Semana perfecta",
        xp_reward: 150,
        condition_type: "sessions_week",
        condition_value: 5,
      })
      const { rerender } = render(
        <AchievementForm key={first.id} mode="edit" item={first} onSuccess={mocks.onSuccess} onCancel={mocks.onCancel} />,
      )
      fireEvent.change(nameField(), { target: { value: "Editado a medias" } })

      rerender(
        <AchievementForm key={second.id} mode="edit" item={second} onSuccess={mocks.onSuccess} onCancel={mocks.onCancel} />,
      )

      expect(nameField().value).toBe("Semana perfecta")
      expect(typeField().value).toBe("sessions_week")
      expect(valueField().value).toBe("5")
      expect(xpField().value).toBe("150")
    })
  })

  describe("opening", () => {
    // jsdom does not implement scrollIntoView, so it starts out undefined
    const original = Element.prototype.scrollIntoView

    afterEach(() => {
      Element.prototype.scrollIntoView = original
    })

    it("scrolls into view and moves focus to the form", () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      renderForm()

      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("form", { name: "Nuevo logro" })).toHaveFocus()
    })

    it("does not break where scrollIntoView is missing", () => {
      Element.prototype.scrollIntoView = undefined as unknown as typeof original
      expect(() => renderForm()).not.toThrow()
    })
  })

  describe("streak_days", () => {
    it("caps the value at 365 and explains why", () => {
      renderForm()
      expect(valueField()).not.toHaveAttribute("max")
      expect(screen.queryByText(/Máximo 365 días/)).not.toBeInTheDocument()

      fireEvent.change(typeField(), { target: { value: "streak_days" } })

      expect(valueField()).toHaveAttribute("max", "365")
      expect(screen.getByText(/Máximo 365 días/)).toBeInTheDocument()
    })

    it("flags a streak above 365 days while typing", () => {
      renderForm()
      fireEvent.change(typeField(), { target: { value: "streak_days" } })
      expect(valueField()).not.toHaveAttribute("aria-invalid")

      fireEvent.change(valueField(), { target: { value: "366" } })
      expect(valueField()).toHaveAttribute("aria-invalid", "true")

      fireEvent.change(valueField(), { target: { value: "365" } })
      expect(valueField()).not.toHaveAttribute("aria-invalid")
    })

    it("refuses to save a streak longer than 365 days", () => {
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Racha larga" } })
      fireEvent.change(typeField(), { target: { value: "streak_days" } })
      fireEvent.change(valueField(), { target: { value: "400" } })

      submit()

      expect(screen.getByRole("alert")).toHaveTextContent("La racha no puede pasar de 365 días")
      expect(mocks.saveAchievement).not.toHaveBeenCalled()
    })
  })

  describe("validation messages", () => {
    it("explains an out-of-range XP reward in Spanish without leaking the field key", () => {
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Logro" } })
      fireEvent.change(xpField(), { target: { value: "1500" } })

      submit()

      const alert = screen.getByRole("alert")
      expect(alert).toHaveTextContent("La recompensa de XP debe ser un número entero entre 1 y 1000.")
      expect(alert).not.toHaveTextContent("xp_reward")
      expect(mocks.saveAchievement).not.toHaveBeenCalled()
    })

    it("flags an out-of-range XP reward while typing", () => {
      renderForm()
      expect(xpField()).not.toHaveAttribute("aria-invalid")

      fireEvent.change(xpField(), { target: { value: "1001" } })
      expect(xpField()).toHaveAttribute("aria-invalid", "true")

      fireEvent.change(xpField(), { target: { value: "1000" } })
      expect(xpField()).not.toHaveAttribute("aria-invalid")
    })

    it("asks for a name when it is blank", () => {
      renderForm()
      fireEvent.change(nameField(), { target: { value: "   " } })

      submit()

      expect(screen.getByRole("alert")).toHaveTextContent("Ponele un nombre al logro.")
      expect(mocks.saveAchievement).not.toHaveBeenCalled()
    })

    it("shows the message the server action returns", async () => {
      mocks.saveAchievement.mockResolvedValue({ ok: false, error: "No autorizado" })
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Logro" } })

      submit()

      expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado")
      expect(mocks.onSuccess).not.toHaveBeenCalled()
    })

    it("shows a friendly message when the action throws", async () => {
      mocks.saveAchievement.mockRejectedValue(new Error("network down"))
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Logro" } })

      submit()

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("No pudimos guardar el logro")
      expect(alert).not.toHaveTextContent("network down")
      expect(screen.getByRole("button", { name: "Crear logro" })).toBeEnabled()
    })

    it("clears the message once the next submit is valid", async () => {
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Logro" } })
      fireEvent.change(xpField(), { target: { value: "0" } })
      submit()
      expect(screen.getByRole("alert")).toBeInTheDocument()

      fireEvent.change(xpField(), { target: { value: "20" } })
      submit()

      await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalledTimes(1))
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  describe("live condition sentence", () => {
    it("describes the condition and follows the fields", () => {
      renderForm()
      expect(screen.getByText("Completar 1 sesión en total")).toBeInTheDocument()

      fireEvent.change(valueField(), { target: { value: "100" } })
      expect(screen.getByText("Completar 100 sesiones en total")).toBeInTheDocument()

      fireEvent.change(typeField(), { target: { value: "total_xp" } })
      fireEvent.change(valueField(), { target: { value: "10000" } })
      expect(screen.getByText("Acumular 10.000 XP")).toBeInTheDocument()
    })

    it("uses the chosen category label", () => {
      renderForm()
      fireEvent.change(typeField(), { target: { value: "sessions_category" } })
      fireEvent.change(valueField(), { target: { value: "10" } })
      fireEvent.change(screen.getByLabelText(/Categoría/), { target: { value: "hiit" } })

      expect(screen.getByText("Completar 10 sesiones de HIIT")).toBeInTheDocument()
    })

    it("hides the sentence while the value is not a valid number", () => {
      renderForm()
      fireEvent.change(valueField(), { target: { value: "" } })
      expect(screen.queryByText(/Se gana al/)).not.toBeInTheDocument()
    })
  })

  describe("category", () => {
    it("only asks for a category on sessions_category, with clear labels", () => {
      renderForm()
      expect(screen.queryByLabelText(/Categoría/)).not.toBeInTheDocument()

      fireEvent.change(typeField(), { target: { value: "sessions_category" } })

      const labels = Array.from((screen.getByLabelText(/Categoría/) as HTMLSelectElement).options).map(
        (o) => o.textContent,
      )
      expect(labels).toEqual(["Fuerza", "Cardio", "HIIT", "Flexibilidad", "Equilibrio"])
    })

    it("does not swap an unknown stored category for another one", () => {
      renderForm({
        mode: "edit",
        item: makeAchievement({
          condition_type: "sessions_category",
          condition_target: "crossfit",
        }),
      })

      expect((screen.getByLabelText(/Categoría/) as HTMLSelectElement).value).toBe("")

      submit()
      expect(screen.getByRole("alert")).toHaveTextContent("Elegí la categoría de las sesiones.")
      expect(mocks.saveAchievement).not.toHaveBeenCalled()
    })
  })

  describe("medal picker", () => {
    it("shows the medal images, not their paths", () => {
      const { container } = renderForm()

      expect(container.querySelectorAll('img[src^="/medallas/"]')).toHaveLength(5)
      expect(container.textContent).not.toContain("/medallas")
      expect(screen.getByRole("button", { name: "Hierro" })).toBeInTheDocument()
    })

    it("selects and deselects a medal", () => {
      renderForm()
      const hierro = screen.getByRole("button", { name: "Hierro" })
      expect(hierro).toHaveAttribute("aria-pressed", "false")

      fireEvent.click(hierro)
      expect(hierro).toHaveAttribute("aria-pressed", "true")

      fireEvent.click(hierro)
      expect(hierro).toHaveAttribute("aria-pressed", "false")
    })

    it("keeps a stored icon the picker does not offer", () => {
      renderForm({ mode: "edit", item: makeAchievement({ icon: "🏆" }) })

      expect(screen.getByRole("button", { name: /Actual/ })).toHaveAttribute("aria-pressed", "true")
    })
  })

  describe("saving", () => {
    it("creates an achievement with the typed values", async () => {
      renderForm()
      fireEvent.change(nameField(), { target: { value: "  Club de las 100  " } })
      fireEvent.change(screen.getByLabelText(/Descripción/), { target: { value: "Cien sesiones" } })
      fireEvent.click(screen.getByRole("button", { name: "Fuerza" }))
      fireEvent.change(valueField(), { target: { value: "100" } })
      fireEvent.change(xpField(), { target: { value: "500" } })

      submit()

      await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalledTimes(1))
      expect(mocks.saveAchievement).toHaveBeenCalledWith({
        name: "Club de las 100",
        description: "Cien sesiones",
        icon: "/medallas/medalla_fuerza.png",
        xp_reward: 500,
        condition_type: "total_sessions",
        condition_value: 100,
        condition_target: undefined,
      })
    })

    it("updates an existing achievement by id and sends the category only when needed", async () => {
      renderForm({
        mode: "edit",
        item: makeAchievement({
          condition_type: "sessions_category",
          condition_value: 10,
          condition_target: "flexibility",
        }),
      })

      submit()

      await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalledTimes(1))
      expect(mocks.saveAchievement).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "a1",
          condition_type: "sessions_category",
          condition_target: "flexibility",
        }),
      )
    })

    it("disables the submit button and says so while saving", async () => {
      let finish: (value: { ok: true }) => void = () => {}
      mocks.saveAchievement.mockReturnValue(new Promise((resolve) => (finish = resolve)))
      renderForm()
      fireEvent.change(nameField(), { target: { value: "Logro" } })

      submit()

      const saving = await screen.findByRole("button", { name: "Guardando…" })
      expect(saving).toBeDisabled()

      finish({ ok: true })
      await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalled())
    })
  })
})
