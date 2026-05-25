-- Add churn_alert to the allowed notification types
alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check check (type in (
    'new_member', 'check_in', 'achievement',
    'plan_assigned', 'membership_expiring', 'churn_alert'
  ));

-- Function: notifica al admin por cada miembro actualmente en rojo.
-- Usa dedup_key diario para no spamear — el admin recibe máximo 1 alerta
-- por miembro en rojo por día.
create or replace function notify_churn_members()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today text := to_char(current_date, 'YYYY-MM-DD');
begin
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
    'churn:admin:' || admin.id::text || ':member:' || cs.id::text || ':' || v_today
  from member_churn_status cs
  join profiles admin
    on admin.gym_id = cs.gym_id
   and admin.role = 'admin'
  where cs.churn_status = 'red'
    and cs.gym_id is not null
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;

grant execute on function notify_churn_members() to authenticated;

-- Ejecutar diariamente a las 8 AM hora Argentina
select cron.schedule(
  'notify-churn-members',
  '0 11 * * *',  -- 11 UTC = 8 AM ART (UTC-3)
  $$ select notify_churn_members() $$
);
