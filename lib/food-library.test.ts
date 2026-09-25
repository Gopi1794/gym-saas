import { describe, it, expect } from "vitest"
import {
  EMPTY_FOOD_FACETS,
  FOOD_CATEGORY_OPTIONS,
  FOOD_CHIPS,
  FOOD_PAGE_SIZE,
  buildFoodChipCounts,
  clampPage,
  getFoodChip,
  getTotalPages,
  parseFoodLibraryParams,
  toSearchFoodsArgs,
  type FoodChipSlug,
  type FoodFacets,
} from "./food-library"

const ALL_SLUGS: FoodChipSlug[] = [
  "todos",
  "mios",
  "carnes",
  "pescados",
  "huevos",
  "lacteos",
  "cereales",
  "vegetales",
  "frutas",
  "grasas",
  "dulces",
  "otros",
]

describe("FOOD_CHIPS", () => {
  it("lists every chip in display order with its Spanish label", () => {
    expect(FOOD_CHIPS.map((chip) => [chip.slug, chip.label])).toEqual([
      ["todos", "Todos"],
      ["mios", "Mis alimentos"],
      ["carnes", "Carnes"],
      ["pescados", "Pescados"],
      ["huevos", "Huevos"],
      ["lacteos", "Lácteos"],
      ["cereales", "Cereales"],
      ["vegetales", "Vegetales"],
      ["frutas", "Frutas"],
      ["grasas", "Grasas y aceites"],
      ["dulces", "Dulces"],
      ["otros", "Otros"],
    ])
  })

  it("only includes uncategorized foods in the otros chip", () => {
    expect(FOOD_CHIPS.filter((chip) => chip.includeUncategorized).map((chip) => chip.slug)).toEqual(["otros"])
  })

  it("only scopes the mios chip to the gym's own foods", () => {
    expect(FOOD_CHIPS.filter((chip) => chip.scope === "mine").map((chip) => chip.slug)).toEqual(["mios"])
  })
})

describe("getFoodChip", () => {
  it("returns the chip config for every slug", () => {
    for (const slug of ALL_SLUGS) {
      expect(getFoodChip(slug).slug).toBe(slug)
    }
  })

  it("falls back to the todos chip for an unknown slug", () => {
    expect(getFoodChip("nope" as FoodChipSlug).slug).toBe("todos")
  })
})

describe("FOOD_CATEGORY_OPTIONS", () => {
  it("maps each category chip to its exact DB category string", () => {
    expect(FOOD_CATEGORY_OPTIONS).toEqual([
      { value: "Carnes y derivados", label: "Carnes" },
      { value: "Pescados, mariscos y conservas", label: "Pescados" },
      { value: "Huevos y derivados", label: "Huevos" },
      { value: "Leche y derivados", label: "Lácteos" },
      { value: "Cereales y derivados", label: "Cereales" },
      { value: "Vegetales y derivados", label: "Vegetales" },
      { value: "Frutas y derivados", label: "Frutas" },
      { value: "Grasas y aceites", label: "Grasas y aceites" },
      { value: "Productos azucarados", label: "Dulces" },
      { value: "Misceláneos", label: "Otros" },
    ])
  })

  it("excludes the todos and mios chips", () => {
    const labels = FOOD_CATEGORY_OPTIONS.map((option) => option.label)
    expect(labels).not.toContain("Todos")
    expect(labels).not.toContain("Mis alimentos")
  })
})

