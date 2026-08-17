"use client"

import type { ProductSaleRow } from "@/app/actions/products"
import { formatInstantAR } from "@/lib/date-ar"

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ProductSalesPanel({ sales }: { sales: ProductSaleRow[] }) {
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
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium">Cantidad</th>
            <th className="px-4 py-3 font-medium">Monto</th>
            <th className="px-4 py-3 font-medium">Socio</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-muted-foreground">{formatInstantAR(sale.created_at)}</td>
              <td className="px-4 py-3 text-foreground">
                {sale.product_variants
                  ? `${sale.product_variants.products?.name ?? "—"} — ${sale.product_variants.name}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-foreground">{sale.quantity}</td>
              <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                {formatARS(sale.total_amount)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{sale.profiles?.full_name ?? "Sin socio"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
