"use client"

import { useState, useTransition } from "react"
import { reserveProductPromotion } from "@/app/actions/products"
import type { MemberProductPromotion } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

export default function ProductPromotionsCarousel({ promotions }: { promotions: MemberProductPromotion[] }) {
  const [active, setActive] = useState(0)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  if (promotions.length === 0) return null

  const promotion = promotions[Math.min(active, promotions.length - 1)]

  function handleReserve() {
    startTransition(async () => {
      const result = await reserveProductPromotion(promotion.id)
      setFeedback(result.error ? { kind: "error", msg: result.error } : { kind: "success", msg: "Reserva creada por 30 minutos" })
    })
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-500/20 via-zinc-950 to-cyan-500/10 p-5 shadow-lg shadow-brand-950/20 transition-transform active:scale-[0.99]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-300">Promo del gym</p>
          <h2 className="font-display text-2xl leading-tight text-white">{promotion.title}</h2>
          {promotion.description && <p className="text-sm text-zinc-300">{promotion.description}</p>}
          <p className="text-xl font-semibold text-white">${promotion.price.toLocaleString("es-AR")}</p>
        </div>
        {promotion.image_url && <img src={promotion.image_url} alt="" className="h-24 w-24 rounded-2xl object-cover" />}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {promotions.map((item, index) => (
            <button key={item.id} type="button" aria-label={`Ver promoción ${index + 1}`} onClick={() => setActive(index)} className={`h-1.5 rounded-full transition-all ${index === active ? "w-6 bg-brand-300" : "w-2 bg-white/30"}`} />
          ))}
        </div>
        <Button type="button" size="sm" onClick={handleReserve} disabled={isPending}>{isPending ? "Reservando…" : (promotion.cta_label ?? "Reservar")}</Button>
      </div>
      {feedback && <div className="mt-3"><Alert variant={feedback.kind === "success" ? "success" : "error"}>{feedback.msg}</Alert></div>}
    </section>
  )
}
