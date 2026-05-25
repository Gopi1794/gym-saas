create or replace view member_churn_status as
select
  p.id,
  p.gym_id,
  p.full_name,
  p.avatar_url,
  p.membership_type,
  p.membership_expires_at,
  max(ci.checked_in_at) as last_check_in,
  case
    -- Rojo: membresía vencida, próxima a vencer (<7 días), o sin asistir hace 1+ mes
    when p.membership_expires_at is null
      or p.membership_expires_at < now()
      or p.membership_expires_at < now() + interval '7 days'
      or max(ci.checked_in_at) < now() - interval '30 days'
      or max(ci.checked_in_at) is null
    then 'red'
    -- Amarillo: sin asistir hace 2+ semanas
    when max(ci.checked_in_at) < now() - interval '14 days'
    then 'yellow'
    -- Verde: todo en orden
    else 'green'
  end as churn_status
from profiles p
left join check_ins ci on ci.user_id = p.id
where p.role = 'member'
group by
  p.id, p.gym_id, p.full_name, p.avatar_url,
  p.membership_type, p.membership_expires_at;

-- Permitir que los usuarios autenticados consulten la vista
grant select on member_churn_status to authenticated;
