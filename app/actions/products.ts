"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { canCollectPayment } from "@/lib/payments"
import {
  aggregateProductReport,
  getVisibleMemberPromotions,
  isValidProductPaymentMethod,
  normalizeOptionalUrl,
  toMemberProduct,
  type MemberProduct,
  type MemberProductPromotion,
  type ProductOrderReport,
  type ProductPaymentMethod,
} from "@/lib/products"

export type ProductCategory = "bebidas" | "suplementos" | "indumentaria" | "accesorios" | "otro"

export type ProductVariant = {
  id: string
  product_id: string
  name: string
  sku: string | null
  price: number | null
  cost_price: number | null
  stock: number
  is_active: boolean
}

export type Product = {
  id: string
  gym_id: string
  name: string
  description: string | null
  category: ProductCategory
  image_url: string | null
  base_price: number
  base_cost: number
  is_active: boolean
  product_variants: ProductVariant[]
}

export async function getProducts(includeInactive = false) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || !["admin", "trainer"].includes((me as { role: string }).role)) return { error: "Sin permiso" }

  const { data, error } = await (supabase
    .from("products" as never)
    .select("*, product_variants(*)")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("name")
    .order("name", { referencedTable: "product_variants" }) as unknown as Promise<{ data: Product[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  const products = includeInactive ? (data ?? []) : (data ?? []).filter(p => p.is_active)
  return { products }
}

export type CreateProductInput = {
  name: string
  description: string | null
  category: ProductCategory
  imageUrl?: string | null
  basePrice: number
  baseCost: number
}

export async function createProduct(input: CreateProductInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede crear productos" }
  }

  if (!input.name.trim()) return { error: "El nombre es obligatorio" }
  if (input.basePrice < 0) return { error: "El precio no puede ser negativo" }
  if (input.baseCost < 0) return { error: "El costo no puede ser negativo" }

  const { data, error } = await (supabase
    .from("products" as never)
    .insert({
      gym_id: (me as { gym_id: string }).gym_id,
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      image_url: normalizeOptionalUrl(input.imageUrl),
      base_price: input.basePrice,
      base_cost: input.baseCost,
      created_by: user.id,
    } as never)
    .select("id")
    .single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, id: data!.id }
}

export type UpdateProductInput = {
  name?: string
  description?: string | null
  category?: ProductCategory
  imageUrl?: string | null
  basePrice?: number
  baseCost?: number
}

export async function updateProduct(productId: string, input: UpdateProductInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede editar productos" }
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    if (!input.name.trim()) return { error: "El nombre es obligatorio" }
    updates.name = input.name.trim()
  }
  if (input.description !== undefined) updates.description = input.description
  if (input.category !== undefined) updates.category = input.category
  if (input.imageUrl !== undefined) updates.image_url = normalizeOptionalUrl(input.imageUrl)
  if (input.basePrice !== undefined) {
    if (input.basePrice < 0) return { error: "El precio no puede ser negativo" }
    updates.base_price = input.basePrice
  }
  if (input.baseCost !== undefined) {
    if (input.baseCost < 0) return { error: "El costo no puede ser negativo" }
    updates.base_cost = input.baseCost
  }

  // .eq("gym_id", ...) además de RLS: no alcanza con confiar en que la
  // policy bloquee un producto de otro gym — un UPDATE cuyo WHERE no
  // matchea ninguna fila no lanza error (a diferencia de un INSERT que
  // viola su policy), así que sin este chequeo explícito la función
  // devolvería { success: true } sin haber tocado nada.
  const { data, error } = await (supabase
    .from("products" as never)
    .update(updates as never)
    .eq("id", productId)
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Producto no encontrado" }

  revalidatePath("/productos")
  return { success: true }
}

export async function getMemberProducts(): Promise<{ products?: MemberProduct[]; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string; gym_id: string | null }).role !== "member" || !(me as { gym_id: string | null }).gym_id) {
    return { error: "Sin permiso" }
  }

  const admin = createAdminClient()
  const { data, error } = await (admin
    .from("products" as never)
    .select("id, name, description, category, image_url, base_price, is_active, product_variants(id, name, price, stock, is_active)")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .eq("is_active", true)
    .order("name")
    .order("name", { referencedTable: "product_variants" }) as unknown as Promise<{
      data: Array<{
        id: string
        name: string
        description: string | null
        category: ProductCategory
        image_url: string | null
        base_price: number
        is_active: boolean
        product_variants: Array<{ id: string; name: string; price: number | null; stock: number; is_active: boolean }>
      }> | null
      error: { message: string } | null
    }>)

  if (error) return { error: error.message }

  return { products: (data ?? []).map(toMemberProduct) }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede desactivar productos" }
  }

  const { data, error } = await (supabase
    .from("products" as never)
    .update({ is_active: isActive } as never)
    .eq("id", productId)
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Producto no encontrado" }

  revalidatePath("/productos")
  return { success: true }
}

