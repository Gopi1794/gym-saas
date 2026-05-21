-- Each user picks what hour they want their expiry notification (0–23, Argentina time)
alter table profiles
  add column if not exists notification_hour integer not null default 7
  check (notification_hour between 0 and 23);

-- Updated function: filters by each member's preferred notification hour
create or replace function notify_expiring_memberships()
returns void language plpgsql security definer as $$
declare
  v_today        text    := to_char(current_date, 'YYYY-MM-DD');
  v_current_hour integer := extract(
    hour from now() at time zone 'America/Argentina/Buenos_Aires'
  )::integer;
begin
  -- Notify member when current hour matches their notification_hour
  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    p.id,
    'membership_expiring',
    'Membresía por vencer',
    'Tu membresía vence el ' || to_char(p.membership_expires_at, 'DD/MM/YYYY'),
    jsonb_build_object('expires_at', p.membership_expires_at),
    'expiry:member:' || p.id::text || ':' || v_today
  from profiles p
  where p.membership_expires_at::date = current_date + interval '3 days'
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
    'expiry:admin:' || admin.id::text || ':member:' || m.id::text || ':' || v_today
  from profiles m
  join profiles admin on admin.gym_id = m.gym_id and admin.role = 'admin'
  where m.membership_expires_at::date = current_date + interval '3 days'
    and m.membership_expires_at is not null
    and m.role = 'member'
    and m.notification_hour = v_current_hour
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;

-- Switch cron to run every hour instead of once a day
select cron.unschedule('notify-expiring-memberships');
select cron.schedule(
  'notify-expiring-memberships',
  '0 * * * *',
  $$ select notify_expiring_memberships() $$
);
