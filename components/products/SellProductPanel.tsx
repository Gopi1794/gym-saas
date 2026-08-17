"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { recordSale, type Product } from "@/app/actions/products"
import { resolveVariantPrice, calculateSaleTotal } from "@/lib/products"

type Member = { id: string; full_name: string | null }

interface FlatVariant {
  variantId: string
  productId: string
  label: string // "Whey Protein — 1kg"
  price: number
  stock: number
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
          productId: product.id,
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
  const [memberId, setMemberId] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const selected = flatVariants.find(v => v.variantId === variantId) ?? null
  const total = selected ? calculateSaleTotal(selected.price, Number(quantity) || 0) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    setFeedback(null)

    const result = await recordSale(selected.variantId, Number(quantity), memberId || null)

    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Venta registrada" })
      setQuantity("1")
      setMemberId("")
    }
  }

  if (flatVariants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay productos con stock disponibles para vender.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Socio (opcional)</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            <option value="">Sin socio</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name ?? "Sin nombre"}</option>
            ))}
          </select>
        </div>

        {feedback && <Alert variant={feedback.kind === "success" ? "success" : "error"}>{feedback.msg}</Alert>}

        <Button type="submit" disabled={loading || !selected} className="w-full">
          {loading ? "Vendiendo…" : `Vender — $${total.toLocaleString("es-AR")}`}
        </Button>
      </form>
    </div>
  )
}