export type CreateVariantInput = {
  name: string
  sku: string | null
  price: number | null
  costPrice: number | null
  stock: number
}

export async function createVariant(productId: string, input: CreateVariantInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede crear variantes" }
  }

  if (!input.name.trim()) return { error: "El nombre de la variante es obligatorio" }
  if (input.price !== null && input.price < 0) return { error: "El precio no puede ser negativo" }
  if (input.costPrice !== null && input.costPrice < 0) return { error: "El costo no puede ser negativo" }
  if (input.stock < 0) return { error: "El stock inicial no puede ser negativo" }

  const { data, error } = await (supabase
    .from("product_variants" as never)
    .insert({
      product_id: productId,
      name: input.name.trim(),
      sku: input.sku,
      price: input.price,
      cost_price: input.costPrice,
      stock: input.stock,
    } as never)
    .select("id")
    .single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, id: data!.id }
}

export type UpdateVariantInput = {
  name?: string
  sku?: string | null
  price?: number | null
  costPrice?: number | null
}

export async function updateVariant(variantId: string, input: UpdateVariantInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede editar variantes" }
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    if (!input.name.trim()) return { error: "El nombre de la variante es obligatorio" }
    updates.name = input.name.trim()
  }
  if (input.sku !== undefined) updates.sku = input.sku
  if (input.price !== undefined) {
    if (input.price !== null && input.price < 0) return { error: "El precio no puede ser negativo" }
    updates.price = input.price
  }
  if (input.costPrice !== undefined) {
    if (input.costPrice !== null && input.costPrice < 0) return { error: "El costo no puede ser negativo" }
    updates.cost_price = input.costPrice
  }

  // product_variants no tiene columna gym_id propia (se llega al gym vía
  // product_id -> products.gym_id), así que acá el chequeo de tenant lo
  // hace la RLS de la tabla (join contra products+profiles) — pero igual
  // hay que leer .select("id") y confirmar que devolvió fila: un UPDATE
  // bloqueado por RLS matchea 0 filas sin lanzar error, y sin este chequeo
  // la función reportaría éxito sin haber cambiado nada.
  const { data, error } = await (supabase
    .from("product_variants" as never)
    .update(updates as never)
    .eq("id", variantId)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Variante no encontrada" }

  revalidatePath("/productos")
  return { success: true }
}

export async function toggleVariantActive(variantId: string, isActive: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede desactivar variantes" }
  }

  const { data, error } = await (supabase
    .from("product_variants" as never)
    .update({ is_active: isActive } as never)
    .eq("id", variantId)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Variante no encontrada" }

  revalidatePath("/productos")
  return { success: true }
}

export async function restockVariant(variantId: string, quantity: number, newCost?: number | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede reponer stock" }
  }

  if (quantity <= 0) return { error: "La cantidad a reponer debe ser mayor a cero" }

  const { data, error } = await (supabase.rpc("restock_product_variant" as never, {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_new_cost: newCost ?? null,
  } as never) as unknown as Promise<{ data: number | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, newStock: data }
}

export type ProductSaleItemInput = {
  variantId: string
  quantity: number
}

