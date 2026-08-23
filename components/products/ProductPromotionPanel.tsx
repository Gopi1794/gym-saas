"use client"

import { useState, useTransition } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteProductPromotion, upsertProductPromotion, type Product, type ProductPromotionRow } from "@/app/actions/products"
import { resolveVariantPrice } from "@/lib/products"

type Draft = {
  title: string
  description: string
  productId: string
  variantId: string
  publicPrice: string
  ctaLabel: string
  imageUrl: string
  startsAt: string
  endsAt: string
  sortOrder: string
  isActive: boolean
}

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  productId: "",
  variantId: "",
  publicPrice: "0",
  ctaLabel: "Reservar",
  imageUrl: "",
  startsAt: "",
  endsAt: "",
  sortOrder: "0",
  isActive: true,
}

export default function ProductPromotionPanel({ products, promotions }: { products: Product[]; promotions: ProductPromotionRow[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedProduct = products.find((product) => product.id === draft.productId) ?? null
  const variants = selectedProduct?.product_variants.filter((variant) => variant.is_active) ?? []

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function chooseVariant(variantId: string) {
    const variant = variants.find((item) => item.id === variantId)
    patch({ variantId, publicPrice: variant && selectedProduct ? String(resolveVariantPrice(selectedProduct, variant)) : draft.publicPrice })
  }

  function edit(promotion: ProductPromotionRow) {
    setEditingId(promotion.id)
    setDraft({
      title: promotion.title,
      description: promotion.description ?? "",
      productId: promotion.product_id ?? "",
      variantId: promotion.variant_id ?? "",
      publicPrice: String(promotion.public_price),
      ctaLabel: promotion.cta_label ?? "Reservar",
      imageUrl: promotion.image_url ?? "",
      startsAt: promotion.starts_at?.slice(0, 16) ?? "",
      endsAt: promotion.ends_at?.slice(0, 16) ?? "",
      sortOrder: String(promotion.sort_order),
      isActive: promotion.is_active,
    })
    setFeedback(null)
  }

  function reset() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const publicPrice = Number(draft.publicPrice)
    if (!Number.isFinite(publicPrice) || publicPrice < 0) {
      setFeedback({ kind: "error", msg: "El precio público no puede ser negativo" })
      return
    }

    startTransition(async () => {
      const result = await upsertProductPromotion({
        id: editingId ?? undefined,
        productId: draft.productId || null,
        variantId: draft.variantId || null,
        title: draft.title,
        description: draft.description || null,
        imageUrl: draft.imageUrl || null,
        publicPrice,
        ctaLabel: draft.ctaLabel || null,
        isActive: draft.isActive,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        sortOrder: Number(draft.sortOrder) || 0,
      })

      if (result.error) {
        setFeedback({ kind: "error", msg: result.error })
      } else {
        setFeedback({ kind: "success", msg: editingId ? "Promoción actualizada" : "Promoción creada" })
        reset()
      }
    })
  }

  function remove(promotionId: string) {
    startTransition(async () => {
      const result = await deleteProductPromotion(promotionId)
      setFeedback(result.error ? { kind: "error", msg: result.error } : { kind: "success", msg: "Promoción eliminada" })
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-xl text-foreground">Campañas activas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Publicá productos destacados sin exponer costos ni margen al socio.</p>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-muted/20">
          {promotions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Todavía no hay promociones.</p>
          ) : promotions.map((promotion) => (
            <div key={promotion.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{promotion.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${promotion.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                    {promotion.is_active ? "Activa" : "Pausada"}
                  </span>
                </div>
                <p className="text-muted-foreground">${promotion.public_price.toLocaleString("es-AR")} · orden {promotion.sort_order}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => edit(promotion)}>Editar</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(promotion.id)} disabled={isPending}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-heading text-lg text-foreground">{editingId ? "Editar promoción" : "Nueva promoción"}</h3>
        <Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Título" required />
        <Input value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Descripción breve" />
        <select value={draft.productId} onChange={(e) => patch({ productId: e.target.value, variantId: "" })} className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground">
          <option value="">Producto opcional</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <select value={draft.variantId} onChange={(e) => chooseVariant(e.target.value)} disabled={!selectedProduct} className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground disabled:opacity-50">
          <option value="">Variante opcional</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="0" step="0.01" value={draft.publicPrice} onChange={(e) => patch({ publicPrice: e.target.value })} placeholder="Precio público" required />
          <Input type="number" value={draft.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} placeholder="Orden" />
        </div>
        <Input value={draft.ctaLabel} onChange={(e) => patch({ ctaLabel: e.target.value })} placeholder="CTA" />
        <Input value={draft.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="URL de imagen" />
        <div className="grid grid-cols-2 gap-2">
          <Input type="datetime-local" value={draft.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
          <Input type="datetime-local" value={draft.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => patch({ isActive: e.target.checked })} />
          Publicada
        </label>
        {feedback && <Alert variant={feedback.kind === "success" ? "success" : "error"}>{feedback.msg}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Guardar"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={reset}>Cancelar</Button>}
        </div>
      </form>
    </div>
  )
}
