-- Evita cargar el mismo comprobante de MercadoPago dos veces (una vez a
-- mano por staff con el número de operación, y otra vez cuando el webhook
-- automático procesa esa misma transacción). Parcial: los pagos en
-- efectivo y los manuales sin número de comprobante quedan con
-- mp_payment_id null, y null nunca choca contra null en un índice único.
--
-- Verificado antes de esta migración (2026-08-07, supabase db query --linked):
-- 0 filas con mp_payment_id duplicado en la base real.
create unique index if not exists payments_mp_payment_id_uidx
  on payments(mp_payment_id) where mp_payment_id is not null;
