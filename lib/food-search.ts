export type SearchableFood = {
  name: string
  category?: string | null
  subcategory?: string | null
  scientific_name?: string | null
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim()
}

export function matchesFoodQuery(food: SearchableFood, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  return [food.name, food.category, food.subcategory, food.scientific_name]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeSearchText(value).includes(normalizedQuery))
}
