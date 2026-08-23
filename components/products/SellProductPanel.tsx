"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { recordSale, releaseExpiredProductReservations, reserveProduct, type Product } from "@/app/actions/products"
import { PRODUCT_PAYMENT_METHODS, resolveVariantPrice, calculateSaleTotal, type ProductPaymentMethod } from "@/lib/products"

type Member = { id: string; full_name: string | null }

interface FlatVariant {
  variantId: string
  label: string
  price: number
  stock: number
}

type CartItem = FlatVariant & { quantity: number }

const METHOD_LABELS: Record<ProductPaymentMethod, string> = {
  cash: "Efectivo",
  mercadopago: "MercadoPago",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
}

export default function SellProductPanel({ products, members }: { products: Product[]; members: Member[] }) {
  const flatVariants = useMemo<FlatVariant[]>(() => {
    const result: FlatVariant[] = []
    for (const product of products) {
      if (!product.is_active) continue
      for (const variant of product.product_variants) {
        if (!variant.is_active) continue
        result.push({
          variantId: variant.id,
          label: `${product.name} — ${variant.name}`,
          price: resolveVariantPrice(product, variant),
          stock: variant.stock,
        })
      }
    }
    return result
  }, [products])

  const [variantId, setVariantId] = useState(flatVariants[0]?.variantId ?? "")
  const [quantity, setQuantity] = useState("1")
  const [cart, setCart] = useState<CartItem[]>([])
  const [memberId, setMemberId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<ProductPaymentMethod | "">("")
  const [paymentReference, setPaymentReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const selected = flatVariants.find(v => v.variantId === variantId) ?? null
  const total = cart.reduce((sum, item) => sum + calculateSaleTotal(item.price, item.quantity), 0)

  function addItem() {
    if (!selected) return
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) {
      setFeedback({ kind: "error", msg: "La cantidad debe ser mayor a cero" })
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.variantId === selected.variantId)
      if (existing) {
        return current.map((item) => item.variantId === selected.variantId ? { ...item, quantity: item.quantity + qty } : item)
      }
      return [...current, { ...selected, quantity: qty }]
    })
    setQuantity("1")
    setFeedback(null)
  }

  async function handleReserve() {
    if (cart.length === 0) return setFeedback({ kind: "error", msg: "Agregá al menos un producto" })
    if (!memberId) return setFeedback({ kind: "error", msg: "Elegí un socio para reservar" })

    setLoading(true)
    setFeedback(null)

    const result = await reserveProduct(
      cart.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      memberId
    )

    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Reserva creada por 30 minutos" })
      setCart([])
      setMemberId("")
      setPaymentMethod("")
      setPaymentReference("")
    }
  }

  async function handleReleaseExpired() {
    setLoading(true)
    setFeedback(null)
    const result = await releaseExpiredProductReservations()
    setLoading(false)
    setFeedback(result.error ? { kind: "error", msg: result.error } : { kind: "success", msg: `Reservas vencidas liberadas: ${result.released}` })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return setFeedback({ kind: "error", msg: "Agregá al menos un producto" })
    if (!paymentMethod) return setFeedback({ kind: "error", msg: "Elegí un método de pago" })

    setLoading(true)
    setFeedback(null)

    const result = await recordSale(
      cart.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      memberId || null,
      paymentMethod,
      paymentReference
    )

    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Venta registrada" })
      setCart([])
      setMemberId("")
      setPaymentMethod("")
      setPaymentReference("")
    }
  }

  if (flatVariants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay productos activos para vender.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 max-w-2xl">
      <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Producto *</label>
          <select
            required
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            {flatVariants.map((v) => (
              <option key={v.variantId} value={v.variantId}>
                {v.label} — ${v.price.toLocaleString("es-AR")} (stock: {v.stock})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Cantidad *</label>
          <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={addItem} variant="secondary">Agregar</Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
          {cart.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Todavía no agregaste productos a la venta.</p>
          ) : cart.map((item) => (
            <div key={item.variantId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-muted-foreground">{item.quantity} × ${item.price.toLocaleString("es-AR")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">${calculateSaleTotal(item.price, item.quantity).toLocaleString("es-AR")}</span>
                <button type="button" className="text-xs text-red-500" onClick={() => setCart(cart.filter((cartItem) => cartItem.variantId !== item.variantId))}>Quitar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Método de pago *</label>
            <select
              required
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ProductPaymentMethod)}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            >
              <option value="">Seleccionar</option>
              {PRODUCT_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Referencia (opcional)</label>
            <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Cupón, transferencia, operación…" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Socio (opcional)</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            <option value="">Sin socio</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? "Sin nombre"}</option>)}
          </select>
        </div>

        {feedback && <Alert variant={feedback.kind === "success" ? "success" : "error"}>{feedback.msg}</Alert>}

        <div className="grid gap-2 md:grid-cols-2">
          <Button type="submit" disabled={loading || cart.length === 0}>
            {loading ? "Procesando…" : `Registrar venta — ${total.toLocaleString("es-AR")}`}
          </Button>
          <Button type="button" variant="secondary" disabled={loading || cart.length === 0 || !memberId} onClick={handleReserve}>
            Reservar 30 min
          </Button>
        </div>
        <Button type="button" variant="ghost" disabled={loading} onClick={handleReleaseExpired} className="w-full">
          Liberar reservas vencidas
        </Button>
      </form>
    </div>
  )
}

