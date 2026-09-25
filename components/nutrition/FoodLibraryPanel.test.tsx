import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Food, FoodsPage } from "@/app/actions/nutrition"
import type { FoodChipSlug, FoodFacets } from "@/lib/food-library"
import FoodLibraryPanel from "./FoodLibraryPanel"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  createFood: vi.fn(),
  updateFood: vi.fn(),
  deleteFood: vi.fn(),
  search: { current: "" },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  usePathname: () => "/nutricion",
  useSearchParams: () => new URLSearchParams(mocks.search.current),
}))

vi.mock("@/app/actions/nutrition", () => ({
  createFood: mocks.createFood,
  updateFood: mocks.updateFood,
  deleteFood: mocks.deleteFood,
}))

const FACETS: FoodFacets = {
  all: 423,
  mine: 24,
  uncategorized: 5,
  categories: {
    "Carnes y derivados": 61,
    "Pescados, mariscos y conservas": 30,
    "Huevos y derivados": 6,
    "Leche y derivados": 40,
    "Cereales y derivados": 60,
    "Vegetales y derivados": 70,
    "Frutas y derivados": 45,
    "Grasas y aceites": 20,
    "Productos azucarados": 0,
    "Misceláneos": 12,
  },
}

const CHIP_TEXTS = [
  "Todos 423",
  "Mis alimentos 24",
  "Carnes 61",
  "Pescados 30",
  "Huevos 6",
  "Lácteos 40",
  "Cereales 60",
  "Vegetales 70",
  "Frutas 45",
  "Grasas y aceites 20",
  "Dulces 0",
  "Otros 17",
]

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    gym_id: null,
    name: "Pechuga de pollo",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    sodium: 74,
    household_unit: null,
    grams_per_unit: null,
    sugars: null,
    saturated_fat: null,
    potassium: null,
    calcium: null,
    magnesium: null,
    zinc: null,
    iron: null,
    vitamin_b12: null,
    source: "argenfoods",
    category: "Carnes y derivados",
    subcategory: "Aves",
    ...overrides,
  }
}

function makeFoods(count: number): Food[] {
  return Array.from({ length: count }, (_, index) =>
    makeFood({ id: `food-${index + 1}`, name: `Alimento ${index + 1}`, subcategory: null })
  )
}

function makePage(overrides: Partial<FoodsPage> = {}): FoodsPage {
  return { foods: makeFoods(24), total: 423, facets: FACETS, page: 1, pageSize: 24, ...overrides }
}

type PanelProps = { foodsPage?: FoodsPage; query?: string; chip?: FoodChipSlug }

function panel({ foodsPage = makePage(), query = "", chip = "todos" }: PanelProps = {}) {
  return <FoodLibraryPanel gymId="gym-1" foodsPage={foodsPage} query={query} chip={chip} />
}

function renderPanel(props: PanelProps = {}) {
  return render(panel(props))
}

const chipGroup = () => screen.getByRole("group", { name: "Filtrar por categoría" })
const chipButtons = () => within(chipGroup()).getAllByRole("button")
const searchInput = () => screen.getByRole("searchbox", { name: "Buscar alimento" })
const lastReplace = () => mocks.replace.mock.calls.at(-1)

const OWN_FOOD = makeFood({
  id: "own-1",
  gym_id: "gym-1",
  name: "Batido casero",
  category: "Leche y derivados",
  subcategory: null,
  source: undefined,
})

