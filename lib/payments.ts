// Estado real del pago. 'cash' NO es un estado, es un método de pago — ver
// PaymentMethod más abajo. El enum de Postgres (payment_status) todavía
// tiene 'cash' como valor histórico: no se puede sacar un valor de un enum
// sin recrear el tipo entero, así que se deja sin uso en vez de forzar esa
// migración. Ningún código escribe status='cash' desde
// 20260801_payments_add_method_column.sql.
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded"

export type PaymentMethod = "mercadopago" | "cash"

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:   "Pendiente",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  cancelled: "Cancelado",
  refunded:  "Reembolsado",
}

export const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  pending:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected:  "bg-red-500/15 text-red-600 dark:text-red-400",
  cancelled: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
  refunded:  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mercadopago: "MercadoPago",
  cash:        "Efectivo",
}

export const PAYMENT_METHOD_CLASSES: Record<PaymentMethod, string> = {
  mercadopago: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  cash:        "bg-violet-500/15 text-violet-600 dark:text-violet-400",
}
