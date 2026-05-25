-- Harden tenant boundaries and common integrity rules.
--
-- This migration intentionally keeps existing columns such as
-- workout_plans.assigned_to for backwards compatibility, but makes gym ownership
-- explicit instead of inferring it through created_by -> profiles.gym_id.

-- ---------------------------------------------------------------------------
-- Explicit tenant ownership
-- ---------------------------------------------------------------------------

alter table public.workout_plans
  add column if not exists gym_id uuid references public.gyms(id);

update public.workout_plans wp
set gym_id = p.gym_id
from public.profiles p
where wp.gym_id is null
  and wp.created_by = p.id;

update public.workout_plans wp
set gym_id = p.gym_id
from public.profiles p
where wp.gym_id is null
  and wp.assigned_to = p.id;

-- Legacy fallback:
-- Some old plans may have neither created_by nor assigned_to tied to a profile
-- with gym_id. If this database has exactly one gym, the safe inference is that
-- those legacy plans belong to that gym. If there are multiple gyms, we refuse
-- to guess because that would break tenant isolation.
update public.workout_plans wp
set gym_id = only_gym.id
from (
  select id
  from public.gyms
  where (select count(*) from public.gyms) = 1
  limit 1
) only_gym
where wp.gym_id is null;

do $$
begin
  if exists (
    select 1
    from public.workout_plans
    where gym_id is null
  ) then
    raise exception
      'Cannot make workout_plans.gym_id required: some plans have no inferable gym_id and there is not exactly one gym to use as fallback. Assign gym_id manually before re-running this migration.';
  end if;
end $$;

alter table public.workout_plans
  alter column gym_id set not null;

alter table public.client_plans
  add column if not exists gym_id uuid references public.gyms(id);

update public.client_plans cp
set gym_id = coalesce(wp.gym_id, client_p.gym_id)
from public.workout_plans wp,
     public.profiles client_p
where cp.gym_id is null
  and wp.id = cp.plan_id
  and client_p.id = cp.client_id;

alter table public.client_plans
  alter column gym_id set not null;

alter table public.workout_sessions
  add column if not exists gym_id uuid references public.gyms(id);

update public.workout_sessions ws
set gym_id = wp.gym_id
from public.workout_plans wp
where ws.gym_id is null
  and wp.id = ws.plan_id;

update public.workout_sessions ws
set gym_id = p.gym_id
from public.profiles p
where ws.gym_id is null
  and p.id = ws.user_id;

alter table public.workout_sessions
  alter column gym_id set not null;

alter table public.notifications
  add column if not exists gym_id uuid references public.gyms(id);

update public.notifications n
set gym_id = p.gym_id
from public.profiles p
where n.gym_id is null
  and p.id = n.user_id;

create or replace function public.set_notification_gym_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.gym_id is null then
    select p.gym_id
    into NEW.gym_id
    from public.profiles p
    where p.id = NEW.user_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists set_notification_gym_id_before_insert on public.notifications;
create trigger set_notification_gym_id_before_insert
  before insert on public.notifications
  for each row
  execute function public.set_notification_gym_id();

-- ---------------------------------------------------------------------------
-- Tenant consistency checks
-- ---------------------------------------------------------------------------

-- PostgreSQL CHECK constraints cannot contain subqueries. Use composite FKs
-- instead: they make the tenant boundary explicit and enforce same-gym rows.
create unique index if not exists profiles_id_gym_id_uidx
  on public.profiles(id, gym_id);

create unique index if not exists workout_plans_id_gym_id_uidx
  on public.workout_plans(id, gym_id);

alter table public.workout_plans
  drop constraint if exists workout_plans_created_by_gym_fkey,
  add constraint workout_plans_created_by_gym_fkey
  foreign key (created_by, gym_id)
  references public.profiles(id, gym_id)
  not valid;

alter table public.workout_plans
  drop constraint if exists workout_plans_assigned_to_gym_fkey,
  add constraint workout_plans_assigned_to_gym_fkey
  foreign key (assigned_to, gym_id)
  references public.profiles(id, gym_id)
  not valid;

alter table public.client_plans
  drop constraint if exists client_plans_client_gym_fkey,
  add constraint client_plans_client_gym_fkey
  foreign key (client_id, gym_id)
  references public.profiles(id, gym_id)
  not valid;

