"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import type { FormEvent, KeyboardEvent, ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Apple, ChevronLeft, ChevronRight, Pencil, Plus, Search, SearchX, Trash2, X } from "lucide-react"
import { createFood, updateFood, deleteFood } from "@/app/actions/nutrition"
import type { Food, FoodsPage } from "@/app/actions/nutrition"
import {
  FOOD_CATEGORY_OPTIONS,
  FOOD_CHIPS,
  buildFoodChipCounts,
  buildFoodLibraryHref,
  getFoodChip,
  getTotalPages,
  type FoodChipSlug,
  type FoodLibraryHrefPatch,
} from "@/lib/food-library"
import { cn } from "@/lib/utils"

interface Props {
  gymId: string
  foodsPage: FoodsPage
  query: string
  chip: FoodChipSlug
}

type FoodForm = Omit<Food, "id" | "gym_id">
type NumericField = "calories" | "protein" | "carbs" | "fat" | "fiber" | "sodium"

const SEARCH_DEBOUNCE_MS = 300

const EMPTY: FoodForm = {
  name: "", category: null, calories: 0, protein: 0, carbs: 0, fat: 0,
  fiber: 0, sodium: 0, household_unit: null, grams_per_unit: null,
  sugars: null, saturated_fat: null, potassium: null, calcium: null,
  magnesium: null, zinc: null, iron: null, vitamin_b12: null,
}

const isCustom = (food: Food) => food.gym_id !== null

// One decimal at most keeps the numeric columns aligned and hides float noise.
function formatValue(value: number | null | undefined): string {
  return String(Math.round((value ?? 0) * 10) / 10)
}

function portionLabel(food: Food): string | null {
  return food.household_unit && food.grams_per_unit
    ? `${food.household_unit} = ${formatValue(food.grams_per_unit)} g`
    : null
}

// The chip and the category already say where a food lives, so repeating them adds noise.
function subcategoryTag(food: Food, activeCategory: string | null): string | null {
  const subcategory = food.subcategory?.trim()
  if (!subcategory || subcategory === food.category || subcategory === activeCategory) return null
  return subcategory
}

function buildSummary(foodsPage: FoodsPage, query: string): string {
  const { foods, total, page, pageSize } = foodsPage
  const suffix = query ? ` para "${query}"` : ""
  if (total === 0) return `Sin resultados${suffix}`
  if (total === 1) return `1 alimento${suffix}`
  if (foods.length === 0) return `${total} alimentos${suffix}`
  const from = (page - 1) * pageSize + 1
  const to = Math.min(from + foods.length - 1, total)
  return `Mostrando ${from}–${to} de ${total} alimentos${suffix}`
}

function buildEmptyHint(query: string, chip: FoodChipSlug): string {
  const label = getFoodChip(chip).label
  if (query) {
    return chip === "todos"
      ? `No hay resultados para "${query}". Revisá la ortografía o probá con otra palabra.`
      : `No hay resultados para "${query}" en ${label}. Probá con otra palabra o quitá los filtros.`
  }
  if (chip === "mios") return 'Todavía no agregaste alimentos propios. Usá "Agregar" para crear el primero.'
  if (chip === "todos") return 'Todavía no hay alimentos cargados. Usá "Agregar" para crear el primero.'
  return `No hay alimentos en ${label} por ahora.`
}

// Ignore keys that bubble up from nested controls such as the edit / delete buttons.
function activateOnKey(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.target !== event.currentTarget) return
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    action()
  }
}

function CategoryChip({ label, count, active, onSelect }: {
  label: string
  count: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors focus-visible:rounded-full md:h-9 md:px-3.5",
        // Grows the tap area to 44px on touch screens without making the pill taller.
        "before:absolute before:inset-x-0 before:-inset-y-0.5 md:before:hidden",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
        !active && count === 0 && "opacity-60"
      )}
    >
      <span>{label}</span>{" "}
      <span className={cn("text-xs tabular-nums", active ? "text-white/80" : "text-zinc-500 dark:text-zinc-400")}>
        {count}
      </span>
    </button>
  )
}

