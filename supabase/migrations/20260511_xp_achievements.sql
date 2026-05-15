-- ============================================================
-- xp-achievements migration
-- Apply once: supabase/migrations/20260511_xp_achievements.sql
-- ============================================================

-- 4.1 Column additions ---------------------------------------------------
alter table workout_sessions
  add column if not exists rest_skips integer not null default 0,
  add column if not exists xp_earned  integer not null default 0;

alter table profiles
  add column if not exists total_xp integer not null default 0;

-- 4.2 New tables ---------------------------------------------------------
create table if not exists achievements (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references gyms(id) on delete cascade,
  name            text not null,
  description     text,
  icon            text,
  xp_reward       integer not null default 50 check (xp_reward between 1 and 1000),
  condition_type  text not null check (condition_type in
                    ('total_sessions','streak_days','sessions_week','total_xp')),
  condition_value integer not null,
  created_at      timestamptz default now()
);

create table if not exists user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  earned_at      timestamptz default now(),
  unique (user_id, achievement_id)
);

-- 4.3 Indexes ------------------------------------------------------------
create index if not exists idx_profiles_leaderboard
  on profiles (gym_id, total_xp desc) where role = 'member';

create index if not exists idx_user_achievements_user
  on user_achievements (user_id);

create index if not exists idx_workout_sessions_user_completed
  on workout_sessions (user_id, completed_at);

-- 4.4 RLS ----------------------------------------------------------------
alter table achievements      enable row level security;
alter table user_achievements enable row level security;

-- achievements: read for anyone in the same gym
drop policy if exists "members read gym achievements" on achievements;
create policy "members read gym achievements"
  on achievements for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = achievements.gym_id
    )
  );

-- achievements: write for admin/trainer of same gym
drop policy if exists "admins write gym achievements" on achievements;
create policy "admins write gym achievements"
  on achievements for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = achievements.gym_id
        and p.role in ('admin','trainer')
    )
  );

-- user_achievements: members read own
drop policy if exists "users read own earned" on user_achievements;
create policy "users read own earned"
  on user_achievements for select
  using (user_id = auth.uid());

-- user_achievements: admins/trainers read same-gym members
drop policy if exists "admins read gym earned" on user_achievements;
create policy "admins read gym earned"
  on user_achievements for select
  using (
    exists (
      select 1
      from profiles me
      join profiles target on target.id = user_achievements.user_id
      where me.id = auth.uid()
        and me.role in ('admin','trainer')
        and me.gym_id = target.gym_id
    )
  );

-- No INSERT/UPDATE/DELETE policy on user_achievements:
-- only the SECURITY DEFINER function complete_workout_session can write.
-- Direct client writes are denied by RLS.