export async function recordSale(
  items: ProductSaleItemInput[],
  memberId: string | null,
  paymentMethod: ProductPaymentMethod | null,
  paymentReference?: string | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id, can_collect_payments")
    .eq("id", user.id)
    .single()

  if (!me) return { error: "Sin permiso" }

  const profile = me as { role: string; gym_id: string; can_collect_payments: boolean }
  if (!canCollectPayment(profile.role, profile.can_collect_payments === true)) {
    return { error: "Sin permiso para vender productos" }
  }

  if (!isValidProductPaymentMethod(paymentMethod)) {
    return { error: "El método de pago es obligatorio para ventas pagas" }
  }

  const normalizedItems = items.map((item) => ({
    variant_id: item.variantId,
    quantity: item.quantity,
  }))

  if (normalizedItems.length === 0) return { error: "La orden debe incluir al menos un producto" }
  if (normalizedItems.some((item) => !item.variant_id || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    return { error: "La cantidad debe ser mayor a cero" }
  }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("create_product_order" as never, {
    p_gym_id: profile.gym_id,
    p_member_id: memberId ?? null,
    p_items: normalizedItems,
    p_created_by: user.id,
    p_order_type: "sale",
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference?.trim() || null,
    p_reservation_minutes: 30,
  } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  revalidatePath("/reports")
  return { success: true, orderId: data }
}

export type ProductOrderHistoryItem = {
  id: string
  product_id: string
  variant_id: string
  quantity: number
  unit_price: number
  unit_cost: number
  line_total: number
  line_margin: number
  products: { name: string } | null
  product_variants: { name: string } | null
}

export type ProductSaleRow = {
  id: string
  status: "reserved" | "paid" | "cancelled" | "expired"
  order_type: "sale" | "reservation"
  total_amount: number
  paid_amount: number | null
  payment_method: ProductPaymentMethod | null
  payment_reference: string | null
  created_at: string
  paid_at: string | null
  member_profile: { full_name: string | null } | null
  created_by_profile: { full_name: string | null } | null
  product_order_items: ProductOrderHistoryItem[]
}

export async function getProductSales() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede ver el historial de ventas" }
  }

  const { data, error } = await (supabase
    .from("product_orders" as never)
    .select("id, status, order_type, total_amount, paid_amount, payment_method, payment_reference, created_at, paid_at, member_profile:profiles!product_orders_member_id_fkey(full_name), created_by_profile:profiles!product_orders_created_by_fkey(full_name), product_order_items(id, product_id, variant_id, quantity, unit_price, unit_cost, line_total, line_margin, products(name), product_variants(name))")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("created_at", { ascending: false })
    .limit(200) as unknown as Promise<{ data: ProductSaleRow[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  return { sales: data ?? [] }
}

export async function getProductReport(startDate?: string, endDate?: string): Promise<{ report?: ProductOrderReport; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede ver reportes de productos" }
  }

  const gymId = (me as { gym_id: string }).gym_id
  const from = startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = endDate ?? new Date().toISOString()

  const { data: itemRows, error: itemError } = await (supabase
    .from("product_order_items" as never)
    .select("quantity, line_total, line_margin, products(id, name), product_variants(id, name), product_orders!inner(gym_id, status, payment_method, created_at, created_by_profile:profiles!product_orders_created_by_fkey(id, full_name))")
    .eq("product_orders.gym_id", gymId)
    .eq("product_orders.status", "paid")
    .gte("product_orders.created_at", from)
    .lte("product_orders.created_at", to) as unknown as Promise<{ data: Array<{
      quantity: number
      line_total: number
      line_margin: number
      products: { id: string; name: string } | null
      product_variants: { id: string; name: string } | null
      product_orders: {
        payment_method: ProductPaymentMethod | null
        created_by_profile: { id: string; full_name: string | null } | null
      } | null
    }> | null; error: { message: string } | null }>)

  if (itemError) return { error: itemError.message }

  const { data: stockRows, error: stockError } = await (supabase
    .from("product_variants" as never)
    .select("id, name, stock, products!inner(id, name, gym_id)")
    .eq("products.gym_id", gymId)
    .lte("stock", 5)
    .order("stock", { ascending: true }) as unknown as Promise<{ data: Array<{
      id: string
      name: string
      stock: number
      products: { id: string; name: string } | null
    }> | null; error: { message: string } | null }>)

  if (stockError) return { error: stockError.message }

  const rows = (itemRows ?? []).map((row) => ({
    productId: row.products?.id ?? "unknown",
    productName: row.products?.name ?? "Producto eliminado",
    variantId: row.product_variants?.id ?? null,
    variantName: row.product_variants?.name ?? null,
    sellerId: row.product_orders?.created_by_profile?.id ?? null,
    sellerName: row.product_orders?.created_by_profile?.full_name ?? null,
    paymentMethod: row.product_orders?.payment_method ?? "other",
    quantity: row.quantity,
    revenue: row.line_total,
    margin: row.line_margin,
  }))

  const lowStock = (stockRows ?? []).map((row) => ({
    productId: row.products?.id ?? "unknown",
    productName: row.products?.name ?? "Producto eliminado",
    variantId: row.id,
    variantName: row.name,
    stock: row.stock,
    threshold: 5,
  }))

  return { report: aggregateProductReport(rows, lowStock) }
}


export type ProductPromotionRow = {
  id: string
  gym_id: string
  product_id: string | null
  variant_id: string | null
  title: string
  description: string | null
  image_url: string | null
  public_price: number
  cta_label: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
}

export type UpsertProductPromotionInput = {
  id?: string
  productId?: string | null
  variantId?: string | null
  title: string
  description?: string | null
  imageUrl?: string | null
  publicPrice: number
  ctaLabel?: string | null
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  sortOrder?: number
}

export async function getProductPromotions() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as { role: string }).role !== "admin") return { error: "Solo un admin puede gestionar promociones" }

  const { data, error } = await (supabase
    .from("product_promotions" as never)
    .select("id, gym_id, product_id, variant_id, title, description, image_url, public_price, cta_label, is_active, starts_at, ends_at, sort_order, created_at")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false }) as unknown as Promise<{ data: ProductPromotionRow[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  return { promotions: data ?? [] }
}

export async function upsertProductPromotion(input: UpsertProductPromotionInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as { role: string }).role !== "admin") return { error: "Solo un admin puede gestionar promociones" }
  if (!input.title.trim()) return { error: "El título es obligatorio" }
  if (input.publicPrice < 0) return { error: "El precio público no puede ser negativo" }

  const payload = {
    ...(input.id ? { id: input.id } : {}),
    gym_id: (me as { gym_id: string }).gym_id,
    product_id: input.productId || null,
    variant_id: input.variantId || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    image_url: input.imageUrl?.trim() || null,
    public_price: input.publicPrice,
    cta_label: input.ctaLabel?.trim() || null,
    is_active: input.isActive,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    sort_order: input.sortOrder ?? 0,
    created_by: user.id,
  }

  const { data, error } = await (supabase.from("product_promotions" as never).upsert(payload as never).select("id").single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)
  if (error) return { error: error.message }

  revalidatePath("/productos")
  revalidatePath("/dashboard")
  return { success: true, id: data!.id }
}

