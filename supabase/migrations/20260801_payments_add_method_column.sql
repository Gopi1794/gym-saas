-- supabase/migrations/20260801_payments_add_method_column.sql
-- payments.status mezclaba estado ('pending'/'approved'/'rejected'/
-- 'cancelled'/'refunded') con método de pago ('cash', agregado en
-- 20260525_payment_status_cash.sql). Consecuencia real: todo cálculo que
-- filtra por status='approved' (dashboard, reports) excluía los pagos en
-- efectivo en silencio.
--
-- Se agrega method como columna separada. 'cash' se deja como valor vivo
-- pero sin uso en el enum payment_status — Postgres no tiene DROP VALUE
-- para enums, sacarlo requeriría recrear el tipo entero (crear tipo nuevo,
-- migrar la columna, borrar el viejo), un riesgo mayor para resolver algo
-- cosmético. Ningún código vuelve a escribir status='cash' después de esta
-- migración.

alter table payments
  add column method text not null default 'mercadopago'
  check (method in ('mercadopago', 'cash'));

-- Filas existentes con status='cash': pasan a approved (es lo que siempre
-- fueron, un pago ya cobrado) + method='cash'. El where evalúa contra el
-- status previo a esta misma sentencia, así que es seguro hacerlo en un
-- solo update.
update payments
set status = 'approved', method = 'cash'
where status = 'cash';
