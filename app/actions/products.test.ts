import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))
vi.mock("@/lib/payments", () => ({
  canCollectPayment: (role: string, flag: boolean) => role === "admin" || flag === true,
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import {
  getProducts, createProduct, updateProduct, toggleProductActive,
  createVariant, updateVariant, toggleVariantActive,
  restockVariant, recordSale, getProductSales, getProductReport,
  getMemberProducts, getMemberProductPromotions, reserveProduct, markProductOrderPaid, cancelProductReservation, releaseExpiredProductReservations, upsertProductPromotion,
} from "./products"

function mockUser(id: string | null) {
  return { data: { user: id ? { id } : null } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getProducts", () => {
  it("devuelve solo los productos activos por defecto", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      {
        data: [
          { id: "p1", is_active: true, product_variants: [] },
          { id: "p2", is_active: false, product_variants: [] },
        ],
        error: null,
      },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProducts()

    expect(result).toEqual({ products: [{ id: "p1", is_active: true, product_variants: [] }] })
  })

  it("con includeInactive, devuelve también los desactivados", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      {
        data: [
          { id: "p1", is_active: true, product_variants: [] },
          { id: "p2", is_active: false, product_variants: [] },
        ],
        error: null,
      },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProducts(true)

    expect(result.products).toHaveLength(2)
  })

  it("no expone el catálogo interno a members", async () => {
    const supabase = createMockSupabase([
      { data: { role: "member", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProducts()

    expect(result).toEqual({ error: "Sin permiso" })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })
})

describe("createProduct", () => {
  const INPUT = {
    name: "Whey Protein",
    description: null,
    category: "suplementos" as const,
    basePrice: 15000,
    baseCost: 9000,
  }

  it("un admin puede crear un producto", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { id: "new-product-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct(INPUT)

    expect(result).toEqual({ success: true, id: "new-product-1" })
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({
      gym_id: "gym-1",
      name: "Whey Protein",
      category: "suplementos",
      image_url: null,
      base_price: 15000,
      base_cost: 9000,
      created_by: "admin-1",
    })
  })

  it("normaliza y persiste image_url al crear", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { id: "new-product-1" }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    await createProduct({ ...INPUT, imageUrls: ["  https://cdn.example.com/whey.png  ", "https://cdn.example.com/whey-2.png"] })

    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({ image_url: "https://cdn.example.com/whey.png" })
    const imagePayload = (supabase.chains[3].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(imagePayload).toEqual([
      { product_id: "new-product-1", gym_id: "gym-1", image_url: "https://cdn.example.com/whey.png", sort_order: 0, is_primary: true },
      { product_id: "new-product-1", gym_id: "gym-1", image_url: "https://cdn.example.com/whey-2.png", sort_order: 1, is_primary: false },
    ])
  })

  it("un trainer no puede crear productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct(INPUT)

    expect(result).toEqual({ error: "Solo un admin puede crear productos" })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it("rechaza un precio negativo antes de escribir", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct({ ...INPUT, basePrice: -100 })

    expect(result).toEqual({ error: "El precio no puede ser negativo" })
  })
})

describe("updateProduct", () => {
  it("un admin puede actualizar el nombre", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "product-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-1", { name: "Whey Protein Doble Chocolate" })

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ name: "Whey Protein Doble Chocolate" })
  })

  it("normaliza image_url al actualizar y permite limpiarla", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "product-1" }], error: null },
      { data: null, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-1", { imageUrls: [] })

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ image_url: null })
  })

  it("un trainer no puede actualizar productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-1", { name: "x" })

    expect(result).toEqual({ error: "Solo un admin puede editar productos" })
  })

  it("un producto de otro gym no matchea el UPDATE y devuelve error en vez de éxito silencioso", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-de-otro-gym", { name: "x" })

    expect(result).toEqual({ error: "Producto no encontrado" })
  })
})

describe("toggleProductActive", () => {
  it("un admin puede desactivar un producto", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "product-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleProductActive("product-1", false)

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ is_active: false })
  })

  it("un trainer no puede desactivar productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleProductActive("product-1", false)

    expect(result).toEqual({ error: "Solo un admin puede desactivar productos" })
  })
})