export async function deleteProductPromotion(promotionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as { role: string }).role !== "admin") return { error: "Solo un admin puede gestionar promociones" }

  const { error } = await (supabase.from("product_promotions" as never).delete().eq("id", promotionId).eq("gym_id", (me as { gym_id: string }).gym_id) as unknown as Promise<{ error: { message: string } | null }>)
  if (error) return { error: error.message }

  revalidatePath("/productos")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function getMemberProductPromotions(): Promise<{ promotions?: MemberProductPromotion[]; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || !(me as { gym_id: string | null }).gym_id) return { error: "Sin permiso" }

  const profile = me as { role: string; gym_id: string }
  if (!["member", "admin", "trainer"].includes(profile.role)) return { error: "Sin permiso" }
  const now = new Date().toISOString()

  const { data, error } = await (supabase
    .from("product_promotions" as never)
    .select("id, gym_id, title, description, image_url, public_price, cta_label, is_active, starts_at, ends_at")
    .eq("gym_id", profile.gym_id)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("sort_order", { ascending: true })
    .limit(8) as unknown as Promise<{ data: Array<{ id: string; gym_id: string; title: string; description: string | null; image_url: string | null; public_price: number; cta_label: string | null; is_active: boolean; starts_at: string | null; ends_at: string | null }> | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  const promotions = getVisibleMemberPromotions((data ?? []).map((row) => ({
    id: row.id,
    gymId: row.gym_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    publicPrice: row.public_price,
    ctaLabel: row.cta_label,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  })), profile.gym_id)

  return { promotions }
}

export async function reserveProduct(items: ProductSaleItemInput[], memberId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me) return { error: "Sin permiso" }
  const profile = me as { role: string; gym_id: string }
  const reservationMemberId = profile.role === "member" ? user.id : (memberId || null)
  if (!reservationMemberId) return { error: "Elegí un socio para reservar" }

  const normalizedItems = items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity }))
  if (normalizedItems.length === 0) return { error: "La reserva debe incluir al menos un producto" }
  if (normalizedItems.some((item) => !item.variant_id || !Number.isInteger(item.quantity) || item.quantity <= 0)) return { error: "La cantidad debe ser mayor a cero" }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("create_product_order" as never, {
    p_gym_id: profile.gym_id,
    p_member_id: reservationMemberId,
    p_items: normalizedItems,
    p_created_by: user.id,
    p_order_type: "reservation",
    p_payment_method: null,
    p_payment_reference: null,
    p_reservation_minutes: 30,
  } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  revalidatePath("/productos")
  revalidatePath("/dashboard")
  return { success: true, orderId: data }
}

