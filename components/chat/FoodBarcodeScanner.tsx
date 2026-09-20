"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, Loader2, ScanBarcode, X } from "lucide-react"
import { calculateProductConsumption, normalizeBarcode, type OpenFoodFactsProduct, type ProductMacros } from "@/lib/open-food-facts"

type MealMatch = {
  mealId: string | null
  mealName: string | null
}

type LookupResponse = {
  product: OpenFoodFactsProduct
  mealMatch: MealMatch
  attribution: { name: string; url: string }
}

export type ScannedProductResult = {
  product: OpenFoodFactsProduct
  quantity: number
  macros: ProductMacros
  mealMatch: MealMatch
}

type Props = {
  onClose: () => void
  onConfirm: (result: ScannedProductResult) => void
}

type ScannerState = "starting" | "scanning" | "loading" | "result" | "error"

const SCANNER_ELEMENT_ID = "food-barcode-scanner-camera"

export function FoodBarcodeScanner({ onClose, onConfirm }: Props) {
  const [state, setState] = useState<ScannerState>("starting")
  const [lookup, setLookup] = useState<LookupResponse | null>(null)
  const [quantity, setQuantity] = useState("100")
  const [manualBarcode, setManualBarcode] = useState("")
  const [error, setError] = useState("")
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void; isScanning: boolean } | null>(null)
  const processingRef = useRef(false)

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      // The scanner may already be stopping during unmount.
    }
  }, [])

  const lookupProduct = useCallback(async (rawBarcode: string) => {
    const barcode = normalizeBarcode(rawBarcode)
    if (!barcode) {
      setError("Ingresá un código de entre 8 y 14 dígitos.")
      setState("error")
      processingRef.current = false
      return
    }

    processingRef.current = true
    setError("")
    setState("loading")
    await stopCamera()

    try {
      const response = await fetch(`/api/food-products/${barcode}`)
      const data = await response.json() as LookupResponse | { error?: string }
      if (!response.ok || !("product" in data)) {
        throw new Error("error" in data ? data.error : "No pudimos consultar ese producto.")
      }

      setLookup(data)
      setQuantity(String(data.product.servingQuantity ?? 100))
      setState("result")
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "No pudimos consultar ese producto.")
      setState("error")
    } finally {
      processingRef.current = false
    }
  }, [stopCamera])

  const startCamera = useCallback(async () => {
    await stopCamera()
    setError("")
    setLookup(null)
    setState("starting")
    processingRef.current = false

    try {
      // When restarting from the result view, let React mount the camera
      // container before html5-qrcode looks it up by id.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (!processingRef.current) void lookupProduct(decodedText)
        },
        () => {},
      )
      setState("scanning")
    } catch {
      await stopCamera()
      setError("No pudimos abrir la cámara. Revisá el permiso o ingresá el código manualmente.")
      setState("error")
    }
  }, [lookupProduct, stopCamera])

  useEffect(() => {
    void startCamera()
    return () => { void stopCamera() }
  }, [startCamera, stopCamera])

  function close() {
    void stopCamera()
    onClose()
  }

  function confirmProduct() {
    if (!lookup) return
    const consumedQuantity = Number(quantity)
    try {
      const macros = calculateProductConsumption(lookup.product, consumedQuantity)
      onConfirm({ product: lookup.product, quantity: consumedQuantity, macros, mealMatch: lookup.mealMatch })
      close()
    } catch {
      setError("Ingresá una cantidad válida mayor que cero.")
    }
  }

  const parsedQuantity = Number(quantity)
  const previewMacros = lookup && Number.isFinite(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 10_000
    ? calculateProductConsumption(lookup.product, parsedQuantity)
    : null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Escanear producto">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <ScanBarcode className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Escanear producto</h2>
              <p className="text-xs text-zinc-500">Código de barras del envase</p>
            </div>
          </div>
          <button onClick={close} className="rounded-xl p-2 text-zinc-500 transition-[color,background-color,transform] duration-150 hover:bg-zinc-900 hover:text-white active:scale-[0.97]" aria-label="Cerrar escáner">
            <X className="h-4 w-4" />
          </button>
        </div>

        {(state === "starting" || state === "scanning" || state === "loading" || state === "error") && !lookup && (
          <div className="space-y-4 p-5">
            <div className="relative min-h-64 overflow-hidden rounded-2xl border border-zinc-800 bg-black">
              <div id={SCANNER_ELEMENT_ID} className="w-full" />
              {(state === "starting" || state === "loading") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                  <Loader2 className="h-7 w-7 animate-spin text-red-500" />
                  <p className="text-xs text-zinc-400">{state === "loading" ? "Buscando producto…" : "Iniciando cámara…"}</p>
                </div>
              )}
              {state === "scanning" && (
                <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
              )}
            </div>

            {error && (
              <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void lookupProduct(manualBarcode) }}>
              <input
                inputMode="numeric"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                placeholder="Ingresar código manualmente"
                className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm outline-none transition-colors focus:border-red-500"
              />
              <button className="rounded-xl bg-red-600 px-4 text-sm font-semibold transition-[background-color,transform] duration-150 hover:bg-red-500 active:scale-[0.97]" type="submit">
                Buscar
              </button>
            </form>

            {state === "error" && (
              <button onClick={() => void startCamera()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 py-2.5 text-sm text-zinc-300 transition-[background-color,transform] duration-150 hover:bg-zinc-900 active:scale-[0.97]">
                <Camera className="h-4 w-4" /> Reintentar cámara
              </button>
            )}
          </div>
        )}

        {state === "result" && lookup && (
          <div className="space-y-5 p-5">
            <div className="flex gap-4">
              {lookup.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lookup.product.imageUrl} alt="" className="h-24 w-24 rounded-2xl border border-zinc-800 bg-white object-contain" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-600">
                  <ScanBarcode className="h-8 w-8" />
                </div>
              )}
              <div className="min-w-0 flex-1 py-1">
                <p className="line-clamp-2 font-semibold text-white">{lookup.product.name}</p>
                {lookup.product.brand && <p className="mt-1 text-sm text-zinc-400">{lookup.product.brand}</p>}
                {lookup.product.quantityLabel && <p className="mt-1 text-xs text-zinc-500">Envase: {lookup.product.quantityLabel}</p>}
                <a href={lookup.attribution.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
                  Datos de Open Food Facts
                </a>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">¿Cuánto consumiste?</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-lg font-semibold outline-none transition-colors focus:border-red-500"
                />
                <span className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">g/ml</span>
              </div>
              {lookup.product.servingLabel && <p className="mt-2 text-xs text-zinc-500">Porción declarada: {lookup.product.servingLabel}</p>}
            </div>

            {previewMacros && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["kcal", previewMacros.calories],
                  ["Prot.", `${previewMacros.protein}g`],
                  ["Carbs", `${previewMacros.carbs}g`],
                  ["Grasas", `${previewMacros.fat}g`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-2 py-3 text-center">
                    <p className="text-sm font-bold text-white">{value}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-xs font-medium text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => void startCamera()} className="flex-1 rounded-xl border border-zinc-800 py-3 text-sm font-medium text-zinc-300 transition-[background-color,transform] duration-150 hover:bg-zinc-900 active:scale-[0.97]">
                Escanear otro
              </button>
              <button onClick={confirmProduct} disabled={!previewMacros} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-red-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40">
                Usar producto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
