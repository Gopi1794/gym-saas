"use client"

import { cancelProductReservation, type ProductSaleRow } from "@/app/actions/products"
import { formatInstantAR } from "@/lib/date-ar"
import type { ProductPaymentMethod } from "@/lib/products"

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

const METHOD_LABELS: Record<ProductPaymentMethod, string> = {
  cash: "Efectivo",
  mercadopago: "MercadoPago",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
}

const STATUS_LABELS: Record<ProductSaleRow["status"], string> = {
  paid: "Pagada",
  reserved: "Reservada",
  cancelled: "Cancelada",
  expired: "Expirada",
}

export default function ProductSalesPanel({ sales }: { sales: ProductSaleRow[] }) {
  async function cancelReservation(orderId: string) {
    await cancelProductReservation(orderId, "Cancelada desde historial de productos")
  }
  if (sales.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Todavía no hay ventas registradas.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Items</th>
            <th className="px-4 py-3 font-medium">Pago</th>
            <th className="px-4 py-3 font-medium">Monto</th>
            <th className="px-4 py-3 font-medium">Socio</th>
            <th className="px-4 py-3 font-medium">Vendedor</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b border-border last:border-0 align-top">
              <td className="px-4 py-3 text-muted-foreground">{formatInstantAR(sale.created_at)}</td>
              <td className="px-4 py-3 text-foreground">{STATUS_LABELS[sale.status]}</td>
              <td className="px-4 py-3 text-foreground">
                <div className="space-y-1">
                  {sale.product_order_items.map((item) => (
                    <div key={item.id}>
                      {item.products?.name ?? "—"} — {item.product_variants?.name ?? "—"}
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <div>{sale.payment_method ? METHOD_LABELS[sale.payment_method] : "—"}</div>
                {sale.payment_reference && <div className="text-xs">Ref: {sale.payment_reference}</div>}
              </td>
              <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatARS(sale.total_amount)}</td>
              <td className="px-4 py-3 text-muted-foreground">{sale.member_profile?.full_name ?? "Sin socio"}</td>
              <td className="px-4 py-3 text-muted-foreground">{sale.created_by_profile?.full_name ?? "—"}</td>
              <td className="px-4 py-3">
                {sale.status === "reserved" ? (
                  <button type="button" onClick={() => cancelReservation(sale.id)} className="text-xs font-medium text-red-500 transition-colors hover:text-red-400">
                    Cancelar reserva
                  </button>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

