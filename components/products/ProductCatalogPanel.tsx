"use client"

import { useState } from "react"
import { Plus, PackagePlus, Pencil, EyeOff, Eye, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { toggleProductActive, toggleVariantActive, type Product } from "@/app/actions/products"
import type { MemberProduct } from "@/lib/products"
import ProductFormDialog from "./ProductFormDialog"
import VariantFormDialog from "./VariantFormDialog"
import RestockDialog from "./RestockDialog"

const CATEGORY_LABELS: Record<string, string> = {
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  indumentaria: "Indumentaria",
  accesorios: "Accesorios",
  otro: "Otro",
}

type CatalogProduct = Product | MemberProduct

export default function ProductCatalogPanel({ products, isAdmin }: { products: CatalogProduct[]; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleToggleProduct(productId: string, nextActive: boolean) {
    setBusyId(productId)
    setToggleError(null)
    const result = await toggleProductActive(productId, nextActive)
    setBusyId(null)
    if (result.error) setToggleError(result.error)
  }

  async function handleToggleVariant(variantId: string, nextActive: boolean) {
    setBusyId(variantId)
    setToggleError(null)
    const result = await toggleVariantActive(variantId, nextActive)
    setBusyId(null)
    if (result.error) setToggleError(result.error)
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <ProductFormDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
            }
          />
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay productos cargados{isAdmin ? " — creá el primero arriba." : "."}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <button
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[product.category]} · ${Number(product.base_price).toLocaleString("es-AR")}
                      {"is_active" in product && !product.is_active && " · Desactivado"}
                    </p>
                  </div>
                </div>
              </button>

              {expanded === product.id && (
                <div className="space-y-2 border-t border-border pt-3">
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <ProductFormDialog
                        product={product as Product}
                        trigger={<Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar producto</Button>}
                      />
                      <VariantFormDialog
                        productId={product.id}
                        trigger={<Button size="sm" variant="outline"><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Nueva variante</Button>}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === product.id}
                        onClick={() => handleToggleProduct(product.id, !(product as Product).is_active)}
                      >
                        {(product as Product).is_active
                          ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Desactivar</>
                          : <><Eye className="mr-1.5 h-3.5 w-3.5" />Reactivar</>}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {product.product_variants.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Sin variantes — agregá una para poder vender este producto.
                      </p>
                    ) : (
                      product.product_variants.map((variant) => (
                        <div key={variant.id} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                          <div>
                            <p className="text-sm text-foreground">{variant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Stock: {variant.stock}
                              {"is_active" in variant && !variant.is_active && " · Desactivada"}
                            </p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1.5">
                              <RestockDialog
                                variantId={variant.id}
                                variantName={variant.name}
                                trigger={<Button size="sm" variant="ghost">Reponer</Button>}
                              />
                              <VariantFormDialog
                                productId={product.id}
                                variant={variant as Product["product_variants"][number]}
                                trigger={<Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === variant.id}
                                onClick={() => handleToggleVariant(variant.id, !(variant as Product["product_variants"][number]).is_active)}
                              >
                                {(variant as Product["product_variants"][number]).is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toggleError && <Alert variant="error">{toggleError}</Alert>}
    </div>
  )
}
