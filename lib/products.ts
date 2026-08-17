// resolveVariantPrice/resolveVariantCost: cada variante puede fijar su
// propio precio/costo, o heredar el del producto (útil para productos con
// variantes de igual valor, ej. una remera talle S/M/L al mismo precio).
export function resolveVariantPrice(
  product: { base_price: number },
  variant: { price: number | null }
): number {
  return variant.price ?? product.base_price
}

export function resolveVariantCost(
  product: { base_cost: number },
  variant: { cost_price: number | null }
): number {
  return variant.cost_price ?? product.base_cost
}

export function calculateSaleTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity * 100) / 100
}

// Puede devolver un número negativo (venta a pérdida) — es información
// real, no un caso de error; sub-proyecto 3 (reportes) la necesita tal cual.
export function calculateMargin(unitPrice: number, unitCost: number, quantity: number): number {
  return Math.round((unitPrice - unitCost) * quantity * 100) / 100
}