beforeEach(() => {
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
  mocks.createFood.mockReset().mockResolvedValue(makeFood())
  mocks.updateFood.mockReset().mockResolvedValue(undefined)
  mocks.deleteFood.mockReset().mockResolvedValue(undefined)
  mocks.search.current = "tab=alimentos"
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe("category chips", () => {
  it("renders every chip in order with its count", () => {
    renderPanel()
    expect(chipButtons().map((button) => button.textContent)).toEqual(CHIP_TEXTS)
  })

  it("marks only the active chip as pressed", () => {
    renderPanel({ chip: "carnes" })
    const pressed = chipButtons().filter((button) => button.getAttribute("aria-pressed") === "true")
    expect(pressed.map((button) => button.textContent)).toEqual(["Carnes 61"])
  })

  it("marks todos as pressed by default", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: "Todos 423" })).toHaveAttribute("aria-pressed", "true")
  })

  it("dims an empty inactive chip but keeps it clickable", () => {
    renderPanel()
    const dulces = screen.getByRole("button", { name: "Dulces 0" })
    expect(dulces).toHaveClass("opacity-60")
    expect(dulces).toBeEnabled()

    fireEvent.click(dulces)
    expect(lastReplace()).toEqual(["/nutricion?tab=alimentos&cat=dulces", { scroll: false }])
  })

  it("does not dim an empty chip that is active", () => {
    renderPanel({ chip: "dulces" })
    expect(screen.getByRole("button", { name: "Dulces 0" })).not.toHaveClass("opacity-60")
  })

  it("scrolls the active chip into view so it is not hidden in the phone row", () => {
    renderPanel({ chip: "otros" })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" })
  })

  it("replaces the URL with cat=<slug>, keeps the tab and drops the page", () => {
    mocks.search.current = "tab=alimentos&page=3"
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Carnes 61" }))

    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(lastReplace()).toEqual(["/nutricion?tab=alimentos&cat=carnes", { scroll: false }])
  })

  it("keeps the search text when changing chip", () => {
    mocks.search.current = "tab=alimentos&q=queso&page=2"
    renderPanel({ query: "queso" })
    fireEvent.click(screen.getByRole("button", { name: "Lácteos 40" }))

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&q=queso&cat=lacteos")
  })

  it("removes cat when going back to todos", () => {
    mocks.search.current = "tab=alimentos&cat=carnes&q=pollo&page=2"
    renderPanel({ chip: "carnes", query: "pollo" })
    fireEvent.click(screen.getByRole("button", { name: "Todos 423" }))

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&q=pollo")
  })

  it("keeps the filter when the active chip is selected again", () => {
    mocks.search.current = "tab=alimentos&cat=carnes"
    renderPanel({ chip: "carnes" })
    fireEvent.click(screen.getByRole("button", { name: "Carnes 61" }))

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&cat=carnes")
  })
})

describe("search", () => {
  it("shows the query from the URL", () => {
    renderPanel({ query: "queso" })
    expect(searchInput()).toHaveValue("queso")
  })

  it("waits 300 ms before replacing the URL, then sets q and resets the page", () => {
    vi.useFakeTimers()
    mocks.search.current = "tab=alimentos&page=3"
    renderPanel()

    fireEvent.change(searchInput(), { target: { value: "queso" } })
    act(() => { vi.advanceTimersByTime(299) })
    expect(mocks.replace).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1) })
    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(lastReplace()).toEqual(["/nutricion?tab=alimentos&q=queso", { scroll: false }])
  })

  it("only searches for the last text after rapid typing", () => {
    vi.useFakeTimers()
    renderPanel()

    fireEvent.change(searchInput(), { target: { value: "q" } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(searchInput(), { target: { value: "qu" } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(searchInput(), { target: { value: "queso" } })
    act(() => { vi.advanceTimersByTime(300) })

    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&q=queso")
  })

  it("does not navigate when the trimmed text matches the current query", () => {
    vi.useFakeTimers()
    renderPanel({ query: "queso" })

    fireEvent.change(searchInput(), { target: { value: "queso " } })
    act(() => { vi.advanceTimersByTime(300) })

    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("searches right away when the search is submitted", () => {
    renderPanel()
    fireEvent.change(searchInput(), { target: { value: "arroz" } })
    fireEvent.submit(screen.getByRole("search"))

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&q=arroz")
  })

  it("keeps the current chip when the search changes", () => {
    vi.useFakeTimers()
    mocks.search.current = "tab=alimentos&cat=carnes"
    renderPanel({ chip: "carnes" })

    fireEvent.change(searchInput(), { target: { value: "pollo" } })
    act(() => { vi.advanceTimersByTime(300) })

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&cat=carnes&q=pollo")
  })

  it("follows the URL when the query changes from outside", () => {
    const { rerender } = renderPanel({ query: "queso" })
    expect(searchInput()).toHaveValue("queso")

    rerender(panel({ query: "" }))
    expect(searchInput()).toHaveValue("")
  })

  it("does not overwrite newer typing when the response to an earlier search arrives", () => {
    vi.useFakeTimers()
    const { rerender } = renderPanel()

    fireEvent.change(searchInput(), { target: { value: "queso" } })
    act(() => { vi.advanceTimersByTime(300) })
    fireEvent.change(searchInput(), { target: { value: "queso fresco" } })

    rerender(panel({ query: "queso" }))
    expect(searchInput()).toHaveValue("queso fresco")
  })

  describe("clear button", () => {
    it("is hidden while the field is empty", () => {
      renderPanel()
      expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).not.toBeInTheDocument()
    })

    it("empties the field and removes q from the URL right away", () => {
      mocks.search.current = "tab=alimentos&q=queso&page=2"
      renderPanel({ query: "queso" })

      fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }))

      expect(searchInput()).toHaveValue("")
      expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos")
      expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).not.toBeInTheDocument()
    })

    it("cancels a search that was still waiting to be sent", () => {
      vi.useFakeTimers()
      renderPanel()

      fireEvent.change(searchInput(), { target: { value: "que" } })
      fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }))
      act(() => { vi.advanceTimersByTime(500) })

      expect(mocks.replace).not.toHaveBeenCalled()
    })
  })
})

