"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createVariant, updateVariant, type ProductVariant } from "@/app/actions/products"

interface Props {
  productId: string
  variant?: ProductVariant
  trigger: React.ReactNode
}

export default function VariantFormDialog({ productId, variant, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(variant?.name ?? "")
  const [sku, setSku] = useState(variant?.sku ?? "")
  const [price, setPrice] = useState(variant?.price != null ? String(variant.price) : "")
  const [costPrice, setCostPrice] = useState(variant?.cost_price != null ? String(variant.cost_price) : "")
  const [stock, setStock] = useState(variant ? String(variant.stock) : "0")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = variant
      ? await updateVariant(variant.id, {
          name,
          sku: sku.trim() || null,
          price: price.trim() === "" ? null : Number(price),
          costPrice: costPrice.trim() === "" ? null : Number(costPrice),
        })
      : await createVariant(productId, {
          name,
          sku: sku.trim() || null,
          price: price.trim() === "" ? null : Number(price),
          costPrice: costPrice.trim() === "" ? null : Number(costPrice),
          stock: Number(stock),
        })

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{variant ? "Editar variante" : "Nueva variante"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder='ej. "500ml", "Talle M", "Única"' />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">SKU (opcional)</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Precio (vacío = precio base)</label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Costo (vacío = costo base)</label>
              <Input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
          </div>
          {!variant && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Stock inicial</label>
              <Input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          )}
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando…" : variant ? "Guardar cambios" : "Crear variante"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
