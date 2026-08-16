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
  restockVariant, recordSale, getProductSales,
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
      { data: { gym_id: "gym-1" }, error: null },
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
      { data: { gym_id: "gym-1" }, error: null },
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
      base_price: 15000,
      base_cost: 9000,
      created_by: "admin-1",
    })
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

    const result = await recordSale("variant-1", 2, "member-1")

    expect(result).toEqual({ success: true, saleId: "sale-1" })
    expect(adminClient.rpc).toHaveBeenCalledWith("record_product_sale", {
      p_variant_id: "variant-1",
      p_gym_id: "gym-1",
      p_member_id: "member-1",
      p_quantity: 2,
      p_recorded_by: "admin-1",
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

    const result = await recordSale("variant-1", 1, null)

    expect(result).toEqual({ success: true, saleId: "sale-2" })
  })

  it("un trainer sin can_collect_payments no puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale("variant-1", 1, null)

    expect(result).toEqual({ error: "Sin permiso para vender productos" })
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

    const result = await recordSale("variant-1", 999, null)

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
