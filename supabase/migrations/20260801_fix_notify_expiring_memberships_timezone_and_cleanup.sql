-- supabase/migrations/20260801_fix_notify_expiring_memberships_timezone_and_cleanup.sql
-- Dos problemas en notify_expiring_memberships (20260521_notification_hour.sql):
--
-- 1. Mezcla de zonas: v_today salía de current_date (sesión de Postgres,
--    UTC en Supabase) y v_current_hour de America/Argentina/Buenos_Aires.
--    Entre las 21:00 y 23:59 AR, UTC ya pasó al día siguiente, así que para
--    socios con notification_hour 21-23 la ventana de "vence en 3 días" se
--    evaluaba contra la fecha equivocada.
--
--    membership_expires_at::date se deja con cast plano a propósito: el
--    valor se guarda como medianoche UTC del día calendario elegido en el
--    formulario (MemberMembershipEdit.tsx, new Date("YYYY-MM-DD").toISOString()
--    interpreta el string como medianoche UTC) — un cast plano en sesión
--    UTC recupera exactamente ese día. Agregarle AT TIME ZONE ahí correría
--    la fecha un día para atrás (medianoche UTC del 18/08 = 21:00 del 17/08
--    en Argentina), un bug distinto y nuevo. El mix de zonas está del lado
--    de "qué día es hoy", no del lado del vencimiento guardado.
--
-- 2. Sin limpieza al renovar: la notificación de "vence el X" quedaba
--    diciendo eso después de que el socio renovara. Se agrega un DELETE por
--    cada una de las dos formas de notificación (socio: metadata solo tiene
--    expires_at; admin: metadata tiene member_id) que borra cuando la fecha
--    guardada ya no coincide con la actual — eso es la renovación. No toca
--    a los socios que vencieron sin renovar: ahí el valor no cambió.
--
-- Además, el dedup_key deja de llevar la fecha de hoy y pasa a llevar el
-- expires_at (mismo criterio que el fix de notify_churn_members): con la
-- fecha de hoy, si una fila se borra (descarte manual, o el DELETE nuevo) y
-- la condición de la fila vuelve a matchear en otra corrida, el ON CONFLICT
-- no encuentra nada que la bloquee y la reinserta — el mismo patrón que
-- causó los duplicados de churn, aunque acá la ventana de "= hoy + 3 días"
-- ya lo acota bastante en la práctica. Atado al expires_at, un descarte
-- queda descartado hasta que el socio renueve de verdad.

create or replace function notify_expiring_memberships()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today_ar     date    := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_current_hour integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::integer;
begin
  -- Caso socio: metadata solo tiene expires_at, el destinatario ES el socio.
  -- Acotado a los últimos 7 días para no escanear toda la tabla en cada
  -- corrida horaria. El chequeo con ~ antes del cast evita que una fila
  -- vieja con el campo en otro formato tire la función entera abajo (un
  -- ::timestamptz que falla aborta todo, y ese día no sale ninguna
  -- notificación).
  delete from notifications n
  where n.type = 'membership_expiring'
    and n.created_at > now() - interval '7 days'
    and not (n.metadata ? 'member_id')
    and n.metadata->>'expires_at' ~ '^\d{4}-\d{2}-\d{2}'
    and exists (
      select 1 from profiles p
      where p.id = n.user_id
        and (n.metadata->>'expires_at')::timestamptz is distinct from p.membership_expires_at
    );

  -- Caso admin: metadata tiene member_id, hay que buscar al socio por ahí.
  delete from notifications n
  where n.type = 'membership_expiring'
    and n.created_at > now() - interval '7 days'
    and n.metadata ? 'member_id'
    and n.metadata->>'expires_at' ~ '^\d{4}-\d{2}-\d{2}'
    and exists (
      select 1 from profiles p
      where p.id = (n.metadata->>'member_id')::uuid
        and (n.metadata->>'expires_at')::timestamptz is distinct from p.membership_expires_at
    );

  -- Notify member when current hour matches their notification_hour
  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    p.id,
    'membership_expiring',
    'Membresía por vencer',
    'Tu membresía vence el ' || to_char(p.membership_expires_at, 'DD/MM/YYYY'),
    jsonb_build_object('expires_at', p.membership_expires_at),
    'expiry:member:' || p.id::text || ':' || to_char(p.membership_expires_at, 'YYYY-MM-DD')
  from profiles p
  where p.membership_expires_at::date = v_today_ar + interval '3 days'
    and p.membership_expires_at is not null
    and p.role = 'member'
    and p.notification_hour = v_current_hour
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;

  -- Notify gym admin at the same time as the member
  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    'membership_expiring',
    'Membresía por vencer',
    coalesce(m.full_name, 'Un miembro') || ' vence el ' || to_char(m.membership_expires_at, 'DD/MM/YYYY'),
    jsonb_build_object('member_id', m.id, 'member_name', m.full_name, 'expires_at', m.membership_expires_at),
    'expiry:admin:' || admin.id::text || ':member:' || m.id::text || ':' || to_char(m.membership_expires_at, 'YYYY-MM-DD')
  from profiles m
  join profiles admin on admin.gym_id = m.gym_id and admin.role = 'admin'
  where m.membership_expires_at::date = v_today_ar + interval '3 days'
    and m.membership_expires_at is not null
    and m.role = 'member'
    and m.notification_hour = v_current_hour
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;
