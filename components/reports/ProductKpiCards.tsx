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

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-black text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export default function ProductKpiCards({ report }: { report: ProductOrderReport }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Productos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Ingresos de productos separados de membresías</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Revenue productos" value={formatARS(report.revenue)} hint="solo órdenes pagas" />
        <KpiCard label="Margen" value={formatARS(report.margin)} hint="precio menos costo" />
        <KpiCard label="Unidades" value={report.units} hint="vendidas este período" />
        <KpiCard label="Stock bajo" value={report.lowStock.length} hint="variantes con 5 o menos" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top productos</h3>
          {report.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : report.topProducts.slice(0, 5).map((product) => (
            <div key={product.productId} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{product.productName}</span>
              <span className="text-muted-foreground">{product.units} u. · {formatARS(product.revenue)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Métodos de pago</h3>
          {Object.entries(report.byMethod).map(([method, amount]) => (
            <div key={method} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{METHOD_LABELS[method as ProductPaymentMethod]}</span>
              <span className="text-muted-foreground">{formatARS(amount)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Vendedores</h3>
          {report.bySeller.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : report.bySeller.slice(0, 5).map((seller) => (
            <div key={seller.sellerId ?? "unknown"} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{seller.sellerName}</span>
              <span className="text-muted-foreground">{seller.units} u. · {formatARS(seller.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {report.lowStock.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Stock bajo</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.lowStock.slice(0, 9).map((item) => (
              <div key={item.variantId} className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{item.productName} — {item.variantName}</p>
                <p className="text-muted-foreground">Stock: {item.stock}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