describe("summary", () => {
  it("shows the visible range and the total", () => {
    renderPanel({ foodsPage: makePage({ total: 351 }) })
    expect(screen.getByText("Mostrando 1–24 de 351 alimentos")).toBeInTheDocument()
  })

  it("moves the range with the page", () => {
    renderPanel({ foodsPage: makePage({ total: 351, page: 2 }) })
    expect(screen.getByText("Mostrando 25–48 de 351 alimentos")).toBeInTheDocument()
  })

  it("ends the range at the last row of the last page", () => {
    renderPanel({ foodsPage: makePage({ foods: makeFoods(15), total: 351, page: 15 }) })
    expect(screen.getByText("Mostrando 337–351 de 351 alimentos")).toBeInTheDocument()
  })

  it("uses the singular for one food", () => {
    renderPanel({ foodsPage: makePage({ foods: makeFoods(1), total: 1 }) })
    expect(screen.getByText("1 alimento")).toBeInTheDocument()
  })

  it("says there are no results", () => {
    renderPanel({ foodsPage: makePage({ foods: [], total: 0 }) })
    expect(screen.getByText("Sin resultados")).toBeInTheDocument()
  })

  it("mentions the search text", () => {
    const { rerender } = renderPanel({ query: "queso", foodsPage: makePage({ foods: makeFoods(3), total: 3 }) })
    expect(screen.getByText('Mostrando 1–3 de 3 alimentos para "queso"')).toBeInTheDocument()

    rerender(panel({ query: "queso", foodsPage: makePage({ foods: makeFoods(1), total: 1 }) }))
    expect(screen.getByText('1 alimento para "queso"')).toBeInTheDocument()

    rerender(panel({ query: "queso", foodsPage: makePage({ foods: [], total: 0 }) }))
    expect(screen.getByText('Sin resultados para "queso"')).toBeInTheDocument()
  })

  it("is announced politely", () => {
    renderPanel()
    expect(screen.getByText(/^Mostrando/)).toHaveAttribute("aria-live", "polite")
  })
})