describe("parseFoodLibraryParams", () => {
  it("returns the defaults when nothing is provided", () => {
    expect(parseFoodLibraryParams({})).toEqual({ query: "", chip: "todos", page: 1 })
  })

  it("parses valid values", () => {
    expect(parseFoodLibraryParams({ q: "pollo", cat: "carnes", page: "3" })).toEqual({
      query: "pollo",
      chip: "carnes",
      page: 3,
    })
  })

  it("takes the first element of array values", () => {
    expect(parseFoodLibraryParams({ q: ["arroz", "pollo"], cat: ["cereales", "carnes"], page: ["2", "5"] })).toEqual({
      query: "arroz",
      chip: "cereales",
      page: 2,
    })
  })

  it("falls back to the defaults for empty arrays", () => {
    expect(parseFoodLibraryParams({ q: [], cat: [], page: [] })).toEqual({ query: "", chip: "todos", page: 1 })
  })

  it("accepts a Next.js searchParams object", () => {
    const searchParams: Record<string, string | string[] | undefined> = { q: "leche", tab: "alimentos" }
    expect(parseFoodLibraryParams(searchParams)).toEqual({ query: "leche", chip: "todos", page: 1 })
  })

  describe("query", () => {
    it("trims surrounding whitespace", () => {
      expect(parseFoodLibraryParams({ q: "  pollo asado  " }).query).toBe("pollo asado")
    })

    it("turns a whitespace-only query into an empty string", () => {
      expect(parseFoodLibraryParams({ q: "   " }).query).toBe("")
    })

    it("caps the query at 80 characters", () => {
      expect(parseFoodLibraryParams({ q: "a".repeat(200) }).query).toBe("a".repeat(80))
    })

    it("trims before capping, so leading spaces do not eat into the limit", () => {
      expect(parseFoodLibraryParams({ q: `   ${"a".repeat(100)}` }).query).toBe("a".repeat(80))
    })

    it("does not leave trailing whitespace after capping", () => {
      expect(parseFoodLibraryParams({ q: `${"a".repeat(79)} ${"b".repeat(10)}` }).query).toBe("a".repeat(79))
    })

    it("never splits a surrogate pair when capping", () => {
      const query = parseFoodLibraryParams({ q: `${"a".repeat(79)}😀b` }).query
      expect(query).toBe(`${"a".repeat(79)}😀`)
    })
  })

  describe("chip", () => {
    it.each(ALL_SLUGS)("accepts the %s slug", (slug) => {
      expect(parseFoodLibraryParams({ cat: slug }).chip).toBe(slug)
    })

    it.each(["", "nope", "Carnes", "CARNES", " carnes", "constructor", "__proto__", "toString"])(
      "falls back to todos for the invalid slug %j",
      (cat) => {
        expect(parseFoodLibraryParams({ cat }).chip).toBe("todos")
      }
    )
  })

  describe("page", () => {
    it.each([
      ["1", 1],
      ["7", 7],
      ["12", 12],
      [" 4 ", 4],
      ["007", 7],
      ["10000", 10000],
    ])("parses %j as %d", (page, expected) => {
      expect(parseFoodLibraryParams({ page }).page).toBe(expected)
    })

    it.each(["0", "-3", "abc", "2.5", "", "   ", "1e3", "+2", "3abc", "NaN", "Infinity"])(
      "falls back to page 1 for the invalid value %j",
      (page) => {
        expect(parseFoodLibraryParams({ page }).page).toBe(1)
      }
    )

    it("caps huge page numbers at 10000", () => {
      expect(parseFoodLibraryParams({ page: "10001" }).page).toBe(10000)
      expect(parseFoodLibraryParams({ page: "99999999999999999999999" }).page).toBe(10000)
      expect(parseFoodLibraryParams({ page: "9".repeat(400) }).page).toBe(10000)
    })

    it("takes the first element of an array", () => {
      expect(parseFoodLibraryParams({ page: ["3", "9"] }).page).toBe(3)
      expect(parseFoodLibraryParams({ page: ["abc", "9"] }).page).toBe(1)
    })
  })
})

describe("toSearchFoodsArgs", () => {
  const baseParams = { query: "", page: 1 }

  it.each<[FoodChipSlug, string, string[] | null, boolean]>([
    ["todos", "all", null, false],
    ["mios", "mine", null, false],
    ["carnes", "all", ["Carnes y derivados"], false],
    ["pescados", "all", ["Pescados, mariscos y conservas"], false],
    ["huevos", "all", ["Huevos y derivados"], false],
    ["lacteos", "all", ["Leche y derivados"], false],
    ["cereales", "all", ["Cereales y derivados"], false],
    ["vegetales", "all", ["Vegetales y derivados"], false],
    ["frutas", "all", ["Frutas y derivados"], false],
    ["grasas", "all", ["Grasas y aceites"], false],
    ["dulces", "all", ["Productos azucarados"], false],
    ["otros", "all", ["Misceláneos"], true],
  ])("maps the %s chip to scope %s, categories %j, includeUncategorized %s", (chip, scope, categories, include) => {
    expect(toSearchFoodsArgs("gym-1", { ...baseParams, chip })).toEqual({
      p_gym_id: "gym-1",
      p_query: null,
      p_categories: categories,
      p_include_uncategorized: include,
      p_scope: scope,
      p_limit: 24,
      p_offset: 0,
    })
  })

  it("passes the query through and sends null when it is empty", () => {
    expect(toSearchFoodsArgs("g", { query: "pollo", chip: "todos", page: 1 }).p_query).toBe("pollo")
    expect(toSearchFoodsArgs("g", { query: "", chip: "todos", page: 1 }).p_query).toBeNull()
  })

  it("trims a query that was not built through parseFoodLibraryParams", () => {
    expect(toSearchFoodsArgs("g", { query: "  pollo ", chip: "todos", page: 1 }).p_query).toBe("pollo")
    expect(toSearchFoodsArgs("g", { query: "   ", chip: "todos", page: 1 }).p_query).toBeNull()
  })

  it("uses the default page size of 24 and computes the offset from the page", () => {
    expect(FOOD_PAGE_SIZE).toBe(24)
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: 1 })).toMatchObject({ p_limit: 24, p_offset: 0 })
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: 2 }).p_offset).toBe(24)
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: 5 }).p_offset).toBe(96)
  })

  it("honors a custom page size", () => {
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: 3 }, 10)).toMatchObject({
      p_limit: 10,
      p_offset: 20,
    })
  })

  it("never produces a negative or NaN offset", () => {
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: 0 }).p_offset).toBe(0)
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: -4 }).p_offset).toBe(0)
    expect(toSearchFoodsArgs("g", { ...baseParams, chip: "todos", page: Number.NaN }).p_offset).toBe(0)
  })

  it("falls back to no category filter for an unknown chip", () => {
    const args = toSearchFoodsArgs("g", { ...baseParams, chip: "nope" as FoodChipSlug })
    expect(args).toMatchObject({ p_scope: "all", p_categories: null, p_include_uncategorized: false })
  })

  it("returns a categories array that cannot mutate the chip config", () => {
    const args = toSearchFoodsArgs("g", { ...baseParams, chip: "carnes" })
    args.p_categories?.push("Otra")
    expect(getFoodChip("carnes").categories).toEqual(["Carnes y derivados"])
  })
})

