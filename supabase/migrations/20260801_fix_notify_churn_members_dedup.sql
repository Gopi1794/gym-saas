-- supabase/migrations/20260801_fix_notify_churn_members_dedup.sql
-- El dedup_key incluía la fecha (v_today), así que cambiaba todos los días y
-- el ON CONFLICT nunca encontraba una fila previa: un socio en rojo 40 días
-- generaba 40 notificaciones idénticas al mismo admin.
--
-- Dos cambios sobre la función original (20260523_notify_churn.sql):
-- 1. dedup_key sin fecha, atado a (admin_id, member_id) — una notificación
--    por socio en riesgo mientras siga en riesgo, no una por corrida.
-- 2. Antes de insertar, borra las notificaciones de churn de pares
--    (admin, socio) que ya no están en rojo — si no, la notificación vieja
--    queda diciendo que el socio sigue en riesgo cuando ya no es cierto.

create or replace function notify_churn_members()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Resuelto: el socio volvió, renovó, o dejó de estar en rojo por lo que
  -- sea — la notificación vieja ya no aplica.
  delete from notifications n
  where n.type = 'churn_alert'
    and not exists (
      select 1
      from member_churn_status cs
      join profiles admin
        on admin.gym_id = cs.gym_id
       and admin.role = 'admin'
      where cs.churn_status = 'red'
        and cs.gym_id is not null
        and admin.id = n.user_id
        and cs.id::text = n.metadata->>'member_id'
    );

  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    'churn_alert',
    'Miembro en riesgo de abandono',
    coalesce(cs.full_name, 'Un miembro') || ' no asiste o tiene la membresía por vencer',
    jsonb_build_object(
      'member_id',   cs.id,
      'member_name', cs.full_name,
      'churn_status', cs.churn_status,
      'last_check_in', cs.last_check_in,
      'membership_expires_at', cs.membership_expires_at
    ),
    'churn:' || admin.id::text || ':' || cs.id::text
  from member_churn_status cs
  join profiles admin
    on admin.gym_id = cs.gym_id
   and admin.role = 'admin'
  where cs.churn_status = 'red'
    and cs.gym_id is not null
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;
