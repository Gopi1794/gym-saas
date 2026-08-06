-- Extiende extend_member_membership para que también la pueda usar el
-- flujo de cobro manual (efectivo / MercadoPago cargado a mano por staff),
-- no solo el webhook automático de MercadoPago.
--
-- p_method, p_recorded_by y p_notes son parámetros nuevos CON DEFAULT al
-- final de la firma. El webhook (app/api/mp/webhook/route.ts) llama esta
-- función con parámetros nombrados, así que agregar parámetros opcionales
-- al final no le cambia nada: le siguen quedando method='mercadopago' y
-- recorded_by=null exactamente como antes.
--
-- También se agrega una validación que la función original no tenía: que
-- el member realmente pertenezca al gym pasado. Con un único caller (el
-- webhook, que deriva ambos valores de un external_reference firmado por
-- MP) esto era inofensivo; con un segundo caller de un modelo de confianza
-- distinto (un trainer autorizado, no MercadoPago) conviene que la función
-- se defienda sola en vez de confiar ciegamente en el caller.
--
-- returns timestamptz en vez de void: para poder mostrarle al staff la
-- fecha de vencimiento resultante sin recalcularla en el cliente. El
-- webhook no usa el valor de retorno hoy, así que tampoco lo afecta.
--
-- IMPORTANTE: agregar parámetros nuevos NO hace que CREATE OR REPLACE
-- reemplace la función de 6 parámetros — Postgres identifica una función
-- por su lista de tipos de parámetros, así que esto crearía un overload
-- nuevo de 9 parámetros y dejaría la vieja de 6 huérfana pero activa. Con
-- las dos vivas, una llamada con exactamente 6 parámetros nombrados (como
-- hace el webhook) resolvería a la vieja, sin el guard de gym nuevo. Hay
-- que borrar la vieja explícitamente antes de crear la nueva — mismo bug
-- que causó que complete_workout_session tuviera un overload sin uso
-- ejecutable por anon (arreglado hoy en
-- 20260806_harden_complete_workout_session.sql).

drop function if exists extend_member_membership(uuid, uuid, text, numeric, text, integer);

create or replace function extend_member_membership(
  p_member_id       uuid,
  p_gym_id          uuid,
  p_payment_id      text,
  p_amount          numeric,
  p_membership_type text,
  p_duration_days   int,
  p_method          text default 'mercadopago',
  p_recorded_by     uuid default null,
  p_notes           text default null
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_current_expires timestamptz;
  v_base timestamptz;
  v_new_expires timestamptz;
begin
  if not exists (
    select 1 from profiles where id = p_member_id and gym_id = p_gym_id
  ) then
    raise exception 'member % not found in gym %', p_member_id, p_gym_id;
  end if;

  select membership_expires_at into v_current_expires
  from profiles where id = p_member_id;

  v_base := case
    when v_current_expires is null or v_current_expires < now() then now()
    else v_current_expires
  end;

  v_new_expires := v_base + (p_duration_days || ' days')::interval;

  update profiles
  set
    membership_expires_at = v_new_expires,
    membership_type = p_membership_type
  where id = p_member_id;

  insert into payments (gym_id, member_id, amount, status, method, mp_payment_id, recorded_by, notes)
  values (p_gym_id, p_member_id, p_amount, 'approved', p_method, p_payment_id, p_recorded_by, p_notes);

  return v_new_expires;
end;
$$;

-- Es un objeto de función nuevo (firma distinta a la que se borró arriba),
-- así que no hereda los grants de la vieja — hay que fijarlos de cero.
revoke all on function extend_member_membership(uuid, uuid, text, numeric, text, integer, text, uuid, text)
  from public, anon, authenticated;
grant execute on function extend_member_membership(uuid, uuid, text, numeric, text, integer, text, uuid, text)
  to service_role;