-- 4.5 The RPC ------------------------------------------------------------
create or replace function complete_workout_session(
  p_plan_id         uuid,
  p_day_of_week     integer,
  p_day_name        text,
  p_exercises_count integer,
  p_rest_skips      integer
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
  v_user_id    uuid    := auth.uid();
  v_gym_id     uuid;
  v_session_id uuid;
  v_quality    numeric;
  v_xp         integer;
  v_total_xp   integer;
  -- Coerce NULL or negative rest_skips to 0
  v_rest_skips integer := greatest(coalesce(p_rest_skips, 0), 0);
  v_earned     jsonb;
begin
  -- Guard: must be authenticated
  if v_user_id is null then
    raise exception 'auth.uid() is null — call requires an authenticated session';
  end if;

  -- Guard: caller must belong to a gym
  select gym_id into v_gym_id from profiles where id = v_user_id;
  if v_gym_id is null then
    raise exception 'user has no gym_id — cannot complete session without gym membership';
  end if;

  -- XP formula: round(100 × max(0.5, 1 − rest_skips × 0.15))
  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp      := round(100 * v_quality);

  -- Step 1: Insert the workout session
  insert into workout_sessions (
    user_id, plan_id, day_of_week, day_name,
    exercises_count, rest_skips, xp_earned
  ) values (
    v_user_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp
  )
  returning id into v_session_id;

  -- Step 2: Add XP atomically to profile
  update profiles
    set total_xp = total_xp + v_xp
    where id = v_user_id
    returning total_xp into v_total_xp;

  -- Step 3: Evaluate achievements in a single set-based insert.
  --
  -- metrics CTE: computes all 4 condition values in one pass.
  --   streak_days algorithm:
  --     1. Build the set of distinct UTC dates with a session in the last 365 days.
  --     2. Walk back from today; count contiguous days (no gap allowed).
  --     Any day missing in the sequence breaks the streak — count resets.
  --
  -- candidates CTE: achievements whose condition is now met AND not yet earned.
  -- inserted CTE: inserts them and returns (achievement_id, earned_at).
  with
    metrics as (
      select
        -- total sessions ever
        (select count(*)::int
           from workout_sessions
           where user_id = v_user_id)                                          as total_sessions,

        -- total XP after this session's update
        v_total_xp                                                             as total_xp,

        -- sessions in the current ISO week (UTC)
        (select count(*)::int
           from workout_sessions
           where user_id = v_user_id
             and date_trunc('week', completed_at at time zone 'UTC')
                 = date_trunc('week', now() at time zone 'UTC'))               as sessions_week,

        -- consecutive-day streak counting back from today (UTC)
        -- Walk distinct UTC dates backwards from today; stop at the first gap.
        (
          select count(*)::int
          from (
            -- Number each distinct UTC date by distance from today (0 = today, 1 = yesterday, …)
            select
              d,
              row_number() over (order by d desc) - 1 as expected_offset
            from (
              select distinct (completed_at at time zone 'UTC')::date as d
              from workout_sessions
              where user_id = v_user_id
                and completed_at >= (now() at time zone 'UTC')::date - interval '365 days'
            ) all_dates
          ) ranked
          -- Keep only rows where the actual date equals today minus expected_offset.
          -- The first gap breaks the sequence; subsequent dates are excluded.
          where d = (now() at time zone 'UTC')::date - (expected_offset * interval '1 day')
        )                                                                      as streak_days
    ),
    candidates as (
      select a.*
        from achievements a
        cross join metrics m
        where a.gym_id = v_gym_id
          and (
            (a.condition_type = 'total_sessions' and m.total_sessions >= a.condition_value) or
            (a.condition_type = 'total_xp'       and m.total_xp       >= a.condition_value) or
            (a.condition_type = 'sessions_week'  and m.sessions_week  >= a.condition_value) or
            (a.condition_type = 'streak_days'    and m.streak_days    >= a.condition_value)
          )
          -- Exclude already-earned achievements (UNIQUE constraint is a backup)
          and not exists (
            select 1 from user_achievements ua
              where ua.user_id = v_user_id
                and ua.achievement_id = a.id
          )
    ),
    inserted as (
      insert into user_achievements (user_id, achievement_id)
      select v_user_id, c.id from candidates c
      on conflict (user_id, achievement_id) do nothing
      returning achievement_id, earned_at
    )
  -- Step 4: Aggregate newly earned achievements as jsonb
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id',          a.id,
               'name',        a.name,
               'description', a.description,
               'icon',        a.icon,
               'xp_reward',   a.xp_reward,
               'earned_at',   i.earned_at
             ) order by a.name
           ),
           '[]'::jsonb
         )
    into v_earned
    from inserted i
    join achievements a on a.id = i.achievement_id;

  -- Step 5: Return the result row
  return query select v_session_id, v_xp, v_total_xp, v_earned;
end;
$$;

-- Revoke public access; grant only to authenticated role
revoke all on function complete_workout_session(uuid, integer, text, integer, integer) from public;
grant execute on function complete_workout_session(uuid, integer, text, integer, integer) to authenticated;