describe("createVariant", () => {
  const INPUT = { name: "1kg", sku: null, price: null, costPrice: null, stock: 10 }

  it("un admin puede crear una variante", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: { id: "variant-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", INPUT)

    expect(result).toEqual({ success: true, id: "variant-1" })
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toEqual({
      product_id: "product-1",
      name: "1kg",
      sku: null,
      price: null,
      cost_price: null,
      stock: 10,
    })
  })

  it("un trainer no puede crear variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", INPUT)

    expect(result).toEqual({ error: "Solo un admin puede crear variantes" })
  })

  it("rechaza un stock inicial negativo", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", { ...INPUT, stock: -5 })

    expect(result).toEqual({ error: "El stock inicial no puede ser negativo" })
  })
})

describe("updateVariant", () => {
  it("un admin puede actualizar el precio", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [{ id: "variant-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-1", { price: 1800 })

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ price: 1800 })
  })

  it("una variante que no matchea el UPDATE (de otro gym, o inexistente) devuelve error en vez de éxito silencioso", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-de-otro-gym", { price: 1800 })

    expect(result).toEqual({ error: "Variante no encontrada" })
  })

  it("un trainer no puede actualizar variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-1", { price: 1800 })

    expect(result).toEqual({ error: "Solo un admin puede editar variantes" })
  })
})

describe("toggleVariantActive", () => {
  it("un admin puede desactivar una variante", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [{ id: "variant-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleVariantActive("variant-1", false)

    expect(result).toEqual({ success: true })
  })

  it("un trainer no puede desactivar variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleVariantActive("variant-1", false)

    expect(result).toEqual({ error: "Solo un admin puede desactivar variantes" })
  })
})

