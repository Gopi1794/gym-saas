import { describe, it, expect } from "vitest"
import {
  aggregateProductReport,
  calculateMargin,
  calculateOrderTotals,
  calculateSaleTotal,
  getVisibleMemberPromotions,
  resolveVariantCost,
  resolveVariantPrice,
  validateProductOrderItems,
  validateProductPayment,
} from "./products"

describe("resolveVariantPrice", () => {
  it("usa el precio de la variante cuando está definido", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: 1500 })).toBe(1500)
  })

  it("cae al precio base del producto cuando la variante no tiene precio propio", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: null })).toBe(1000)
  })
})

describe("resolveVariantCost", () => {
  it("usa el costo de la variante cuando está definido", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: 600 })).toBe(600)
  })

  it("cae al costo base del producto cuando la variante no tiene costo propio", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: null })).toBe(400)
  })
})

describe("calculateSaleTotal", () => {
  it("multiplica precio unitario por cantidad", () => {
    expect(calculateSaleTotal(1500, 3)).toBe(4500)
  })

  it("redondea a 2 decimales", () => {
    expect(calculateSaleTotal(10.005, 3)).toBe(30.02)
  })
})

describe("calculateMargin", () => {
  it("calcula la ganancia total de la venta", () => {
    expect(calculateMargin(1500, 900, 2)).toBe(1200)
  })

  it("puede ser negativo si se vende a pérdida — no es un caso de error", () => {
    expect(calculateMargin(500, 900, 1)).toBe(-400)
  })

  it("es cero cuando precio y costo son iguales", () => {
    expect(calculateMargin(1000, 1000, 5)).toBe(0)
  })
})

describe("calculateOrderTotals", () => {
  it("suma totales, margen y unidades de órdenes multi-item", () => {
    expect(
      calculateOrderTotals([
        { variantId: "v1", quantity: 2, unitPrice: 1000, unitCost: 600 },
        { variantId: "v2", quantity: 1, unitPrice: 500, unitCost: 300 },
      ])
    ).toEqual({ subtotal: 2500, total: 2500, margin: 1000, units: 3 })
  })
})

describe("validateProductOrderItems", () => {
  it("rechaza cantidades cero, negativas, decimales y mayores al stock", () => {
    expect(
      validateProductOrderItems([
        { variantId: "zero", quantity: 0, unitPrice: 100, unitCost: 50, stock: 10 },
        { variantId: "negative", quantity: -1, unitPrice: 100, unitCost: 50, stock: 10 },
        { variantId: "decimal", quantity: 1.5, unitPrice: 100, unitCost: 50, stock: 10 },
        { variantId: "nostock", quantity: 11, unitPrice: 100, unitCost: 50, stock: 10 },
      ])
    ).toEqual([
      "Cantidad inválida para la variante zero",
      "Cantidad inválida para la variante negative",
      "Cantidad inválida para la variante decimal",
      "Stock insuficiente para la variante nostock",
    ])
  })
})

describe("validateProductPayment", () => {
  it("rechaza ventas pagas sin método de pago", () => {
    expect(validateProductPayment({ status: "paid", paymentMethod: null })).toEqual([
      "El método de pago es obligatorio para ventas pagas",
    ])
  })

  it("no exige método de pago para reservas", () => {
    expect(validateProductPayment({ status: "reserved", paymentMethod: null })).toEqual([])
  })
})

describe("aggregateProductReport", () => {
  it("devuelve ceros para rangos sin órdenes", () => {
    expect(aggregateProductReport([])).toEqual({
      revenue: 0,
      margin: 0,
      units: 0,
      topProducts: [],
      byMethod: { cash: 0, mercadopago: 0, transfer: 0, card: 0, other: 0 },
      bySeller: [],
      lowStock: [],
    })
  })

  it("agrega revenue, margen, unidades, métodos y vendedores", () => {
    expect(
      aggregateProductReport([
        {
          productId: "p1",
          productName: "Agua",
          sellerId: "u1",
          sellerName: "Admin",
          paymentMethod: "cash",
          quantity: 2,
          revenue: 2000,
          margin: 800,
        },
        {
          productId: "p1",
          productName: "Agua",
          sellerId: "u1",
          sellerName: "Admin",
          paymentMethod: "card",
          quantity: 1,
          revenue: 1000,
          margin: 400,
        },
      ])
    ).toMatchObject({
      revenue: 3000,
      margin: 1200,
      units: 3,
      byMethod: { cash: 2000, mercadopago: 0, transfer: 0, card: 1000, other: 0 },
      topProducts: [{ productId: "p1", productName: "Agua", units: 3, revenue: 3000, margin: 1200 }],
      bySeller: [{ sellerId: "u1", sellerName: "Admin", revenue: 3000, units: 3 }],
    })
  })
})

describe("getVisibleMemberPromotions", () => {
  it("filtra promociones inactivas, vencidas o de otro gym", () => {
    const now = new Date("2026-08-23T12:00:00Z")

    expect(
      getVisibleMemberPromotions(
        [
          {
            id: "visible",
            gymId: "gym-1",
            title: "Promo agua",
            description: "2x1",
            imageUrl: "https://example.com/agua.png",
            publicPrice: 1000,
            ctaLabel: "Reservar",
            isActive: true,
            startsAt: "2026-08-22T00:00:00Z",
            endsAt: "2026-08-24T00:00:00Z",
            costPrice: 300,
            margin: 700,
          },
          {
            id: "other-gym",
            gymId: "gym-2",
            title: "Otra promo",
            publicPrice: 1000,
            isActive: true,
          },
          {
            id: "expired",
            gymId: "gym-1",
            title: "Vencida",
            publicPrice: 1000,
            isActive: true,
            endsAt: "2026-08-22T00:00:00Z",
          },
        ],
        "gym-1",
        now
      )
    ).toEqual([
      {
        id: "visible",
        title: "Promo agua",
        description: "2x1",
        image_url: "https://example.com/agua.png",
        price: 1000,
        cta_label: "Reservar",
      },
    ])
  })

  it("devuelve solo campos member-safe sin costo ni margen", () => {
    const [promotion] = getVisibleMemberPromotions(
      [
        {
          id: "promo-1",
          gymId: "gym-1",
          title: "Proteína",
          description: null,
          imageUrl: null,
          publicPrice: 15000,
          ctaLabel: null,
          isActive: true,
          costPrice: 9000,
          baseCost: 8000,
          margin: 6000,
        },
      ],
      "gym-1",
      new Date("2026-08-23T12:00:00Z")
    )

    expect(promotion).toEqual({
      id: "promo-1",
      title: "Proteína",
      description: null,
      image_url: null,
      price: 15000,
      cta_label: null,
    })
    expect(promotion).not.toHaveProperty("costPrice")
    expect(promotion).not.toHaveProperty("baseCost")
    expect(promotion).not.toHaveProperty("margin")
  })
})