export async function markProductOrderPaid(
  orderId: string,
  paymentMethod: ProductPaymentMethod | null,
  paymentReference?: string | null,
  paidAmount?: number | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id, can_collect_payments")
    .eq("id", user.id)
    .single()

  if (!me) return { error: "Sin permiso" }

  const profile = me as { role: string; gym_id: string; can_collect_payments: boolean }
  if (!canCollectPayment(profile.role, profile.can_collect_payments === true)) {
    return { error: "Sin permiso para cobrar productos" }
  }

  if (!isValidProductPaymentMethod(paymentMethod)) {
    return { error: "El método de pago es obligatorio para cobrar la reserva" }
  }

  if (paidAmount != null && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
    return { error: "El importe pagado no puede ser negativo" }
  }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("mark_product_order_paid" as never, {
    p_order_id: orderId,
    p_gym_id: profile.gym_id,
    p_paid_by: user.id,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference?.trim() || null,
    p_paid_amount: paidAmount ?? null,
  } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  revalidatePath("/productos")
  revalidatePath("/reports")
  revalidatePath("/dashboard")
  return { success: data === orderId, orderId: data }
}

export async function cancelProductReservation(orderId: string, reason?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me) return { error: "Sin permiso" }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("cancel_product_order" as never, {
    p_order_id: orderId,
    p_gym_id: (me as { gym_id: string }).gym_id,
    p_cancelled_by: user.id,
    p_reason: reason?.trim() || null,
  } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  revalidatePath("/productos")
  revalidatePath("/dashboard")
  return { success: data === orderId }
}

export async function releaseExpiredProductReservations() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as { role: string }).role !== "admin") return { error: "Solo un admin puede liberar reservas vencidas" }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("release_expired_product_reservations" as never, { p_gym_id: (me as { gym_id: string }).gym_id } as never) as unknown as Promise<{ data: number | null; error: { message: string } | null }>)
  if (error) return { error: error.message }

  revalidatePath("/productos")
  revalidatePath("/dashboard")
  return { success: true, released: data ?? 0 }
}
export async function reserveProductPromotion(promotionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "member") return { error: "Solo un socio puede reservar promociones" }

  const { data: promotion, error: promoError } = await (supabase
    .from("product_promotions" as never)
    .select("id, gym_id, variant_id, is_active, starts_at, ends_at")
    .eq("id", promotionId)
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .single() as unknown as Promise<{ data: { id: string; gym_id: string; variant_id: string | null; is_active: boolean; starts_at: string | null; ends_at: string | null } | null; error: { message: string } | null }>)

  if (promoError) return { error: promoError.message }
  if (!promotion?.variant_id) return { error: "Esta promoción no tiene una variante reservable" }

  const visible = getVisibleMemberPromotions([{
    id: promotion.id,
    gymId: promotion.gym_id,
    title: "Promoción",
    publicPrice: 0,
    isActive: promotion.is_active,
    startsAt: promotion.starts_at,
    endsAt: promotion.ends_at,
  }], (me as { gym_id: string }).gym_id)

  if (visible.length === 0) return { error: "La promoción no está activa" }

  return reserveProduct([{ variantId: promotion.variant_id, quantity: 1 }], user.id)
}