alter table public.client_plans
  drop constraint if exists client_plans_plan_gym_fkey,
  add constraint client_plans_plan_gym_fkey
  foreign key (plan_id, gym_id)
  references public.workout_plans(id, gym_id)
  not valid;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_user_gym_fkey,
  add constraint workout_sessions_user_gym_fkey
  foreign key (user_id, gym_id)
  references public.profiles(id, gym_id)
  not valid;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_plan_gym_fkey,
  add constraint workout_sessions_plan_gym_fkey
  foreign key (plan_id, gym_id)
  references public.workout_plans(id, gym_id)
  not valid;

-- ---------------------------------------------------------------------------
-- Uniqueness and integrity rules
-- ---------------------------------------------------------------------------

create unique index if not exists user_achievements_user_achievement_uidx
  on public.user_achievements(user_id, achievement_id);

create unique index if not exists exercise_favorites_user_exercise_uidx
  on public.exercise_favorites(user_id, exercise_id);

create unique index if not exists workout_plan_days_plan_day_uidx
  on public.workout_plan_days(plan_id, day_of_week);

create unique index if not exists workout_plan_exercises_day_order_uidx
  on public.workout_plan_exercises(day_id, order_index);

create unique index if not exists client_plans_active_plan_client_uidx
  on public.client_plans(plan_id, client_id)
  where active is true;

create unique index if not exists check_ins_one_open_per_user_gym_uidx
  on public.check_ins(user_id, gym_id)
  where checked_out_at is null;

create unique index if not exists notifications_user_dedup_uidx
  on public.notifications(user_id, dedup_key)
  where dedup_key is not null;

-- Common tenant/query indexes.
create index if not exists workout_plans_gym_id_idx on public.workout_plans(gym_id);
create index if not exists client_plans_gym_id_idx on public.client_plans(gym_id);
create index if not exists workout_sessions_gym_id_idx on public.workout_sessions(gym_id);
create index if not exists notifications_gym_id_idx on public.notifications(gym_id);
create index if not exists profiles_gym_id_role_idx on public.profiles(gym_id, role);

-- ---------------------------------------------------------------------------
-- RLS policy fix for admin plan reads
-- ---------------------------------------------------------------------------

drop policy if exists "admins can read plans in their gym" on public.workout_plans;

create policy "admins can read plans in their gym"
  on public.workout_plans for select
  using (
    exists (
      select 1
      from public.profiles admin_p
      where admin_p.id = auth.uid()
        and admin_p.role = 'admin'
        and admin_p.gym_id = workout_plans.gym_id
    )
  );

-- ---------------------------------------------------------------------------
-- RPC fix: workout_sessions.gym_id is now required
-- ---------------------------------------------------------------------------