describe("buildFoodChipCounts", () => {
  const facets: FoodFacets = {
    all: 423,
    mine: 24,
    uncategorized: 5,
    categories: {
      "Carnes y derivados": 50,
      "Pescados, mariscos y conservas": 30,
      "Huevos y derivados": 6,
      "Leche y derivados": 40,
      "Cereales y derivados": 60,
      "Vegetales y derivados": 70,
      "Frutas y derivados": 45,
      "Grasas y aceites": 20,
      "Productos azucarados": 33,
      "Misceláneos": 12,
    },
  }

  it("maps the facets to one count per chip", () => {
    expect(buildFoodChipCounts(facets)).toEqual({
      todos: 423,
      mios: 24,
      carnes: 50,
      pescados: 30,
      huevos: 6,
      lacteos: 40,
      cereales: 60,
      vegetales: 70,
      frutas: 45,
      grasas: 20,
      dulces: 33,
      otros: 17,
    })
  })

  it("has exactly one entry per chip", () => {
    expect(Object.keys(buildFoodChipCounts(facets))).toEqual(ALL_SLUGS)
  })

  it("counts missing categories as zero", () => {
    expect(buildFoodChipCounts({ ...EMPTY_FOOD_FACETS, all: 9, mine: 2 })).toEqual({
      todos: 9,
      mios: 2,
      carnes: 0,
      pescados: 0,
      huevos: 0,
      lacteos: 0,
      cereales: 0,
      vegetales: 0,
      frutas: 0,
      grasas: 0,
      dulces: 0,
      otros: 0,
    })
  })

  it("adds the uncategorized foods to the Misceláneos count in the otros chip", () => {
    expect(buildFoodChipCounts({ all: 10, mine: 0, uncategorized: 4, categories: { "Misceláneos": 3 } }).otros).toBe(7)
    expect(buildFoodChipCounts({ all: 10, mine: 0, uncategorized: 4, categories: {} }).otros).toBe(4)
    expect(buildFoodChipCounts({ all: 10, mine: 0, uncategorized: 0, categories: { "Misceláneos": 3 } }).otros).toBe(3)
  })

  it("does not add uncategorized foods to any other chip", () => {
    const counts = buildFoodChipCounts({ all: 10, mine: 0, uncategorized: 4, categories: {} })
    expect(ALL_SLUGS.filter((slug) => counts[slug] === 4)).toEqual(["otros"])
  })

  it("ignores categories that no chip knows about", () => {
    const counts = buildFoodChipCounts({ all: 10, mine: 0, uncategorized: 0, categories: { "Categoría nueva": 9 } })
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10)
  })
})

describe("getTotalPages", () => {
  it.each([
    [0, 1],
    [1, 1],
    [24, 1],
    [25, 2],
    [48, 2],
    [49, 3],
    [423, 18],
  ])("returns %d foods as %d page(s) at the default page size", (total, expected) => {
    expect(getTotalPages(total)).toBe(expected)
  })

  it("honors a custom page size", () => {
    expect(getTotalPages(25, 10)).toBe(3)
    expect(getTotalPages(30, 10)).toBe(3)
  })

  it("never returns less than one page", () => {
    expect(getTotalPages(-5)).toBe(1)
    expect(getTotalPages(Number.NaN)).toBe(1)
    expect(getTotalPages(10, 0)).toBe(1)
  })
})

describe("clampPage", () => {
  it("keeps a page that is in range", () => {
    expect(clampPage(1, 5)).toBe(1)
    expect(clampPage(3, 5)).toBe(3)
    expect(clampPage(5, 5)).toBe(5)
  })

  it("clamps a page beyond the last page to the last page", () => {
    expect(clampPage(6, 5)).toBe(5)
    expect(clampPage(10000, 3)).toBe(3)
  })

  it("clamps a page below one to the first page", () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-2, 5)).toBe(1)
  })

  it("treats a missing total as a single page", () => {
    expect(clampPage(4, 0)).toBe(1)
  })

  it("truncates fractional pages and treats NaN as the first page", () => {
    expect(clampPage(2.7, 5)).toBe(2)
    expect(clampPage(Number.NaN, 5)).toBe(1)
  })
})

describe("EMPTY_FOOD_FACETS", () => {
  it("is all zeros with no categories", () => {
    expect(EMPTY_FOOD_FACETS).toEqual({ all: 0, mine: 0, uncategorized: 0, categories: {} })
  })
})
