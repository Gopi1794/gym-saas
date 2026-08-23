-- Registra un pago rechazado o cancelado. SECURITY DEFINER + solo
-- service_role porque el webhook llama con el cliente admin (no hay
-- usuario autenticado en el contexto de un webhook) — mismo patrón de
-- seguridad ya auditado que usa extend_member_membership.
--
-- ON CONFLICT DO NOTHING, no DO UPDATE: rechazado/cancelado son estados
-- terminales, cada uno es la primera y única escritura para ese
-- mp_payment_id. Si MP reintenta la entrega del mismo webhook (puede
-- pasar si el servidor no respondió 200 a tiempo), el segundo insert se
-- ignora sin error — no hay nada que actualizar.
create or replace function record_failed_mp_payment(
  p_member_id     uuid,
  p_gym_id        uuid,
  p_amount        numeric,
  p_status        payment_status,
  p_mp_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payments (gym_id, member_id, amount, status, method, mp_payment_id)
  values (p_gym_id, p_member_id, p_amount, p_status, 'mercadopago', p_mp_payment_id)
  on conflict (mp_payment_id) where mp_payment_id is not null do nothing;
end;
$$;

revoke all on function record_failed_mp_payment(uuid, uuid, numeric, payment_status, text) from public, anon, authenticated;
grant execute on function record_failed_mp_payment(uuid, uuid, numeric, payment_status, text) to service_role;