create or replace function public.complete_workout_session(
  p_plan_id         uuid,
  p_day_of_week     integer,
  p_day_name        text,
  p_exercises_count integer,
  p_rest_skips      integer,
  p_sets            jsonb default '[]'
)
returns table (
  session_id          uuid,
  xp_earned           integer,
  new_total_xp        integer,
  earned_achievements jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_gym_id     uuid;
  v_session_id uuid;
  v_quality    numeric;
  v_xp         integer;
  v_total_xp   integer;
  v_rest_skips integer := greatest(coalesce(p_rest_skips, 0), 0);
  v_earned     jsonb;
begin
  if v_user_id is null then
    raise exception 'auth.uid() is null';
  end if;

  select gym_id into v_gym_id
  from public.profiles
  where id = v_user_id;

  if v_gym_id is null then
    raise exception 'user has no gym_id';
  end if;

  if not exists (
    select 1
    from public.workout_plans wp
    where wp.id = p_plan_id
      and wp.gym_id = v_gym_id
      and wp.assigned_to = v_user_id
  ) then
    raise exception 'plan does not belong to the authenticated user gym';
  end if;

  -- XP: 100 base, -15% por cada descanso salteado, mínimo 50
  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp := round(100 * v_quality);

  insert into public.workout_sessions (
    user_id,
    gym_id,
    plan_id,
    day_of_week,
    day_name,
    exercises_count,
    rest_skips,
    xp_earned
  ) values (
    v_user_id,
    v_gym_id,
    p_plan_id,
    p_day_of_week,
    p_day_name,
    coalesce(p_exercises_count, 0),
    v_rest_skips,
    v_xp
  )
  returning id into v_session_id;

  if jsonb_array_length(coalesce(p_sets, '[]')) > 0 then
    insert into public.workout_session_sets (
      session_id,
      exercise_id,
      exercise_name,
      category,
      set_number,
      reps,
      weight_kg,
      duration_seconds
    )
    select
      v_session_id,
      nullif((s->>'exercise_id'), '')::uuid,
      s->>'exercise_name',
      s->>'category',
      (s->>'set_number')::integer,
      nullif(s->>'reps', '')::integer,
      nullif(s->>'weight_kg', '')::numeric,
      nullif(s->>'duration_seconds', '')::integer
    from jsonb_array_elements(p_sets) as s;
  end if;

  update public.profiles
  set total_xp = total_xp + v_xp
  where id = v_user_id
  returning total_xp into v_total_xp;

  with
    metrics as (
      select
        (select count(*)::int from public.workout_sessions where user_id = v_user_id) as total_sessions,
        v_total_xp as total_xp,
        (select count(*)::int from public.workout_sessions
          where user_id = v_user_id
            and date_trunc('week', completed_at at time zone 'UTC')
                = date_trunc('week', now() at time zone 'UTC')) as sessions_week,
        (select count(*)::int from (
          select d, row_number() over (order by d desc) - 1 as expected_offset
          from (
            select distinct (completed_at at time zone 'UTC')::date as d
            from public.workout_sessions
            where user_id = v_user_id
              and completed_at >= (now() at time zone 'UTC')::date - interval '365 days'
          ) all_dates
        ) ranked
        where d = (now() at time zone 'UTC')::date - (expected_offset * interval '1 day')) as streak_days,
        (select coalesce(sum(wss.weight_kg * wss.reps), 0)
          from public.workout_session_sets wss
          join public.workout_sessions ws on ws.id = wss.session_id
          where ws.user_id = v_user_id
            and wss.weight_kg is not null
            and wss.reps is not null) as total_volume_kg,
        (select coalesce(sum(wss.duration_seconds), 0) / 60.0
          from public.workout_session_sets wss
          join public.workout_sessions ws on ws.id = wss.session_id
          where ws.user_id = v_user_id
            and wss.category = 'cardio'
            and wss.duration_seconds is not null) as total_cardio_minutes
    ),
    candidates as (
      select a.*
      from public.achievements a
      cross join metrics m
      where a.gym_id = v_gym_id
        and (
          (a.condition_type = 'total_sessions' and m.total_sessions >= a.condition_value) or
          (a.condition_type = 'total_xp' and m.total_xp >= a.condition_value) or
          (a.condition_type = 'sessions_week' and m.sessions_week >= a.condition_value) or
          (a.condition_type = 'streak_days' and m.streak_days >= a.condition_value) or
          (a.condition_type = 'total_volume_kg' and m.total_volume_kg >= a.condition_value) or
          (a.condition_type = 'total_cardio_minutes' and m.total_cardio_minutes >= a.condition_value) or
          (a.condition_type = 'sessions_category' and a.condition_target is not null and (
            select count(distinct ws2.id)::int
            from public.workout_sessions ws2
            join public.workout_session_sets wss2 on wss2.session_id = ws2.id
            where ws2.user_id = v_user_id
              and wss2.category = a.condition_target
          ) >= a.condition_value)
        )
        and not exists (
          select 1
          from public.user_achievements ua
          where ua.user_id = v_user_id
            and ua.achievement_id = a.id
        )
    ),
    inserted as (
      insert into public.user_achievements (user_id, achievement_id)
      select v_user_id, c.id
      from candidates c
      on conflict (user_id, achievement_id) do nothing
      returning achievement_id, earned_at
    )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'icon', a.icon,
        'xp_reward', a.xp_reward,
        'earned_at', i.earned_at
      ) order by a.name
    ),
    '[]'::jsonb
  )
  into v_earned
  from inserted i
  join public.achievements a on a.id = i.achievement_id;

  return query select v_session_id, v_xp, v_total_xp, v_earned;
end;
$$;

revoke all on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb) from public;
grant execute on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb) to authenticated;
