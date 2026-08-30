import Link from "next/link"
import { AlertTriangle, Package, ReceiptText, ShoppingBag, TrendingUp, WalletCards } from "lucide-react"
import type { ProductOrderReport } from "@/lib/products"

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

function CommerceMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "zinc",
}: {
  icon: typeof WalletCards
  label: string
  value: string | number
  hint: string
  tone?: "emerald" | "cyan" | "amber" | "rose" | "zinc"
}) {
  const tones = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-500",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    zinc: "border-border bg-muted/50 text-muted-foreground",
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <p className="truncate text-xl font-bold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export default function ProductCommerceKpi({ report }: { report: ProductOrderReport }) {
  const topProduct = report.topProducts[0]
  const stockTone = report.lowStock.length > 0 ? "amber" : "emerald"

  return (
    <section className="space-y-3" aria-labelledby="product-commerce-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="product-commerce-heading" className="text-sm font-semibold text-foreground">Productos este mes</h2>
          <p className="text-xs text-muted-foreground">Ventas cobradas desde el primer dia del mes</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-brand-500 hover:underline">Ver reportes</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CommerceMetric icon={WalletCards} label="Facturacion" value={formatARS(report.revenue)} hint="cobrada" tone="emerald" />
        <CommerceMetric icon={TrendingUp} label="Margen" value={`${report.marginPercentage}%`} hint={formatARS(report.margin)} tone="cyan" />
        <CommerceMetric icon={ReceiptText} label="Ordenes pagas" value={report.paidOrders} hint="cobradas este mes" />
        <CommerceMetric icon={ShoppingBag} label="Ticket promedio" value={formatARS(report.averageOrderValue)} hint="por orden cobrada" />
        <CommerceMetric icon={Package} label="Producto top" value={topProduct?.productName ?? "Sin ventas"} hint={topProduct ? `${topProduct.units} unidades` : "todavia no hubo ventas"} />
        <CommerceMetric icon={AlertTriangle} label="Stock bajo" value={report.lowStock.length} hint={report.lowStock.length ? "variantes con 5 o menos" : "sin alertas"} tone={stockTone} />
      </div>
    </section>
  )
}
