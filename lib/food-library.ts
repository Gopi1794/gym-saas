export const FOOD_PAGE_SIZE = 24

const MAX_QUERY_LENGTH = 80
const MAX_PAGE = 10000

export type FoodChipSlug =
  | "todos"
  | "mios"
  | "carnes"
  | "pescados"
  | "huevos"
  | "lacteos"
  | "cereales"
  | "vegetales"
  | "frutas"
  | "grasas"
  | "dulces"
  | "otros"

export type FoodFacets = {
  all: number
  mine: number
  uncategorized: number
  categories: Record<string, number>
}

export type FoodChip = {
  slug: FoodChipSlug
  label: string
  scope: "all" | "mine"
  categories: string[] | null
  includeUncategorized: boolean
}

export type FoodLibraryParams = {
  query: string
  chip: FoodChipSlug
  page: number
}

export type SearchFoodsArgs = {
  p_gym_id: string
  p_query: string | null
  p_categories: string[] | null
  p_include_uncategorized: boolean
  p_scope: "all" | "mine"
  p_limit: number
  p_offset: number
}

function categoryChip(
  slug: FoodChipSlug,
  label: string,
  category: string,
  includeUncategorized = false
): FoodChip {
  return { slug, label, scope: "all", categories: [category], includeUncategorized }
}

// "Otros" also collects foods with no category so every food is reachable from a chip.
export const FOOD_CHIPS: readonly FoodChip[] = [
  { slug: "todos", label: "Todos", scope: "all", categories: null, includeUncategorized: false },
  { slug: "mios", label: "Mis alimentos", scope: "mine", categories: null, includeUncategorized: false },
  categoryChip("carnes", "Carnes", "Carnes y derivados"),
  categoryChip("pescados", "Pescados", "Pescados, mariscos y conservas"),
  categoryChip("huevos", "Huevos", "Huevos y derivados"),
  categoryChip("lacteos", "Lácteos", "Leche y derivados"),
  categoryChip("cereales", "Cereales", "Cereales y derivados"),
  categoryChip("vegetales", "Vegetales", "Vegetales y derivados"),
  categoryChip("frutas", "Frutas", "Frutas y derivados"),
  categoryChip("grasas", "Grasas y aceites", "Grasas y aceites"),
  categoryChip("dulces", "Dulces", "Productos azucarados"),
  categoryChip("otros", "Otros", "Misceláneos", true),
]

export const FOOD_CATEGORY_OPTIONS: readonly { value: string; label: string }[] = FOOD_CHIPS.flatMap(
  (chip) => (chip.categories ? [{ value: chip.categories[0], label: chip.label }] : [])
)

export const EMPTY_FOOD_FACETS: FoodFacets = { all: 0, mine: 0, uncategorized: 0, categories: {} }

function firstValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" ? first : undefined
}

function isFoodChipSlug(value: string | undefined): value is FoodChipSlug {
  return FOOD_CHIPS.some((chip) => chip.slug === value)
}

function parsePage(value: string | undefined): number {
  const digits = value?.trim() ?? ""
  if (!/^\d+$/.test(digits)) return 1
  return Math.min(Math.max(Number(digits), 1), MAX_PAGE)
}

export function parseFoodLibraryParams(raw: {
  q?: string | string[]
  cat?: string | string[]
  page?: string | string[]
}): FoodLibraryParams {
  const chip = firstValue(raw.cat)
  return {
    // Cap by code points so the cut never splits a surrogate pair.
    query: [...(firstValue(raw.q) ?? "").trim()].slice(0, MAX_QUERY_LENGTH).join("").trimEnd(),
    chip: isFoodChipSlug(chip) ? chip : "todos",
    page: parsePage(firstValue(raw.page)),
  }
}

export function getFoodChip(slug: FoodChipSlug): FoodChip {
  return FOOD_CHIPS.find((chip) => chip.slug === slug) ?? FOOD_CHIPS[0]
}

function sanitizePage(page: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1
}

export function toSearchFoodsArgs(
  gymId: string,
  params: FoodLibraryParams,
  pageSize = FOOD_PAGE_SIZE
): SearchFoodsArgs {
  const chip = getFoodChip(params.chip)
  const query = params.query.trim()
  return {
    p_gym_id: gymId,
    p_query: query === "" ? null : query,
    p_categories: chip.categories ? [...chip.categories] : null,
    p_include_uncategorized: chip.includeUncategorized,
    p_scope: chip.scope,
    p_limit: pageSize,
    p_offset: (sanitizePage(params.page) - 1) * pageSize,
  }
}

function countForChip(chip: FoodChip, facets: FoodFacets): number {
  if (!chip.categories) return chip.scope === "mine" ? facets.mine : facets.all
  const inCategories = chip.categories.reduce(
    (sum, category) => sum + (facets.categories[category] ?? 0),
    0
  )
  return chip.includeUncategorized ? inCategories + facets.uncategorized : inCategories
}

export function buildFoodChipCounts(facets: FoodFacets): Record<FoodChipSlug, number> {
  const counts = {} as Record<FoodChipSlug, number>
  for (const chip of FOOD_CHIPS) {
    counts[chip.slug] = countForChip(chip, facets)
  }
  return counts
}

export function getTotalPages(total: number, pageSize = FOOD_PAGE_SIZE): number {
  if (!(total > 0) || !(pageSize > 0)) return 1
  return Math.ceil(total / pageSize)
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(sanitizePage(page), Math.max(1, totalPages))
}
