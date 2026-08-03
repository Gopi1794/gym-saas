-- supabase/migrations/20260801_notify_check_in_daily_digest.sql
-- notify_check_in() insertaba una fila por check-in (105 acumuladas, casi
-- todas del mismo socio) y solo notificaba a UN admin (limit 1, sin orden
-- garantizado). Pasa a mantener una única fila por (admin, día): se
-- reescribe con el conteo nuevo y read vuelve a false en cada check-in, y
-- notifica a todos los admins del gym.
--
-- "Día" = America/Argentina/Buenos_Aires, mismo criterio que lib/date-ar.ts
-- y /check-in (startOfTodayAR) — no existe zona horaria por gym en el
-- schema, toda la app asume Argentina.

create or replace function notify_check_in()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_name text;
  v_count       integer;
  v_today       text;
begin
  if NEW.gym_id is null then return NEW; end if;

  select full_name into v_member_name from profiles where id = NEW.user_id;

  v_today := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');

  -- Conteo en el momento, sobre check_ins — nunca un número guardado que se
  -- incrementa (dos check-ins simultáneos podrían pisarse).
  select count(*) into v_count
    from check_ins
   where gym_id = NEW.gym_id
     and (checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
       = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    'check_in',
    'Check-ins de hoy',
    v_count::text || ' check-in' || (case when v_count = 1 then '' else 's' end) || ' hoy',
    jsonb_build_object('gym_id', NEW.gym_id, 'check_in_count', v_count, 'last_member_name', v_member_name),
    'check_in_daily:' || admin.id::text || ':' || v_today
  from profiles admin
  where admin.gym_id = NEW.gym_id
    and admin.role = 'admin'
  on conflict (user_id, dedup_key) where dedup_key is not null
  do update set
    body     = excluded.body,
    metadata = excluded.metadata,
    read     = false;

  return NEW;
end;
$$;
