"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createProduct, updateProduct, type Product, type ProductCategory } from "@/app/actions/products"

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  indumentaria: "Indumentaria",
  accesorios: "Accesorios",
  otro: "Otro",
}

interface Props {
  product?: Product
  trigger: React.ReactNode
}

export default function ProductFormDialog({ product, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "otro")
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""))
  const [baseCost, setBaseCost] = useState(String(product?.base_cost ?? ""))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const input = {
      name,
      description: description.trim() || null,
      category,
      basePrice: Number(basePrice),
      baseCost: Number(baseCost),
    }

    const result = product
      ? await updateProduct(product.id, input)
      : await createProduct(input)

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
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ej. Whey Protein" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Categoría *</label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Precio base *</label>
              <Input type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Costo base *</label>
              <Input type="number" min="0" step="0.01" value={baseCost} onChange={(e) => setBaseCost(e.target.value)} required />
            </div>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
