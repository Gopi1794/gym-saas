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

/**
 * Quién puede usar "Cobrar y renovar" — el permiso lo otorga el admin por
 * trainer (profiles.can_collect_payments), nunca es automático del rol.
 * Distinto de "Editar membresía" (admin-only sin excepción, ver
 * docs/superpowers/plans/2026-07-31-fix-profiles-column-privilege-updates.md).
 */
export function canCollectPayment(role: string, canCollectFlag: boolean): boolean {
  return role === "admin" || (role === "trainer" && canCollectFlag === true)
}

export type CollectiblePlan = {
  is_active: boolean
  price: number
}

/**
 * "Cobrar y renovar" nunca da de alta un plan gratuito — payments.amount
 * tiene check(amount > 0), así que un plan con price = 0 no puede generar
 * fila de pago. Esos siguen siendo admin-only vía "Editar membresía".
 */
export function isPlanCollectible<T extends CollectiblePlan>(plan: T | null | undefined): plan is T {
  return !!plan && plan.is_active && plan.price > 0
}

/**
 * Nº de operación de MercadoPago cargado a mano por staff: solo aplica al
 * método mercadopago, y string vacío/solo espacios se normaliza a null
 * (nunca ""), para no romper el índice único parcial en mp_payment_id ni
 * dejar filas con un valor vacío en vez de ausente.
 */
export function normalizeMpReference(
  method: PaymentMethod,
  raw: string | null | undefined,
): string | null {
  if (method !== "mercadopago") return null
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

/** Notas libres de un pago: string vacío o solo espacios se guarda como null. */
export function normalizePaymentNotes(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

/**
 * MercadoPago tiene más estados que nuestro enum de payments (pending,
 * in_process, authorized, in_mediation son variantes de "todavía no se
 * resolvió", y refunded/charged_back quedan fuera de alcance por ahora).
 * Colapsa todo lo no accionable a null — el caller no escribe nada ni
 * notifica nada para null, solo loguea y sigue: el webhook de seguimiento
 * de MP eventualmente va a mandar un estado accionable para el mismo pago.
 */
export function resolveActionableMpStatus(mpStatus: string): "approved" | "rejected" | "cancelled" | null {
  if (mpStatus === "approved") return "approved"
  if (mpStatus === "rejected") return "rejected"
  if (mpStatus === "cancelled") return "cancelled"
  return null
}
