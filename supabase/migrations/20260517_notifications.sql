-- ============================================================
-- notifications migration
-- Tabla + triggers para todos los eventos del gym
-- ============================================================

-- 1. Tabla principal -------------------------------------------------
create table notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null check (type in (
                'new_member', 'check_in', 'achievement',
                'plan_assigned', 'membership_expiring')),
  title       text        not null,
  body        text        not null,
  read        boolean     not null default false,
  metadata    jsonb       not null default '{}',
  -- dedup_key evita duplicados para notificaciones idempotentes (ej: expiry)
  dedup_key   text,
  created_at  timestamptz not null default now()
);

-- índice parcial para dedup (solo aplica cuando dedup_key no es null)
create unique index notifications_dedup_idx
  on notifications (user_id, dedup_key)
  where dedup_key is not null;

create index notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- 2. RLS ------------------------------------------------------------
alter table notifications enable row level security;

-- usuarios leen y actualizan solo las suyas
create policy "users select own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "users update own notifications"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Realtime -------------------------------------------------------
alter publication supabase_realtime add table notifications;

-- 4. Trigger: nuevo miembro ----------------------------------------
create or replace function notify_new_member()
returns trigger language plpgsql security definer as $$
declare
  v_admin_id uuid;
begin
  if NEW.role <> 'member' or NEW.gym_id is null then
    return NEW;
  end if;

  select id into v_admin_id
    from profiles
   where gym_id = NEW.gym_id and role = 'admin'
   limit 1;

  if v_admin_id is null then return NEW; end if;

  insert into notifications (user_id, type, title, body, metadata)
  values (
    v_admin_id,
    'new_member',
    'Nuevo miembro',
    coalesce(NEW.full_name, 'Un usuario') || ' se unió al gym',
    jsonb_build_object('member_id', NEW.id, 'member_name', NEW.full_name)
  );

  return NEW;
end;
$$;

-- dispara en INSERT cuando el miembro ya tiene gym_id
create trigger on_new_member_insert
  after insert on profiles
  for each row
  when (NEW.role = 'member' and NEW.gym_id is not null)
  execute function notify_new_member();

-- dispara en UPDATE cuando gym_id se asigna por primera vez
create trigger on_new_member_gym_set
  after update of gym_id on profiles
  for each row
  when (NEW.role = 'member' and NEW.gym_id is not null and OLD.gym_id is null)
  execute function notify_new_member();

-- 5. Trigger: check-in ---------------------------------------------
create or replace function notify_check_in()
returns trigger language plpgsql security definer as $$
declare
  v_member   profiles%rowtype;
  v_admin_id uuid;
begin
  select * into v_member from profiles where id = NEW.user_id;

  if v_member.gym_id is null then return NEW; end if;

  select id into v_admin_id
    from profiles
   where gym_id = v_member.gym_id and role = 'admin'
   limit 1;

  if v_admin_id is null then return NEW; end if;

  insert into notifications (user_id, type, title, body, metadata)
  values (
    v_admin_id,
    'check_in',
    'Check-in registrado',
    coalesce(v_member.full_name, 'Un miembro') || ' hizo check-in',
    jsonb_build_object('member_id', NEW.user_id, 'check_in_id', NEW.id)
  );

  return NEW;
end;
$$;

create trigger on_check_in
  after insert on check_ins
  for each row
  execute function notify_check_in();

-- 6. Trigger: logro ganado -----------------------------------------
create or replace function notify_achievement_earned()
returns trigger language plpgsql security definer as $$
declare
  v_name text;
  v_icon text;
begin
  select name, icon into v_name, v_icon
    from achievements where id = NEW.achievement_id;

  insert into notifications (user_id, type, title, body, metadata)
  values (
    NEW.user_id,
    'achievement',
    '¡Logro desbloqueado!',
    'Ganaste: ' || coalesce(v_name, 'un nuevo logro'),
    jsonb_build_object('achievement_id', NEW.achievement_id, 'icon', v_icon)
  );

  return NEW;
end;
$$;

create trigger on_achievement_earned
  after insert on user_achievements
  for each row
  execute function notify_achievement_earned();

-- 7. Trigger: plan asignado ----------------------------------------
create or replace function notify_plan_assigned()
returns trigger language plpgsql security definer as $$
begin
  if NEW.assigned_to is null then return NEW; end if;
  -- en UPDATE, solo notificar si assigned_to cambió
  if TG_OP = 'UPDATE' and OLD.assigned_to is not distinct from NEW.assigned_to then
    return NEW;
  end if;

  insert into notifications (user_id, type, title, body, metadata)
  values (
    NEW.assigned_to,
    'plan_assigned',
    'Plan de entrenamiento asignado',
    'Te asignaron el plan "' || NEW.name || '"',
    jsonb_build_object('plan_id', NEW.id, 'plan_name', NEW.name)
  );

  return NEW;
end;
$$;

create trigger on_plan_assigned
  after insert or update of assigned_to on workout_plans
  for each row
  execute function notify_plan_assigned();

-- 8. Función on-demand: membresías por vencer ----------------------
-- Llamar diariamente (o en cada carga del dashboard).
-- Usa dedup_key para no generar duplicados el mismo día.
create or replace function notify_expiring_memberships()
returns void language plpgsql security definer as $$
declare
  v_today text := to_char(current_date, 'YYYY-MM-DD');
begin
  -- Notificar al miembro
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
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;

  -- Notificar al admin del gym
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
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;

grant execute on function notify_expiring_memberships() to authenticated;
