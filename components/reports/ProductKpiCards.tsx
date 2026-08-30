import { PackageCheck, TrendingUp, WalletCards, Warehouse, type LucideIcon } from "lucide-react"
import type { ProductOrderReport, ProductPaymentMethod } from "@/lib/products"

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

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "brand",
}: {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  accent?: "brand" | "emerald" | "amber" | "sky"
}) {
  const accents = {
    brand: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-zinc-950/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl border ${accents[accent]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">{hint}</p>
    </article>
  )
}

export default function ProductKpiCards({ report }: { report: ProductOrderReport }) {
  const paymentEntries = Object.entries(report.byMethod)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
  const methodMax = Math.max(...paymentEntries.map(([, amount]) => amount), 1)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Comercio</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">Productos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Órdenes pagas separadas de las membresías.</p>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">{report.paidOrders} órdenes pagas</span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Ingresos" value={formatARS(report.revenue)} hint="solo órdenes aprobadas" icon={WalletCards} />
        <KpiCard label="Margen" value={`${report.marginPercentage}%`} hint={formatARS(report.margin)} icon={TrendingUp} accent="emerald" />
        <KpiCard label="Ticket promedio" value={formatARS(report.averageOrderValue)} hint={`${report.units} unidades vendidas`} icon={PackageCheck} accent="sky" />
        <KpiCard label="Stock bajo" value={report.lowStock.length} hint="variantes con 5 o menos" icon={Warehouse} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-zinc-950/70">
          <h3 className="text-sm font-bold text-foreground">Top productos</h3>
          <div className="mt-4 space-y-3">
            {report.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas todavía.</p> : report.topProducts.slice(0, 5).map((product, index) => (
              <div key={product.productId} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-xs font-black text-brand-600 dark:text-brand-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{product.productName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{product.units} u. · {formatARS(product.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-zinc-950/70">
          <h3 className="text-sm font-bold text-foreground">Métodos de pago</h3>
          <div className="mt-4 space-y-3">
            {paymentEntries.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas todavía.</p> : paymentEntries.map(([method, amount]) => (
              <div key={method}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">{METHOD_LABELS[method as ProductPaymentMethod]}</span>
                  <span className="text-muted-foreground">{formatARS(amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max((amount / methodMax) * 100, 4)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-zinc-950/70">
          <h3 className="text-sm font-bold text-foreground">Vendedores</h3>
          <div className="mt-4 space-y-3">
            {report.bySeller.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas todavía.</p> : report.bySeller.slice(0, 5).map((seller) => (
              <div key={seller.sellerId ?? "unknown"} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{seller.sellerName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{seller.units} unidades</p>
                </div>
                <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{formatARS(seller.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {report.lowStock.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Stock bajo</h3>
              <p className="mt-1 text-xs text-muted-foreground">Priorizá reposición antes de que se agoten.</p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">{report.lowStock.length}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.lowStock.slice(0, 9).map((item) => (
              <div key={item.variantId} className="rounded-xl border border-amber-500/15 bg-card/80 px-3 py-2.5">
                <p className="truncate text-sm font-medium text-foreground">{item.productName} — {item.variantName}</p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Stock: {item.stock}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
