-- ============================================================
-- session-sets migration
-- Tracks per-set data (weight, duration) for medal conditions
-- ============================================================

-- 1. Nueva tabla de series por sesión
create table workout_session_sets (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references workout_sessions(id) on delete cascade,
  exercise_id      uuid references exercises(id) on delete set null,
  exercise_name    text not null,
  category         text not null,
  set_number       integer not null,
  reps             integer,
  weight_kg        numeric(6,2),
  duration_seconds integer,
  created_at       timestamptz default now()
);

alter table workout_session_sets enable row level security;

create policy "users read own session sets"
  on workout_session_sets for select
  using (
    exists (
      select 1 from workout_sessions ws
      where ws.id = session_id and ws.user_id = auth.uid()
    )
  );

-- 2. Agregar condition_target a achievements (guarda la categoría para sessions_category)
alter table achievements add column if not exists condition_target text;

-- 3. Actualizar el CHECK de condition_type
alter table achievements drop constraint if exists achievements_condition_type_check;
alter table achievements add constraint achievements_condition_type_check
  check (condition_type in (
    'total_sessions',
    'streak_days',
    'sessions_week',
    'total_xp',
    'sessions_category',
    'total_volume_kg',
    'total_cardio_minutes'
  ));

-- 4. RPC actualizada: acepta sets como JSONB y evalúa las nuevas condiciones
create or replace function complete_workout_session(
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
  v_user_id    uuid    := auth.uid();
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

  select gym_id into v_gym_id from profiles where id = v_user_id;
  if v_gym_id is null then
    raise exception 'user has no gym_id';
  end if;

  -- XP: 100 base, -15% por cada descanso salteado, mínimo 50
  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp      := round(100 * v_quality);

  -- Step 1: insertar sesión
  insert into workout_sessions (
    user_id, plan_id, day_of_week, day_name,
    exercises_count, rest_skips, xp_earned
  ) values (
    v_user_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp
  )
  returning id into v_session_id;

  -- Step 2: insertar series individuales si se enviaron
  if jsonb_array_length(coalesce(p_sets, '[]')) > 0 then
    insert into workout_session_sets (
      session_id, exercise_id, exercise_name, category,
      set_number, reps, weight_kg, duration_seconds
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

  -- Step 3: sumar XP al perfil
  update profiles
    set total_xp = total_xp + v_xp
    where id = v_user_id
    returning total_xp into v_total_xp;

  -- Step 4: evaluar logros
  with
    metrics as (
      select
        -- sesiones totales
        (select count(*)::int from workout_sessions where user_id = v_user_id) as total_sessions,

        -- XP total
        v_total_xp as total_xp,

        -- sesiones esta semana ISO
        (select count(*)::int from workout_sessions
          where user_id = v_user_id
            and date_trunc('week', completed_at at time zone 'UTC')
                = date_trunc('week', now() at time zone 'UTC')) as sessions_week,

        -- racha de días consecutivos
        (select count(*)::int from (
          select d, row_number() over (order by d desc) - 1 as expected_offset
          from (
            select distinct (completed_at at time zone 'UTC')::date as d
            from workout_sessions
            where user_id = v_user_id
              and completed_at >= (now() at time zone 'UTC')::date - interval '365 days'
          ) all_dates
        ) ranked
        where d = (now() at time zone 'UTC')::date - (expected_offset * interval '1 day')) as streak_days,

        -- volumen total levantado en kg (weight_kg * reps, acumulado histórico)
        (select coalesce(sum(wss.weight_kg * wss.reps), 0)
          from workout_session_sets wss
          join workout_sessions ws on ws.id = wss.session_id
          where ws.user_id = v_user_id
            and wss.weight_kg is not null
            and wss.reps is not null) as total_volume_kg,

        -- minutos de cardio acumulados histórico
        (select coalesce(sum(wss.duration_seconds), 0) / 60.0
          from workout_session_sets wss
          join workout_sessions ws on ws.id = wss.session_id
          where ws.user_id = v_user_id
            and wss.category = 'cardio'
            and wss.duration_seconds is not null) as total_cardio_minutes
    ),
    -- sesiones por categoría (join lateral para evaluar condition_target)
    candidates as (
      select a.*
        from achievements a
        cross join metrics m
        where a.gym_id = v_gym_id
          and (
            (a.condition_type = 'total_sessions'       and m.total_sessions      >= a.condition_value) or
            (a.condition_type = 'total_xp'             and m.total_xp            >= a.condition_value) or
            (a.condition_type = 'sessions_week'        and m.sessions_week       >= a.condition_value) or
            (a.condition_type = 'streak_days'          and m.streak_days         >= a.condition_value) or
            (a.condition_type = 'total_volume_kg'      and m.total_volume_kg     >= a.condition_value) or
            (a.condition_type = 'total_cardio_minutes' and m.total_cardio_minutes >= a.condition_value) or
            (a.condition_type = 'sessions_category'    and a.condition_target is not null and (
              select count(distinct ws2.id)::int
              from workout_sessions ws2
              join workout_session_sets wss2 on wss2.session_id = ws2.id
              where ws2.user_id = v_user_id
                and wss2.category = a.condition_target
            ) >= a.condition_value)
          )
          and not exists (
            select 1 from user_achievements ua
            where ua.user_id = v_user_id and ua.achievement_id = a.id
          )
    ),
    inserted as (
      insert into user_achievements (user_id, achievement_id)
      select v_user_id, c.id from candidates c
      on conflict (user_id, achievement_id) do nothing
      returning achievement_id, earned_at
    )
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

  return query select v_session_id, v_xp, v_total_xp, v_earned;
end;
$$;

revoke all on function complete_workout_session(uuid, integer, text, integer, integer, jsonb) from public;
grant execute on function complete_workout_session(uuid, integer, text, integer, integer, jsonb) to authenticated;