describe("restockVariant", () => {
  it("un admin puede reponer stock", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null }, // me
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    supabase.rpc.mockResolvedValueOnce({ data: 30, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 20)

    expect(result).toEqual({ success: true, newStock: 30 })
    expect(supabase.rpc).toHaveBeenCalledWith("restock_product_variant", {
      p_variant_id: "variant-1",
      p_quantity: 20,
      p_new_cost: null,
    })
  })

  it("un trainer no puede reponer stock", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 20)

    expect(result).toEqual({ error: "Solo un admin puede reponer stock" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rechaza venta paga sin método antes de llamar al RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale([{ variantId: "variant-1", quantity: 1 }], null, null)

    expect(result).toEqual({ error: "El método de pago es obligatorio para ventas pagas" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("rechaza una cantidad de cero antes de llamar al RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 0)

    expect(result).toEqual({ error: "La cantidad a reponer debe ser mayor a cero" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe("recordSale", () => {
  it("un admin puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const adminClient = {
      rpc: vi.fn().mockResolvedValueOnce({ data: "sale-1", error: null }),
    }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await recordSale([{ variantId: "variant-1", quantity: 2 }], "member-1", "transfer", "ref-123")

    expect(result).toEqual({ success: true, orderId: "sale-1" })
    expect(adminClient.rpc).toHaveBeenCalledWith("create_product_order", {
      p_gym_id: "gym-1",
      p_member_id: "member-1",
      p_items: [{ variant_id: "variant-1", quantity: 2 }],
      p_created_by: "admin-1",
      p_order_type: "sale",
      p_payment_method: "transfer",
      p_payment_reference: "ref-123",
      p_reservation_minutes: 30,
    })
  })

  it("un trainer con can_collect_payments puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1", can_collect_payments: true }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const adminClient = {
      rpc: vi.fn().mockResolvedValueOnce({ data: "sale-2", error: null }),
    }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await recordSale([{ variantId: "variant-1", quantity: 1 }], null, "cash")

    expect(result).toEqual({ success: true, orderId: "sale-2" })
  })

  it("un trainer sin can_collect_payments no puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale([{ variantId: "variant-1", quantity: 1 }], null, "cash")

    expect(result).toEqual({ error: "Sin permiso para vender productos" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("rechaza venta paga sin método antes de llamar al RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale([{ variantId: "variant-1", quantity: 1 }], null, null)

    expect(result).toEqual({ error: "El método de pago es obligatorio para ventas pagas" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("rechaza una cantidad de cero antes de llamar al RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale([{ variantId: "variant-1", quantity: 0 }], null, "cash")

    expect(result).toEqual({ error: "La cantidad debe ser mayor a cero" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("stock insuficiente devuelve el error del RPC tal cual", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const adminClient = {
      rpc: vi.fn().mockResolvedValueOnce({ data: null, error: { message: "Stock insuficiente" } }),
    }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await recordSale([{ variantId: "variant-1", quantity: 999 }], null, "cash")

    expect(result).toEqual({ error: "Stock insuficiente" })
  })
})

describe("getProductSales", () => {
  it("un admin puede ver el historial de ventas", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "sale-1", quantity: 2, unit_price: 1500, unit_cost: 900, total_amount: 3000, created_at: "2026-08-15T12:00:00Z", product_variants: null, profiles: null }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductSales()

    expect(result.sales).toHaveLength(1)
  })

  it("un trainer no puede ver el historial de ventas", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductSales()

    expect(result).toEqual({ error: "Solo un admin puede ver el historial de ventas" })
  })
})



describe("getProductReport", () => {
  it("agrega revenue de productos separado de pagos de membresías", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      {
        data: [
          {
            quantity: 2,
            line_total: 3000,
            line_margin: 1000,
            products: { id: "product-1", name: "Agua" },
            product_variants: { id: "variant-1", name: "500ml" },
            product_orders: {
              payment_method: "cash",
              created_by_profile: { id: "admin-1", full_name: "Admin" },
            },
          },
        ],
        error: null,
      },
      {
        data: [
          { id: "variant-low", name: "1kg", stock: 3, products: { id: "product-2", name: "Whey" } },
        ],
        error: null,
      },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductReport("2026-08-01T00:00:00Z", "2026-08-31T23:59:59Z")

    expect(result.report).toMatchObject({
      revenue: 3000,
      margin: 1000,
      units: 2,
      byMethod: { cash: 3000, mercadopago: 0, transfer: 0, card: 0, other: 0 },
      bySeller: [{ sellerId: "admin-1", sellerName: "Admin", revenue: 3000, units: 2 }],
      lowStock: [{ productId: "product-2", productName: "Whey", variantId: "variant-low", variantName: "1kg", stock: 3, threshold: 5 }],
    })
    expect(supabase.from).toHaveBeenCalledWith("product_order_items")
    expect(supabase.from).toHaveBeenCalledWith("product_variants")
  })

  it("un trainer no puede ver reportes de productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductReport()

    expect(result).toEqual({ error: "Solo un admin puede ver reportes de productos" })
  })
})

describe("getMemberProducts", () => {
  it("devuelve catálogo member-safe sin costos, sku ni datos internos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "member", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    const adminClient = createMockSupabase([
      {
        data: [{
          id: "product-1",
          name: "Whey",
          description: "Proteína",
          category: "suplementos",
          image_url: "https://cdn.example.com/whey.png",
          base_price: 15000,
          base_cost: 9000,
          is_active: true,
          product_images: [
            { image_url: "https://cdn.example.com/whey-front.png", sort_order: 0, is_primary: true },
            { image_url: "https://cdn.example.com/whey-back.png", sort_order: 1, is_primary: false },
          ],
          product_variants: [
            { id: "variant-1", name: "1kg", sku: "WHEY-1KG", price: null, cost_price: 9500, stock: 3, is_active: true },
            { id: "variant-2", name: "2kg", sku: "WHEY-2KG", price: 28000, cost_price: 18000, stock: 0, is_active: false },
          ],
        }],
        error: null,
      },
    ])
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await getMemberProducts()

    expect(result.products).toEqual([{
      id: "product-1",
      name: "Whey",
      description: "Proteína",
      category: "suplementos",
      image_url: "https://cdn.example.com/whey-front.png",
      base_price: 15000,
      product_images: [
        { image_url: "https://cdn.example.com/whey-front.png", alt_text: null, sort_order: 0, is_primary: true },
        { image_url: "https://cdn.example.com/whey-back.png", alt_text: null, sort_order: 1, is_primary: false },
      ],
      product_variants: [{ id: "variant-1", name: "1kg", price: 15000, stock: 3 }],
    }])
    expect(result.products?.[0]).not.toHaveProperty("base_cost")
    expect(result.products?.[0].product_variants[0]).not.toHaveProperty("cost_price")
    expect(result.products?.[0].product_variants[0]).not.toHaveProperty("sku")
    expect(adminClient.chains[0].select).toHaveBeenCalledWith("id, name, description, category, image_url, base_price, is_active, product_variants(id, name, price, stock, is_active), product_images(id, image_url, alt_text, sort_order, is_primary)")
  })

  it("rechaza perfiles que no son member", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getMemberProducts()

    expect(result).toEqual({ error: "Sin permiso" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })
})

describe("product promotions and reservations", () => {
  it("getMemberProductPromotions devuelve solo campos seguros para socios", async () => {
    const supabase = createMockSupabase([
      { data: { role: "member", gym_id: "gym-1" }, error: null },
      {
        data: [{
          id: "promo-1",
          gym_id: "gym-1",
          title: "Whey promo",
          description: "Proteína",
          image_url: null,
          public_price: 12000,
          cta_label: "Reservar",
          is_active: true,
          starts_at: null,
          ends_at: null,
        }],
        error: null,
      },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("member-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getMemberProductPromotions()

    expect(result.promotions).toEqual([{
      id: "promo-1",
      title: "Whey promo",
      description: "Proteína",
      image_url: null,
      price: 12000,
      cta_label: "Reservar",
    }])
    expect(result.promotions?.[0]).not.toHaveProperty("cost_price")
    expect(result.promotions?.[0]).not.toHaveProperty("margin")
    expect(supabase.chains[1].select).toHaveBeenCalledWith("id, gym_id, title, description, image_url, public_price, cta_label, is_active, starts_at, ends_at")
  })

  it("upsertProductPromotion fuerza gym_id del admin y no acepta costo/margen", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: { id: "promo-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await upsertProductPromotion({
      title: "Promo",
      publicPrice: 1500,
      isActive: true,
      productId: "product-1",
      variantId: "variant-1",
    })

    expect(result).toEqual({ success: true, id: "promo-1" })
    const payload = (supabase.chains[1].upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toMatchObject({ gym_id: "gym-1", public_price: 1500, created_by: "admin-1" })
    expect(payload).not.toHaveProperty("cost_price")
    expect(payload).not.toHaveProperty("margin")
  })

  it("reserveProduct crea una orden reservation tenant-scoped", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)
    const adminClient = { rpc: vi.fn().mockResolvedValueOnce({ data: "order-1", error: null }) }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await reserveProduct([{ variantId: "variant-1", quantity: 1 }], "member-1")

    expect(result).toEqual({ success: true, orderId: "order-1" })
    expect(adminClient.rpc).toHaveBeenCalledWith("create_product_order", {
      p_gym_id: "gym-1",
      p_member_id: "member-1",
      p_items: [{ variant_id: "variant-1", quantity: 1 }],
      p_created_by: "admin-1",
      p_order_type: "reservation",
      p_payment_method: null,
      p_payment_reference: null,
      p_reservation_minutes: 30,
    })
  })

  it("cancelProductReservation llama el RPC tenant-scoped", async () => {
    const orderId = "7f1f84a2-7a7b-4fc9-a3e3-f0ea0e9dfb40"
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)
    const adminClient = { rpc: vi.fn().mockResolvedValueOnce({ data: orderId, error: null }) }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await cancelProductReservation(orderId, "cliente pidió cancelar")

    expect(result).toEqual({ success: true })
    expect(adminClient.rpc).toHaveBeenCalledWith("cancel_product_order", {
      p_order_id: orderId,
      p_gym_id: "gym-1",
      p_cancelled_by: "admin-1",
      p_reason: "cliente pidió cancelar",
    })
  })

  it("markProductOrderPaid cobra una reserva con método, referencia e importe", async () => {
    const orderId = "0a2107df-9fb6-47b5-8c6c-9f4dbca2a7f4"
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)
    const adminClient = { rpc: vi.fn().mockResolvedValueOnce({ data: orderId, error: null }) }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await markProductOrderPaid(orderId, "mercadopago", " mp-123 ", 1500)

    expect(result).toEqual({ success: true, orderId })
    expect(adminClient.rpc).toHaveBeenCalledWith("mark_product_order_paid", {
      p_order_id: orderId,
      p_gym_id: "gym-1",
      p_paid_by: "admin-1",
      p_payment_method: "mercadopago",
      p_payment_reference: "mp-123",
      p_paid_amount: 1500,
    })
  })

  it("markProductOrderPaid rechaza método inválido antes del RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await markProductOrderPaid("0a2107df-9fb6-47b5-8c6c-9f4dbca2a7f4", null)

    expect(result).toEqual({ error: "El método de pago es obligatorio para cobrar la reserva" })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("releaseExpiredProductReservations usa el RPC scoped al gym del admin", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)
    const adminClient = { rpc: vi.fn().mockResolvedValueOnce({ data: 2, error: null }) }
    mockCreateAdminClient.mockReturnValue(adminClient)

    const result = await releaseExpiredProductReservations()

    expect(result).toEqual({ success: true, released: 2 })
    expect(adminClient.rpc).toHaveBeenCalledWith("release_expired_product_reservations", { p_gym_id: "gym-1" })
  })
})

