-- Trazabilidad de pagos cargados a mano por staff (efectivo o MercadoPago
-- manual): quién lo cargó y una nota libre con cualquier dato relevante.
-- Ambas columnas quedan null para pagos automáticos del webhook de MP.

alter table payments add column recorded_by uuid references profiles(id) on delete set null;
alter table payments add column notes text;

-- Si recorded_by está seteado, tiene que ser staff del mismo gym que el
-- pago — reusa el índice único compuesto que ya existe desde
-- 20260524_harden_multi_tenant_schema.sql (profiles_id_gym_id_uidx).
-- NOT VALID: no escanea filas existentes (todas tienen recorded_by null
-- todavía), solo aplica a partir de ahora.
alter table payments add constraint payments_recorded_by_gym_fkey
  foreign key (recorded_by, gym_id) references profiles(id, gym_id) not valid;
