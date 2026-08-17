"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { restockVariant } from "@/app/actions/products"

interface Props {
  variantId: string
  variantName: string
  trigger: React.ReactNode
}

export default function RestockDialog({ variantId, variantName, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState("")
  const [newCost, setNewCost] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await restockVariant(
      variantId,
      Number(quantity),
      newCost.trim() === "" ? null : Number(newCost)
    )

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setQuantity("")
      setNewCost("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reponer stock — {variantName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Cantidad a sumar *</label>
            <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Costo nuevo (opcional, si cambió)</label>
            <Input type="number" min="0" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Reponiendo…" : "Reponer stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