function ActionButton({ label, tone = "neutral", className, onClick, children }: {
  label: string
  tone?: "neutral" | "danger"
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "flex items-center justify-center rounded-xl text-zinc-500 transition-colors focus-visible:rounded-xl dark:text-zinc-400",
        tone === "danger"
          ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          : "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
        className
      )}
    >
      {children}
    </button>
  )
}

function SubcategoryTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-md bg-zinc-100 px-1.5 py-0.5 align-top text-[11px] font-medium leading-4 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
        className
      )}
    >
      {children}
    </span>
  )
}

interface ListProps {
  foods: Food[]
  activeCategory: string | null
  onOpen: (food: Food) => void
  onEdit: (food: Food) => void
  onDelete: (food: Food) => void
}

function FoodTable({ foods, activeCategory, onOpen, onEdit, onDelete }: ListProps) {
  const numericHead = "w-[4.5rem] px-2 py-3 text-right font-semibold"
  const numericCell = "px-2 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300"

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
            <th scope="col" className="px-5 py-3 text-left font-semibold">Alimento</th>
            <th scope="col" className={numericHead}>Kcal</th>
            <th scope="col" className={numericHead}>Prot.</th>
            <th scope="col" className={numericHead}>Carbs</th>
            <th scope="col" className={numericHead}>Grasas</th>
            <th scope="col" className="hidden w-48 pl-6 pr-4 py-3 text-left font-semibold xl:table-cell">Porción</th>
            <th scope="col" className="w-24 px-2 py-3"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => {
            const tag = subcategoryTag(food, activeCategory)
            const portion = portionLabel(food)
            return (
              <tr
                key={food.id}
                tabIndex={0}
                onClick={() => onOpen(food)}
                onKeyDown={(event) => activateOnKey(event, () => onOpen(food))}
                className="group h-[4.25rem] cursor-pointer border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 dark:focus-visible:bg-zinc-800/40"
              >
                <td className="px-5 py-3 align-middle group-focus-visible:shadow-[inset_3px_0_0_0_theme(colors.brand.500)]">
                  <div className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-50" title={food.name}>
                    {food.name}
                  </div>
                  {tag && <SubcategoryTag className="mt-1">{tag}</SubcategoryTag>}
                </td>
                <td className="px-2 py-3 text-right text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatValue(food.calories)}
                </td>
                <td className={numericCell}>{formatValue(food.protein)} g</td>
                <td className={numericCell}>{formatValue(food.carbs)} g</td>
                <td className={numericCell}>{formatValue(food.fat)} g</td>
                <td
                  className="hidden truncate pl-6 pr-4 py-3 text-zinc-500 dark:text-zinc-400 xl:table-cell"
                  title={portion ?? undefined}
                >
                  {portion ?? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">Sin porción</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  {isCustom(food) && (
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton label={`Editar ${food.name}`} className="h-9 w-9" onClick={() => onEdit(food)}>
                        <Pencil className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton label={`Eliminar ${food.name}`} tone="danger" className="h-9 w-9" onClick={() => onDelete(food)}>
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FoodCardList({ foods, activeCategory, onOpen, onEdit, onDelete }: ListProps) {
  return (
    <ul className="space-y-3 lg:hidden">
      {foods.map((food) => {
        const tag = subcategoryTag(food, activeCategory)
        const protein = formatValue(food.protein)
        const carbs = formatValue(food.carbs)
        const fat = formatValue(food.fat)
        return (
          <li
            key={food.id}
            className="relative rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                {/* The button stretches over the whole card; the action buttons sit above it. */}
                <button
                  type="button"
                  onClick={() => onOpen(food)}
                  className="block w-full text-left text-[15px] font-semibold leading-snug text-zinc-900 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500 dark:text-zinc-50"
                >
                  <span className="line-clamp-2">{food.name}</span>
                </button>
                {tag && <SubcategoryTag className="mt-2">{tag}</SubcategoryTag>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatValue(food.calories)}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">kcal</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
                <span aria-hidden="true">P {protein} g · C {carbs} g · G {fat} g</span>
                <span className="sr-only">Proteínas {protein} g, carbohidratos {carbs} g, grasas {fat} g</span>
              </p>
              {isCustom(food) && (
                <div className="relative z-10 -my-3 -mr-3 flex shrink-0 items-center">
                  <ActionButton label={`Editar ${food.name}`} className="h-11 w-11" onClick={() => onEdit(food)}>
                    <Pencil className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton label={`Eliminar ${food.name}`} tone="danger" className="h-11 w-11" onClick={() => onDelete(food)}>
                    <Trash2 className="h-4 w-4" />
                  </ActionButton>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({ query, chip, hasFilters, onClear }: {
  query: string
  chip: FoodChipSlug
  hasFilters: boolean
  onClear: () => void
}) {
  const noOwnFoods = chip === "mios" && !query
  const Icon = noOwnFoods ? Apple : SearchX
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No encontramos alimentos</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{buildEmptyHint(query, chip)}</p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex min-h-[44px] items-center rounded-xl border border-zinc-300 px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:rounded-xl dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

export default function FoodLibraryPanel({ gymId, foodsPage, query, chip }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const uid = useId()

  const { foods, total, facets, page, pageSize } = foodsPage
  const totalPages = getTotalPages(total, pageSize)
  const counts = buildFoodChipCounts(facets)
  const activeCategory = getFoodChip(chip).categories?.[0] ?? null
  const hasFilters = query !== "" || chip !== "todos"

  const [searchText, setSearchText] = useState(query)
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FoodForm>(EMPTY)
  const [detail, setDetail] = useState<Food | null>(null)
  const [isNavigating, startNavigation] = useTransition()
  const [isSaving, startSaving] = useTransition()

  const searchInputRef = useRef<HTMLInputElement>(null)
  const chipGroupRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<number | undefined>(undefined)
  // The query the URL holds, or is about to hold once our last navigation lands.
  const pushedQuery = useRef(query)
  // Between router.replace() and its commit useSearchParams() is stale, so patches build on this copy.
  const searchString = searchParams.toString()
  const latestSearch = useRef(searchString)
  useEffect(() => {
    latestSearch.current = searchString
  }, [searchString])

  // The URL changed from outside (back/forward): adopt it. Echoes of our own navigations are ignored
  // so a slow response never overwrites what the user has typed since.
  useEffect(() => {
    if (query === pushedQuery.current) return
    window.clearTimeout(debounceTimer.current)
    pushedQuery.current = query
    setSearchText(query)
  }, [query])

  useEffect(() => () => window.clearTimeout(debounceTimer.current), [])

  // The chip row scrolls on phones: keep the active chip visible after a deep link or a tap near the edge.
  useEffect(() => {
    chipGroupRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [chip])

  function navigate(patch: FoodLibraryHrefPatch) {
    const href = buildFoodLibraryHref(pathname, latestSearch.current, patch)
    latestSearch.current = href.slice(pathname.length)
    startNavigation(() => router.replace(href, { scroll: false }))
  }

  function commitQuery(value: string) {
    const next = value.trim()
    if (next === pushedQuery.current) return
    pushedQuery.current = next
    navigate({ q: next || null })
  }

  function handleSearchChange(value: string) {
    setSearchText(value)
    window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => commitQuery(value), SEARCH_DEBOUNCE_MS)
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault()
    window.clearTimeout(debounceTimer.current)
    commitQuery(searchText)
    searchInputRef.current?.blur()
  }

  function clearSearch() {
    window.clearTimeout(debounceTimer.current)
    setSearchText("")
    commitQuery("")
    searchInputRef.current?.focus()
  }

  function clearFilters() {
    window.clearTimeout(debounceTimer.current)
    pushedQuery.current = ""
    setSearchText("")
    navigate({ q: null, cat: null, page: null })
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return
    navigate({ page: nextPage })
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true) }

  function openEdit(food: Food) {
    setForm({
      name: food.name, category: food.category ?? null,
      calories: food.calories, protein: food.protein,
      carbs: food.carbs, fat: food.fat, fiber: food.fiber ?? 0,
      sodium: food.sodium ?? 0, household_unit: food.household_unit ?? null,
      grams_per_unit: food.grams_per_unit ?? null,
      sugars: food.sugars ?? null, saturated_fat: food.saturated_fat ?? null,
      potassium: food.potassium ?? null, calcium: food.calcium ?? null,
      magnesium: food.magnesium ?? null, zinc: food.zinc ?? null,
      iron: food.iron ?? null, vitamin_b12: food.vitamin_b12 ?? null,
    })
    setCreating(false)
    setEditing(food)
  }

  function closeModal() { setCreating(false); setEditing(null) }

  function handleSave() {
    if (!form.name.trim()) return
    startSaving(async () => {
      if (creating) {
        await createFood(gymId, form)
      } else if (editing) {
        await updateFood(editing.id, form)
      }
      router.refresh()
      closeModal()
    })
  }

  // Returns false when the user backs out so callers keep their modal open.
  function handleDelete(id: string): boolean {
    if (!confirm("¿Eliminar este alimento?")) return false
    startSaving(async () => {
      await deleteFood(id)
      router.refresh()
    })
    return true
  }

  const numField = (label: string, field: NumericField, unit: string) => {
    const id = `${uid}-${field}`
    return (
      <div key={field}>
        <label htmlFor={id} className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {label}{" "}<span className="font-normal">({unit})</span>
        </label>
        <input
          id={id}
          type="number" min={0} step={0.1}
          value={form[field] ?? 0}
          onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>
    )
  }

  const busy = isNavigating || isSaving
  const knownCategory = !form.category || FOOD_CATEGORY_OPTIONS.some(option => option.value === form.category)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <form role="search" onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            name="q"
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscá un alimento…"
            aria-label="Buscar alimento"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-11 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {searchText && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:rounded-xl dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:rounded-xl"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />Agregar
        </button>
      </div>

      {/* Category chips */}
      <div className="-mx-4 md:mx-0">
        <div
          ref={chipGroupRef}
          role="group"
          aria-label="Filtrar por categoría"
          className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:px-0"
        >
          {FOOD_CHIPS.map(item => (
            <CategoryChip
              key={item.slug}
              label={item.label}
              count={counts[item.slug]}
              active={item.slug === chip}
              onSelect={() => navigate({ cat: item.slug })}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      <div ref={resultsRef} className="scroll-mt-16 space-y-3 md:scroll-mt-4">
        <p aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">
          {buildSummary(foodsPage, query)}
        </p>

        <div aria-busy={busy} className={cn("transition-opacity duration-150", busy && "opacity-60")}>
          {foods.length === 0 ? (
            <EmptyState query={query} chip={chip} hasFilters={hasFilters} onClear={clearFilters} />
          ) : (
            <>
              <FoodTable foods={foods} activeCategory={activeCategory} onOpen={setDetail} onEdit={openEdit} onDelete={food => handleDelete(food.id)} />
              <FoodCardList foods={foods} activeCategory={activeCategory} onOpen={setDetail} onEdit={openEdit} onDelete={food => handleDelete(food.id)} />
            </>
          )}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-2 sm:justify-center">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-zinc-300 bg-white pl-3 pr-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:rounded-full disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior
            </button>
            <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">Página {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-zinc-300 bg-white pl-4 pr-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:rounded-full disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50"
            >
              Siguiente<ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>

      {/* Manual create/edit Modal */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-form-title`}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id={`${uid}-form-title`} className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{creating ? "Nuevo alimento" : "Editar alimento"}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor={`${uid}-name`} className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Nombre</label>
                <input
                  id={`${uid}-name`}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Pechuga de pollo cocida"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div>
                <label htmlFor={`${uid}-category`} className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Categoría (opcional)</label>
                <select
                  id={`${uid}-category`}
                  value={form.category ?? ""}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value || null }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:[color-scheme:dark]"
                >
                  <option value="">Sin categoría</option>
                  {!knownCategory && <option value={form.category ?? ""}>{form.category}</option>}
                  {FOOD_CATEGORY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Macros por 100g</p>
                <div className="grid grid-cols-2 gap-3">
                  {numField("Calorías", "calories", "kcal")}
                  {numField("Proteínas", "protein", "g")}
                  {numField("Carbohidratos", "carbs", "g")}
                  {numField("Grasas", "fat", "g")}
                  {numField("Fibra", "fiber", "g")}
                  {numField("Sodio", "sodium", "mg")}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Porción casera (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${uid}-unit`} className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Descripción</label>
                    <input
                      id={`${uid}-unit`}
                      value={form.household_unit ?? ""}
                      onChange={e => setForm(f => ({ ...f, household_unit: e.target.value || null }))}
                      placeholder="1 huevo, 1 taza…"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-grams`} className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Equivale a (g)</label>
                    <input
                      id={`${uid}-grams`}
                      type="number" min={1}
                      value={form.grams_per_unit ?? ""}
                      onChange={e => setForm(f => ({ ...f, grams_per_unit: parseFloat(e.target.value) || null }))}
                      placeholder="50"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={closeModal} className="min-h-[44px] flex-1 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving || !form.name.trim()} className="min-h-[44px] flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors">
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-150" onClick={() => setDetail(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-detail-title`}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/60 shadow-2xl backdrop-blur-2xl ring-1 ring-inset ring-white/5 dark:bg-zinc-900/50 animate-in fade-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 id={`${uid}-detail-title`} className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{detail.name}</h2>
                <p className="text-xs text-zinc-500">Valores por 100g</p>
                {detail.source === "argenfoods" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    ARGENFOODS · {detail.category}{detail.subcategory ? ` · ${detail.subcategory}` : ""}
                  </p>
                )}
              </div>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Main macros */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Calorías", value: detail.calories, unit: "kcal", color: "text-brand-500" },
                  { label: "Proteínas", value: detail.protein, unit: "g", color: "text-blue-400" },
                  { label: "Carbos", value: detail.carbs, unit: "g", color: "text-amber-400" },
                  { label: "Grasas", value: detail.fat, unit: "g", color: "text-emerald-400" },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                    <p className={`text-lg font-black leading-none ${m.color}`}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{m.unit}</p>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Extended nutrients */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nutrientes adicionales</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Fibra",          value: detail.fiber,         unit: "g"  },
                    { label: "Sodio",          value: detail.sodium,        unit: "mg" },
                    { label: "Azúcares",       value: detail.sugars,        unit: "g"  },
                    { label: "Grasa saturada", value: detail.saturated_fat, unit: "g"  },
                    { label: "Potasio",        value: detail.potassium,     unit: "mg" },
                    { label: "Calcio",         value: detail.calcium,       unit: "mg" },
                    { label: "Magnesio",       value: detail.magnesium,     unit: "mg" },
                    { label: "Zinc",           value: detail.zinc,          unit: "mg" },
                    { label: "Hierro",         value: detail.iron,          unit: "mg" },
                    { label: "Vitamina B12",   value: detail.vitamin_b12,   unit: "µg" },
                  ].filter(n => n.value != null && n.value !== 0).map(n => (
                    <div key={n.label} className="flex items-center justify-between rounded-lg px-3 py-1.5 odd:bg-zinc-50 dark:odd:bg-zinc-800/40">
                      <span className="text-xs text-zinc-500">{n.label}</span>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{n.value}{n.unit}</span>
                    </div>
                  ))}
                </div>
                {[detail.sugars, detail.saturated_fat, detail.potassium, detail.calcium, detail.magnesium, detail.zinc, detail.iron, detail.vitamin_b12].every(v => !v) && (
                  <p className="text-center text-xs text-zinc-500 py-3">Sin datos extendidos para este alimento</p>
                )}
              </div>

              {/* Portion */}
              {detail.household_unit && detail.grams_per_unit && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-zinc-500">Porción: </span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{detail.household_unit} = {detail.grams_per_unit}g</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {isCustom(detail) && (
              <div className="flex gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <button onClick={() => { openEdit(detail); setDetail(null) }} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />Editar
                </button>
                <button onClick={() => { if (handleDelete(detail.id)) setDetail(null) }} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