describe("pagination", () => {
  const nav = () => screen.getByRole("navigation", { name: "Paginación" })
  const previous = () => within(nav()).getByRole("button", { name: "Anterior" })
  const next = () => within(nav()).getByRole("button", { name: "Siguiente" })

  it("shows the page and disables Anterior on the first page", () => {
    renderPanel()
    expect(within(nav()).getByText("Página 1 de 18")).toBeInTheDocument()
    expect(previous()).toBeDisabled()
    expect(next()).toBeEnabled()
  })

  it("disables Siguiente on the last page", () => {
    renderPanel({ foodsPage: makePage({ foods: makeFoods(15), page: 18 }) })
    expect(within(nav()).getByText("Página 18 de 18")).toBeInTheDocument()
    expect(next()).toBeDisabled()
    expect(previous()).toBeEnabled()
  })

  it("is hidden when everything fits in one page", () => {
    renderPanel({ foodsPage: makePage({ foods: makeFoods(10), total: 10 }) })
    expect(screen.queryByRole("navigation", { name: "Paginación" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument()
  })

  it("goes to the next page keeping the other params", () => {
    mocks.search.current = "tab=alimentos&q=pollo&cat=carnes"
    renderPanel({ query: "pollo", chip: "carnes" })
    fireEvent.click(next())

    expect(lastReplace()).toEqual(["/nutricion?tab=alimentos&q=pollo&cat=carnes&page=2", { scroll: false }])
  })

  it("goes to the previous page", () => {
    mocks.search.current = "tab=alimentos&page=5"
    renderPanel({ foodsPage: makePage({ page: 5 }) })
    fireEvent.click(previous())

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos&page=4")
  })

  it("leaves page out of the URL when going back to the first page", () => {
    mocks.search.current = "tab=alimentos&page=2"
    renderPanel({ foodsPage: makePage({ page: 2 }) })
    fireEvent.click(previous())

    expect(lastReplace()?.[0]).toBe("/nutricion?tab=alimentos")
  })

  it("does nothing from a disabled button", () => {
    renderPanel()
    fireEvent.click(previous())
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("scrolls the results into view smoothly when the page changes", () => {
    renderPanel()
    fireEvent.click(next())

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
  })

  it("does not animate the scroll when the user prefers reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    renderPanel()
    fireEvent.click(next())

    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)")
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" })
  })
})

describe("empty state", () => {
  const emptyPage = () => makePage({ foods: [], total: 0 })

  it("explains that nothing matched the search", () => {
    renderPanel({ foodsPage: emptyPage(), query: "zzz" })
    expect(screen.getByText("No encontramos alimentos")).toBeInTheDocument()
    expect(screen.getByText(/No hay resultados para "zzz"/)).toBeInTheDocument()
  })

  it("clears the search, the chip and the page, keeping the tab", () => {
    mocks.search.current = "tab=alimentos&q=zzz&cat=carnes&page=2"
    renderPanel({ foodsPage: emptyPage(), query: "zzz", chip: "carnes" })

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))

    expect(lastReplace()).toEqual(["/nutricion?tab=alimentos", { scroll: false }])
    expect(searchInput()).toHaveValue("")
  })

  it("suggests Agregar when the gym has no foods of its own", () => {
    renderPanel({ foodsPage: emptyPage(), chip: "mios" })
    expect(screen.getByText(/Todavía no agregaste alimentos propios/)).toHaveTextContent('Usá "Agregar"')
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument()
  })

  it("names the empty category", () => {
    renderPanel({ foodsPage: emptyPage(), chip: "lacteos" })
    expect(screen.getByText("No hay alimentos en Lácteos por ahora.")).toBeInTheDocument()
  })

  it("offers no filters to clear when none are applied", () => {
    renderPanel({ foodsPage: emptyPage() })
    expect(screen.getByText("No encontramos alimentos")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument()
  })

  it("hides the pagination", () => {
    renderPanel({ foodsPage: emptyPage() })
    expect(screen.queryByRole("navigation", { name: "Paginación" })).not.toBeInTheDocument()
  })
})

describe("food list", () => {
  it("renders each food in both the table and the card list", () => {
    const { container } = renderPanel({ foodsPage: makePage({ foods: [makeFood()], total: 1 }) })

    expect(screen.getAllByText("Pechuga de pollo")).toHaveLength(2)
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(container.querySelectorAll("ul > li")).toHaveLength(1)
  })

  it("shows kcal and macros in the table", () => {
    const { container } = renderPanel({ foodsPage: makePage({ foods: [makeFood()], total: 1 }) })
    const cells = Array.from(container.querySelectorAll("tbody tr td")).map((cell) => cell.textContent)

    expect(cells.slice(1, 5)).toEqual(["165", "31 g", "0 g", "3.6 g"])
  })

  it("shows a compact macro line on the card", () => {
    renderPanel({ foodsPage: makePage({ foods: [makeFood()], total: 1 }) })
    expect(screen.getByText("P 31 g · C 0 g · G 3.6 g")).toBeInTheDocument()
    expect(screen.getByText("kcal")).toBeInTheDocument()
  })

  it("rounds long decimals to one place", () => {
    renderPanel({ foodsPage: makePage({ foods: [makeFood({ calories: 164.96, protein: 31.2000001, fat: 3.55 })], total: 1 }) })
    expect(screen.getByText("P 31.2 g · C 0 g · G 3.6 g")).toBeInTheDocument()
    expect(screen.getAllByText("165")).toHaveLength(2)
  })

  it("shows the household portion or a dash", () => {
    renderPanel({
      foodsPage: makePage({
        foods: [
          makeFood({ id: "a", name: "Huevo", household_unit: "1 unidad", grams_per_unit: 50 }),
          makeFood({ id: "b", name: "Arroz" }),
        ],
        total: 2,
      }),
    })
    expect(screen.getByText("1 unidad = 50 g")).toBeInTheDocument()
    expect(screen.getAllByText("Sin porción")).toHaveLength(1)
  })

  describe("subcategory tag", () => {
    const foods = [
      makeFood({ id: "a", name: "Pechuga", category: "Carnes y derivados", subcategory: "Aves" }),
      makeFood({ id: "b", name: "Bife", category: "Carnes y derivados", subcategory: "Carnes y derivados" }),
      makeFood({ id: "c", name: "Chorizo", category: "Otra", subcategory: "Carnes y derivados" }),
      makeFood({ id: "d", name: "Aceite", category: "Grasas y aceites", subcategory: null }),
    ]

    it("shows a subcategory that adds information", () => {
      renderPanel({ foodsPage: makePage({ foods, total: 4 }) })
      expect(screen.getAllByText("Aves")).toHaveLength(2)
    })

    it("hides a subcategory equal to the food's own category", () => {
      renderPanel({ foodsPage: makePage({ foods: [foods[1]], total: 1 }) })
      expect(screen.queryByText("Carnes y derivados")).not.toBeInTheDocument()
    })

    it("hides a subcategory equal to the active chip's category", () => {
      renderPanel({ foodsPage: makePage({ foods: [foods[2]], total: 1 }), chip: "carnes" })
      expect(screen.queryByText("Carnes y derivados")).not.toBeInTheDocument()
    })

    it("shows that same subcategory when no chip narrows the list", () => {
      renderPanel({ foodsPage: makePage({ foods: [foods[2]], total: 1 }), chip: "todos" })
      expect(screen.getAllByText("Carnes y derivados")).toHaveLength(2)
    })
  })

  describe("edit and delete controls", () => {
    const foods = [makeFood({ id: "cat-1", name: "Arroz blanco", gym_id: null }), OWN_FOOD]

    it("are offered only for foods owned by the gym", () => {
      renderPanel({ foodsPage: makePage({ foods, total: 2 }) })

      expect(screen.queryByRole("button", { name: "Editar Arroz blanco" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Eliminar Arroz blanco" })).not.toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: "Editar Batido casero" })).toHaveLength(2)
      expect(screen.getAllByRole("button", { name: "Eliminar Batido casero" })).toHaveLength(2)
    })
  })

  describe("detail", () => {
    const foodsPage = () => makePage({ foods: [makeFood(), OWN_FOOD], total: 2 })
    const firstRow = (container: HTMLElement) => container.querySelector("tbody tr") as HTMLElement

    it("makes each table row focusable", () => {
      const { container } = renderPanel({ foodsPage: foodsPage() })
      expect(firstRow(container)).toHaveAttribute("tabindex", "0")
    })

    it("opens on row click", () => {
      const { container } = renderPanel({ foodsPage: foodsPage() })
      fireEvent.click(firstRow(container))
      expect(screen.getByRole("dialog", { name: "Pechuga de pollo" })).toBeInTheDocument()
    })

    it.each(["Enter", " "])("opens with the %j key on a row", (key) => {
      const { container } = renderPanel({ foodsPage: foodsPage() })
      fireEvent.keyDown(firstRow(container), { key })
      expect(screen.getByRole("dialog", { name: "Pechuga de pollo" })).toBeInTheDocument()
    })

    it("ignores other keys on a row", () => {
      const { container } = renderPanel({ foodsPage: foodsPage() })
      fireEvent.keyDown(firstRow(container), { key: "a" })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("opens from the card button", () => {
      renderPanel({ foodsPage: foodsPage() })
      fireEvent.click(screen.getByRole("button", { name: "Pechuga de pollo" }))
      expect(screen.getByRole("dialog", { name: "Pechuga de pollo" })).toBeInTheDocument()
    })

    it("closes with the close button", () => {
      const { container } = renderPanel({ foodsPage: foodsPage() })
      fireEvent.click(firstRow(container))
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar" }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("does not open when the edit button inside a row is clicked", () => {
      renderPanel({ foodsPage: foodsPage() })
      fireEvent.click(screen.getAllByRole("button", { name: "Editar Batido casero" })[0])

      expect(screen.getByRole("dialog", { name: "Editar alimento" })).toBeInTheDocument()
      expect(screen.queryByRole("dialog", { name: "Batido casero" })).not.toBeInTheDocument()
    })

    it("does not open when a key is pressed on a control inside a row", () => {
      renderPanel({ foodsPage: foodsPage() })
      fireEvent.keyDown(screen.getAllByRole("button", { name: "Editar Batido casero" })[0], { key: "Enter" })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})

describe("create and edit", () => {
  const dialog = () => screen.getByRole("dialog")

  it("offers Sin categoría plus every category", () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))

    const select = within(dialog()).getByLabelText("Categoría (opcional)")
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Sin categoría",
      "Carnes",
      "Pescados",
      "Huevos",
      "Lácteos",
      "Cereales",
      "Vegetales",
      "Frutas",
      "Grasas y aceites",
      "Dulces",
      "Otros",
    ])
    expect(select).toHaveValue("")
  })

  it("creates the food with the chosen category, then refreshes and closes", async () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))

    fireEvent.change(within(dialog()).getByLabelText("Nombre"), { target: { value: "Yogur casero" } })
    fireEvent.change(within(dialog()).getByLabelText("Categoría (opcional)"), { target: { value: "Leche y derivados" } })
    fireEvent.change(within(dialog()).getByLabelText("Calorías (kcal)"), { target: { value: "62" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(mocks.createFood).toHaveBeenCalledWith(
      "gym-1",
      expect.objectContaining({ name: "Yogur casero", category: "Leche y derivados", calories: 62 })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("creates the food without a category by default", async () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))
    fireEvent.change(within(dialog()).getByLabelText("Nombre"), { target: { value: "Receta" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(mocks.createFood).toHaveBeenCalled())
    expect(mocks.createFood.mock.calls[0][1]).toMatchObject({ name: "Receta", category: null })
  })

  it("does not save a food without a name", () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))
    expect(within(dialog()).getByRole("button", { name: "Guardar" })).toBeDisabled()
    expect(mocks.createFood).not.toHaveBeenCalled()
  })

  it("opens the edit form with the food's category selected", () => {
    renderPanel({ foodsPage: makePage({ foods: [OWN_FOOD], total: 1 }) })
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Batido casero" })[0])

    expect(within(dialog()).getByLabelText("Nombre")).toHaveValue("Batido casero")
    expect(within(dialog()).getByLabelText("Categoría (opcional)")).toHaveValue("Leche y derivados")
  })

  it("keeps a category that is not in the list instead of dropping it", () => {
    renderPanel({ foodsPage: makePage({ foods: [makeFood({ ...OWN_FOOD, category: "Categoría vieja" })], total: 1 }) })
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Batido casero" })[0])

    expect(within(dialog()).getByLabelText("Categoría (opcional)")).toHaveValue("Categoría vieja")
  })

  it("updates the food with the new category, then refreshes and closes", async () => {
    renderPanel({ foodsPage: makePage({ foods: [OWN_FOOD], total: 1 }) })
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Batido casero" })[0])

    fireEvent.change(within(dialog()).getByLabelText("Categoría (opcional)"), { target: { value: "" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(mocks.updateFood).toHaveBeenCalledWith("own-1", expect.objectContaining({ name: "Batido casero", category: null }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes without saving on Cancelar", () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.createFood).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe("delete", () => {
  const foodsPage = () => makePage({ foods: [OWN_FOOD], total: 1 })

  it("deletes after confirmation and refreshes", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    renderPanel({ foodsPage: foodsPage() })
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar Batido casero" })[0])

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(mocks.deleteFood).toHaveBeenCalledWith("own-1")
  })

  it("does nothing when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false)
    renderPanel({ foodsPage: foodsPage() })
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar Batido casero" })[0])

    expect(mocks.deleteFood).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("deletes from the detail modal and closes it", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    renderPanel({ foodsPage: foodsPage() })
    fireEvent.click(screen.getByRole("button", { name: "Batido casero" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(mocks.deleteFood).toHaveBeenCalledWith("own-1"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps the detail modal open when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false)
    renderPanel({ foodsPage: foodsPage() })
    fireEvent.click(screen.getByRole("button", { name: "Batido casero" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }))

    expect(mocks.deleteFood).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Batido casero" })).toBeInTheDocument()
  })
})
