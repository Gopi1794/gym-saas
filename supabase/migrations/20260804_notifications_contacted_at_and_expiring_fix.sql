-- supabase/migrations/20260804_notifications_contacted_at_and_expiring_fix.sql
--
-- 1. contacted_at: la notificación de vencimiento para el admin deja de ser
--    un aviso y pasa a ser una tarea pendiente ("hay que contactar a esta
--    persona"). Se cierra cuando el admin la gestiona (esta columna) o
--    cuando el socio renueva solo — nunca se borra, el historial sirve.
--
-- 2. Bug del DELETE de caso admin: borró notificaciones de socios que NO
--    habían renovado. La comparación era `(...)::timestamptz is distinct
--    from p.membership_expires_at` — a nivel de INSTANTE. Pero
--    membership_expires_at no representa un instante, representa un día
--    (mismo hallazgo que ya motivó daysUntilAR/formatDayAR esta semana).
--    MemberMembershipEdit.tsx guarda el vencimiento siempre como medianoche
--    UTC exacta; si el valor previo tenía otra hora (ej. una renovación
--    real vía Mercado Pago, que sale de now() + intervalo), CUALQUIER
--    re-guardado del admin — aunque no toque la fecha — corre el instante a
--    medianoche sin cambiar el día. IS DISTINCT FROM a nivel de instante
--    leía eso como "renovó" y borraba una notificación de alguien que
--    seguía debiendo.
--
--    Fix: se elimina el DELETE del caso admin — con contacted_at, "cerrar"
--    ya no es borrar la fila, es dejar de mostrarla como pendiente (ver
--    NotificationBell.tsx, que compara el día actual de
--    membership_expires_at contra el día que la notificación tenía
--    guardado). El caso socio conserva su DELETE (concepto distinto: el
--    socio no tiene una tarea, tiene su propio aviso) pero se corrige a la
--    misma comparación por día, porque tiene el mismo bug latente.

alter table notifications add column if not exists contacted_at timestamptz;

create or replace function notify_expiring_memberships()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today_ar     date    := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_current_hour integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::integer;
begin
  -- Caso socio: metadata solo tiene expires_at, el destinatario ES el
  -- socio. Comparación por día calendario, no por instante — un
  -- re-guardado que no cambia el día no debe borrar el aviso.
  delete from notifications n
  where n.type = 'membership_expiring'
    and n.created_at > now() - interval '7 days'
    and not (n.metadata ? 'member_id')
    and n.metadata->>'expires_at' ~ '^\d{4}-\d{2}-\d{2}'
    and exists (
      select 1 from profiles p
      where p.id = n.user_id
        and (n.metadata->>'expires_at')::timestamptz::date is distinct from p.membership_expires_at::date
    );

  -- Caso admin: ya no se borra. Se convirtió en una tarea (contacted_at) —
  -- "cerrada" es un estado que se calcula al mostrarla, no algo que se
  -- borra de la tabla. Ver NotificationBell.tsx.

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
