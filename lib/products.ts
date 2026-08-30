export type ProductPaymentMethod = "cash" | "mercadopago" | "transfer" | "card" | "other"

export type ProductOrderStatus = "reserved" | "paid" | "cancelled" | "expired"

export type ProductOrderItemInput = {
  variantId: string
  quantity: number
}

export type ProductOrderPricedItem = ProductOrderItemInput & {
  productId?: string
  unitPrice: number
  unitCost: number
  stock?: number
}

export type ProductPaymentValidationInput = {
  status: ProductOrderStatus
  paymentMethod?: ProductPaymentMethod | null
}

export type ProductReportRow = {
  orderId?: string | null
  productId: string
  productName: string
  variantId?: string | null
  variantName?: string | null
  sellerId?: string | null
  sellerName?: string | null
  paymentMethod: ProductPaymentMethod
  quantity: number
  revenue: number
  margin: number
}

export type ProductLowStockRow = {
  productId: string
  productName: string
  variantId: string
  variantName: string
  stock: number
  threshold?: number
}

export type ProductOrderReport = {
  revenue: number
  margin: number
  marginPercentage: number
  units: number
  paidOrders: number
  averageOrderValue: number
  topProducts: Array<{ productId: string; productName: string; units: number; revenue: number; margin: number }>
  byMethod: Record<ProductPaymentMethod, number>
  bySeller: Array<{ sellerId: string | null; sellerName: string; revenue: number; units: number }>
  lowStock: ProductLowStockRow[]
}

export type ProductPromotionVisibilityInput = {
  gymId: string
  isActive: boolean
  startsAt?: string | Date | null
  endsAt?: string | Date | null
}

export type ProductPromotionForMemberInput = ProductPromotionVisibilityInput & {
  id: string
  title: string
  description?: string | null
  imageUrl?: string | null
  publicPrice: number
  ctaLabel?: string | null
  costPrice?: number | null
  baseCost?: number | null
  margin?: number | null
}

export type MemberProductPromotion = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  price: number
  cta_label: string | null
}

export type ProductImageInput = {
  id?: string
  image_url: string
  alt_text?: string | null
  sort_order?: number | null
  is_primary?: boolean | null
}

export type ProductImage = {
  id?: string
  image_url: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

export type MemberProductVariantInput = {
  id: string
  name: string
  price: number | null
  stock: number
  is_active?: boolean
}

export type MemberProductInput = {
  id: string
  name: string
  description: string | null
  category: string
  image_url: string | null
  base_price: number
  base_cost?: number
  is_active?: boolean
  product_variants: MemberProductVariantInput[]
  product_images?: ProductImageInput[] | null
}

export type MemberProductVariant = {
  id: string
  name: string
  price: number
  stock: number
}

export type MemberProduct = {
  id: string
  name: string
  description: string | null
  category: string
  image_url: string | null
  base_price: number
  product_variants: MemberProductVariant[]
  product_images: ProductImage[]
}

export const PRODUCT_PAYMENT_METHODS = ["cash", "mercadopago", "transfer", "card", "other"] as const

const emptyMethodTotals = (): Record<ProductPaymentMethod, number> => ({
  cash: 0,
  mercadopago: 0,
  transfer: 0,
  card: 0,
  other: 0,
})

const roundMoney = (amount: number): number => Math.round(amount * 100) / 100

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
  return roundMoney(unitPrice * quantity)
}

// Puede devolver un número negativo (venta a pérdida) — es información
// real, no un caso de error; sub-proyecto 3 (reportes) la necesita tal cual.
export function calculateMargin(unitPrice: number, unitCost: number, quantity: number): number {
  return roundMoney((unitPrice - unitCost) * quantity)
}

export function calculateOrderTotals(items: ProductOrderPricedItem[]) {
  const subtotal = items.reduce((sum, item) => sum + calculateSaleTotal(item.unitPrice, item.quantity), 0)
  const margin = items.reduce((sum, item) => sum + calculateMargin(item.unitPrice, item.unitCost, item.quantity), 0)
  const units = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    subtotal: roundMoney(subtotal),
    total: roundMoney(subtotal),
    margin: roundMoney(margin),
    units,
  }
}

export function validateProductOrderItems(items: ProductOrderPricedItem[]): string[] {
  const errors: string[] = []

  if (items.length === 0) {
    errors.push("La orden debe incluir al menos un producto")
  }

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors.push(`Cantidad inválida para la variante ${item.variantId}`)
    }

    if (typeof item.stock === "number" && item.quantity > item.stock) {
      errors.push(`Stock insuficiente para la variante ${item.variantId}`)
    }
  }

  return errors
}

export function isValidProductPaymentMethod(method: unknown): method is ProductPaymentMethod {
  return typeof method === "string" && PRODUCT_PAYMENT_METHODS.includes(method as ProductPaymentMethod)
}

