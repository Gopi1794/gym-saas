"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import {
  createProduct,
  replaceProductImagesFromStorage,
  updateProduct,
  type Product,
  type ProductCategory,
} from "@/app/actions/products"

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  indumentaria: "Indumentaria",
  accesorios: "Accesorios",
  otro: "Otro",
}

const MAX_IMAGES = 6
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [removeImages, setRemoveImages] = useState(false)
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""))
  const [baseCost, setBaseCost] = useState(String(product?.base_cost ?? ""))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existingImageCount = product?.product_images?.length ?? (product?.image_url ? 1 : 0)

  function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? [])
    if (selected.length > MAX_IMAGES) {
      setError(`Podés subir hasta ${MAX_IMAGES} imágenes por producto`)
      return
    }
    if (selected.some((file) => !(file.type in IMAGE_EXTENSIONS))) {
      setError("Solo se permiten imágenes JPG, PNG o WebP")
      return
    }
    if (selected.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setError("Cada imagen puede pesar hasta 5 MB")
      return
    }
    setError(null)
    setImageFiles(selected)
    if (selected.length > 0) setRemoveImages(false)
  }

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
    let productId: string
    let gymId: string
    if (product) {
      const result = await updateProduct(product.id, input)
      if ("error" in result) {
        setLoading(false)
        setError(result.error ?? "No se pudo actualizar el producto")
        return
      }
      productId = product.id
      gymId = product.gym_id
    } else {
      const result = await createProduct(input)
      if ("error" in result) {
        setLoading(false)
        setError(result.error ?? "No se pudo crear el producto")
        return
      }
      productId = result.id
      gymId = result.gymId
    }
    if (imageFiles.length > 0) {
      const uploadResult = await uploadProductImages(imageFiles, gymId, productId)
      if ("error" in uploadResult) {
        setLoading(false)
        setError(uploadResult.error ?? "No se pudieron subir las imágenes")
        return
      }

      const imageResult = await replaceProductImagesFromStorage(productId, uploadResult.paths)
      if (imageResult.error) {
        await createClient().storage.from("product-images").remove(uploadResult.paths)
        setLoading(false)
        setError(imageResult.error)
        return
      }
    } else if (removeImages) {
      const imageResult = await replaceProductImagesFromStorage(productId, [])
      if (imageResult.error) {
        setLoading(false)
        setError(imageResult.error)
        return
      }
    }

    setLoading(false)
    setOpen(false)
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
              className="w-full resize-none rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Imágenes del producto (opcional)</label>
            <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => handleFiles(e.target.files)} />
            <p className="text-xs text-muted-foreground">
              JPG, PNG o WebP; hasta {MAX_IMAGES} imágenes y 5 MB cada una.
              {product && " Si elegís archivos, reemplazan la galería actual."}
            </p>
            {imageFiles.length > 0 && <p className="text-xs text-foreground">{imageFiles.length} imagen{imageFiles.length === 1 ? "" : "es"} seleccionada{imageFiles.length === 1 ? "" : "s"}.</p>}
            {product && existingImageCount > 0 && imageFiles.length === 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={removeImages} onChange={(e) => setRemoveImages(e.target.checked)} />
                Eliminar las {existingImageCount} imágenes actuales
              </label>
            )}
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

async function uploadProductImages(files: File[], gymId: string, productId: string) {
  const supabase = createClient()
  const paths: string[] = []

  for (const file of files) {
    const extension = IMAGE_EXTENSIONS[file.type]
    const path = `${gymId}/${productId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      if (paths.length > 0) await supabase.storage.from("product-images").remove(paths)
      return { error: "No se pudo subir una imagen. Verificá el formato y el tamaño." }
    }
    paths.push(path)
  }

  return { paths }
}
