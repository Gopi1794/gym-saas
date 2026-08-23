-- Barrido periódico: cualquier payment_checkouts que siga 'pending' pasado
-- su vencimiento se marca 'expired' y notifica una sola vez al admin. Usa
-- UPDATE...RETURNING dentro de un CTE para notificar exactamente las filas
-- que transicionaron en ESTA corrida — no una ventana de tiempo relativa
-- (ej. "expiró en los últimos 20 min"), que sería frágil si el cron se
-- atrasa o el intervalo no calza exacto con la corrida anterior.
create or replace function expire_stale_payment_checkouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update payment_checkouts
    set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning id, gym_id, external_reference, kind
  )
  insert into notifications (user_id, gym_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    e.gym_id,
    'payment_checkout_expired',
    'Un cobro no se completó',
    'Un cliente no terminó de pagar por MercadoPago — el link de pago quedó sin usar.',
    jsonb_build_object('checkout_id', e.id, 'external_reference', e.external_reference, 'kind', e.kind),
    'checkout_expired:' || e.id::text
  from expired e
  join profiles admin on admin.gym_id = e.gym_id and admin.role = 'admin'
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;

grant execute on function expire_stale_payment_checkouts() to authenticated;

select cron.schedule(
  'expire-stale-payment-checkouts',
  '*/15 * * * *',
  $$ select expire_stale_payment_checkouts() $$
);