export function normalizeOptionalUrl(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function normalizeImageUrls(values?: Array<string | null | undefined> | null): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const value of values ?? []) {
    const normalized = normalizeOptionalUrl(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}

export function isProductImageStoragePath(path: string, gymId: string, productId: string): boolean {
  const [pathGymId, pathProductId, fileName, ...rest] = path.split("/")
  return (
    rest.length === 0 &&
    pathGymId === gymId &&
    pathProductId === productId &&
    /^[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(fileName ?? "")
  )
}

export function normalizeProductImages(
  images?: ProductImageInput[] | null,
  fallbackImageUrl?: string | null
): ProductImage[] {
  const normalized = (images ?? [])
    .filter((image) => normalizeOptionalUrl(image.image_url))
    .map((image, index) => ({
      id: image.id,
      image_url: normalizeOptionalUrl(image.image_url)!,
      alt_text: image.alt_text ?? null,
      sort_order: image.sort_order ?? index,
      is_primary: image.is_primary === true,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  if (normalized.length > 0) {
    const hasPrimary = normalized.some((image) => image.is_primary)
    return hasPrimary ? normalized : normalized.map((image, index) => ({ ...image, is_primary: index === 0 }))
  }

  const fallback = normalizeOptionalUrl(fallbackImageUrl)
  return fallback ? [{ image_url: fallback, alt_text: null, sort_order: 0, is_primary: true }] : []
}

export function resolvePrimaryProductImage(product: { image_url?: string | null; product_images?: ProductImageInput[] | null }): string | null {
  const images = normalizeProductImages(product.product_images, product.image_url)
  return images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url ?? null
}

export function toMemberProduct(product: MemberProductInput): MemberProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    image_url: resolvePrimaryProductImage(product),
    base_price: product.base_price,
    product_images: normalizeProductImages(product.product_images, product.image_url),
    product_variants: product.product_variants
      .filter((variant) => variant.is_active !== false)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: variant.price ?? product.base_price,
        stock: variant.stock,
      })),
  }
}

export function validateProductPayment(input: ProductPaymentValidationInput): string[] {
  if (input.status !== "paid") {
    return []
  }

  if (!isValidProductPaymentMethod(input.paymentMethod)) {
    return ["El método de pago es obligatorio para ventas pagas"]
  }

  return []
}

export function isPromotionVisibleToGym(
  promotion: ProductPromotionVisibilityInput,
  memberGymId: string,
  now: Date = new Date()
): boolean {
  if (!promotion.isActive || promotion.gymId !== memberGymId) {
    return false
  }

  const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null

  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now)
}

export function toMemberProductPromotion(promotion: ProductPromotionForMemberInput): MemberProductPromotion {
  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description ?? null,
    image_url: promotion.imageUrl ?? null,
    price: promotion.publicPrice,
    cta_label: promotion.ctaLabel ?? null,
  }
}

export function getVisibleMemberPromotions(
  promotions: ProductPromotionForMemberInput[],
  memberGymId: string,
  now: Date = new Date()
): MemberProductPromotion[] {
  return promotions
    .filter((promotion) => isPromotionVisibleToGym(promotion, memberGymId, now))
    .map(toMemberProductPromotion)
}

export function aggregateProductReport(rows: ProductReportRow[], lowStock: ProductLowStockRow[] = []): ProductOrderReport {
  const byMethod = emptyMethodTotals()
  const products = new Map<string, { productId: string; productName: string; units: number; revenue: number; margin: number }>()
  const sellers = new Map<string, { sellerId: string | null; sellerName: string; revenue: number; units: number }>()

  let revenue = 0
  let margin = 0
  let units = 0
  const paidOrderIds = new Set<string>()

  for (const row of rows) {
    if (row.orderId) paidOrderIds.add(row.orderId)
    revenue += row.revenue
    margin += row.margin
    units += row.quantity
    byMethod[row.paymentMethod] = roundMoney(byMethod[row.paymentMethod] + row.revenue)

    const product = products.get(row.productId) ?? {
      productId: row.productId,
      productName: row.productName,
      units: 0,
      revenue: 0,
      margin: 0,
    }
    product.units += row.quantity
    product.revenue = roundMoney(product.revenue + row.revenue)
    product.margin = roundMoney(product.margin + row.margin)
    products.set(row.productId, product)

    const sellerKey = row.sellerId ?? "unknown"
    const seller = sellers.get(sellerKey) ?? {
      sellerId: row.sellerId ?? null,
      sellerName: row.sellerName ?? "Sin vendedor",
      revenue: 0,
      units: 0,
    }
    seller.revenue = roundMoney(seller.revenue + row.revenue)
    seller.units += row.quantity
    sellers.set(sellerKey, seller)
  }

  return {
    revenue: roundMoney(revenue),
    margin: roundMoney(margin),
    marginPercentage: revenue === 0 ? 0 : roundMoney((margin / revenue) * 100),
    units,
    paidOrders: paidOrderIds.size,
    averageOrderValue: paidOrderIds.size === 0 ? 0 : roundMoney(revenue / paidOrderIds.size),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue),
    byMethod,
    bySeller: [...sellers.values()].sort((a, b) => b.revenue - a.revenue),
    lowStock,
  }
}
