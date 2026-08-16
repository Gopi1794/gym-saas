"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
    .select("gym_id")
    .eq("id", user.id)
    .single()

  if (!me) return { error: "Sin permiso" }

  const { data, error } = await (supabase
    .from("products" as never)
    .select("*, product_variants(*)")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("name") as unknown as Promise<{ data: Product[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  const products = includeInactive ? (data ?? []) : (data ?? []).filter(p => p.is_active)
  return { products }
}

export type CreateProductInput = {
  name: string
  description: string | null
  category: ProductCategory
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
