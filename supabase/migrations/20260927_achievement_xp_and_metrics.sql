-- Achievements: one shared source for the member metrics, and a real xp_reward.
--
-- 1) member_achievement_metrics(p_user_id) returns every number an achievement
--    condition can use. complete_workout_session evaluates achievements with it and the
--    member views read it to show real progress. Week and streak use the Argentina time
--    zone (they used UTC, so a session between 21:00 and 23:59 counted for the next day).
--    SECURITY INVOKER: RLS on the workout tables and profiles still applies to the caller.
-- 2) complete_workout_session keeps its signature and grants. New: every newly earned
--    achievement adds its xp_reward to profiles.total_xp (before, xp_reward was only
--    echoed in the returned JSON and never paid).

create or replace function public.member_achievement_metrics(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_sessions', (select count(*)::int from public.workout_sessions where user_id = p_user_id),
    'total_xp', coalesce((select total_xp from public.profiles where id = p_user_id), 0),
    'sessions_week', (
      select count(*)::int
      from public.workout_sessions
      where user_id = p_user_id
        and date_trunc('week', completed_at at time zone 'America/Argentina/Buenos_Aires')
          = date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
    ),
    'streak_days', (
      select count(*)::int
      from (
        select d, row_number() over (order by d desc) - 1 as expected_offset
        from (
          select distinct (completed_at at time zone 'America/Argentina/Buenos_Aires')::date as d
          from public.workout_sessions
          where user_id = p_user_id
            and completed_at >= ((now() at time zone 'America/Argentina/Buenos_Aires')::date - interval '365 days')
                                at time zone 'America/Argentina/Buenos_Aires'
        ) all_dates
      ) ranked
      where d = (now() at time zone 'America/Argentina/Buenos_Aires')::date - (expected_offset * interval '1 day')
    ),
    'total_volume_kg', (
      select coalesce(sum(wss.weight_kg * wss.reps), 0)
      from public.workout_session_sets wss
      join public.workout_sessions ws on ws.id = wss.session_id
      where ws.user_id = p_user_id
        and wss.weight_kg is not null
        and wss.reps is not null
    ),
    'total_cardio_minutes', (
      select coalesce(sum(wss.duration_seconds), 0) / 60.0
      from public.workout_session_sets wss
      join public.workout_sessions ws on ws.id = wss.session_id
      where ws.user_id = p_user_id
        and wss.category = 'cardio'
        and wss.duration_seconds is not null
    ),
    'sessions_by_category', coalesce((
      select jsonb_object_agg(c.category, c.n)
      from (
        select wss.category, count(distinct ws.id)::int as n
        from public.workout_sessions ws
        join public.workout_session_sets wss on wss.session_id = ws.id
        where ws.user_id = p_user_id
          and wss.category is not null
        group by wss.category
      ) c
    ), '{}'::jsonb)
  )
$$;

revoke all on function public.member_achievement_metrics(uuid) from public, anon;
grant execute on function public.member_achievement_metrics(uuid) to authenticated, service_role;

create or replace function public.complete_workout_session(
  p_plan_id uuid,
  p_day_of_week integer,
  p_day_name text,
  p_exercises_count integer,
  p_rest_skips integer,
  p_sets jsonb default '[]'::jsonb,
  p_duration_seconds integer default null
)
 returns table(session_id uuid, xp_earned integer, new_total_xp integer, earned_achievements jsonb)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id    uuid    := auth.uid();
  v_gym_id     uuid;
  v_session_id uuid;
  v_quality    numeric;
  v_xp         integer;
  v_total_xp   integer;
  v_rest_skips integer := greatest(coalesce(p_rest_skips, 0), 0);
  v_earned     jsonb;
  v_duration_count integer;
  v_metrics    jsonb;
  v_bonus_xp   integer;
begin
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.profiles WHERE id = v_user_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'user has no gym_id';
  END IF;

  -- El plan tiene que estar asignado al usuario que llama. Esto además bloquea
  -- templates (assigned_to null) y planes de otros socios.
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE id = p_plan_id AND assigned_to = v_user_id
  ) THEN
    RAISE EXCEPTION 'plan does not belong to the authenticated user';
  END IF;

  -- No permitir completar el mismo plan/día más de una vez el mismo día calendario.
  IF EXISTS (
    SELECT 1 FROM public.workout_sessions
    WHERE user_id = v_user_id
      AND plan_id = p_plan_id
      AND day_of_week = p_day_of_week
      AND (completed_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
  ) THEN
    RAISE EXCEPTION 'workout already completed today for this plan/day';
  END IF;

  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp      := round(100 * v_quality);

  INSERT INTO public.workout_sessions (
    user_id, gym_id, plan_id, day_of_week, day_name,
    exercises_count, rest_skips, xp_earned, duration_seconds
  ) VALUES (
    v_user_id, v_gym_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp, p_duration_seconds
  )
  RETURNING id INTO v_session_id;

  IF jsonb_array_length(coalesce(p_sets, '[]')) > 0 THEN
    INSERT INTO public.workout_session_sets (
      session_id, exercise_id, exercise_name, category,
      set_number, reps, actual_reps, planned_reps, weight_kg, duration_seconds,
      distance_meters, speed_kmh, resistance_level, calories_burned
    )
    SELECT
      v_session_id,
      nullif((s->>'exercise_id'), '')::uuid,
      s->>'exercise_name',
      s->>'category',
      (s->>'set_number')::integer,
      -- reps = actual (used for volume calc)
      nullif(s->>'actual_reps', '')::integer,
      nullif(s->>'actual_reps', '')::integer,
      nullif(s->>'planned_reps', '')::integer,
      nullif(s->>'weight_kg', '')::numeric,
      nullif(s->>'duration_seconds', '')::integer,
      nullif(s->>'distance_meters', '')::integer,
      nullif(s->>'speed_kmh', '')::numeric,
      nullif(s->>'resistance_level', '')::smallint,
      nullif(s->>'calories_burned', '')::smallint
    FROM jsonb_array_elements(p_sets) AS s;
  END IF;

  -- Duración real: si esta sesión llega a la octava con duration_seconds
  -- registrado en las últimas 4 semanas, avisar a quien corresponda que ya
  -- hay dato suficiente para refinar el cálculo nutricional de este socio.
  -- No dispara ningún recálculo — solo deja la alerta (ver spec sección 2).
  IF p_duration_seconds IS NOT NULL THEN
    SELECT count(*) INTO v_duration_count
    FROM public.workout_sessions
    WHERE user_id = v_user_id
      AND duration_seconds IS NOT NULL
      AND completed_at >= (now() AT TIME ZONE 'UTC') - INTERVAL '28 days';

    IF v_duration_count = 8 THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata, dedup_key, gym_id)
      SELECT
        recipient.id,
        'nutrition_duration_ready',
        'Duración real de entrenamiento disponible',
        coalesce(m.full_name, 'Un socio') || ' ya completó suficientes entrenamientos con duración registrada para refinar su plan nutricional',
        jsonb_build_object('member_id', v_user_id, 'sessions_count', v_duration_count),
        'nutrition-duration-ready:' || recipient.id::text || ':member:' || v_user_id::text,
        v_gym_id
      FROM public.profiles m
      JOIN public.profiles recipient
        ON recipient.gym_id = m.gym_id
       AND (
         (m.trainer_id IS NOT NULL AND recipient.id = m.trainer_id)
         OR (m.trainer_id IS NULL AND recipient.role = 'admin')
       )
      WHERE m.id = v_user_id
      ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  UPDATE public.profiles
    SET total_xp = total_xp + v_xp
    WHERE id = v_user_id
    RETURNING total_xp INTO v_total_xp;

  -- The metrics come from the shared function (Argentina time zone), so the
  -- member views can show the same numbers this evaluation uses.
  v_metrics := public.member_achievement_metrics(v_user_id);

  WITH
    candidates AS (
      SELECT a.*
        FROM public.achievements a
        WHERE a.gym_id = v_gym_id
          AND (
            (a.condition_type = 'total_sessions'       AND (v_metrics->>'total_sessions')::numeric       >= a.condition_value) OR
            (a.condition_type = 'total_xp'             AND (v_metrics->>'total_xp')::numeric             >= a.condition_value) OR
            (a.condition_type = 'sessions_week'        AND (v_metrics->>'sessions_week')::numeric        >= a.condition_value) OR
            (a.condition_type = 'streak_days'          AND (v_metrics->>'streak_days')::numeric          >= a.condition_value) OR
            (a.condition_type = 'total_volume_kg'      AND (v_metrics->>'total_volume_kg')::numeric      >= a.condition_value) OR
            (a.condition_type = 'total_cardio_minutes' AND (v_metrics->>'total_cardio_minutes')::numeric >= a.condition_value) OR
            (a.condition_type = 'sessions_category'    AND a.condition_target IS NOT NULL
              AND coalesce((v_metrics->'sessions_by_category'->>a.condition_target)::numeric, 0) >= a.condition_value)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.user_achievements ua
            WHERE ua.user_id = v_user_id AND ua.achievement_id = a.id
          )
    ),
    inserted AS (
      INSERT INTO public.user_achievements (user_id, achievement_id)
      SELECT v_user_id, c.id FROM candidates c
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id, earned_at
    )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          a.id,
        'name',        a.name,
        'description', a.description,
        'icon',        a.icon,
        'xp_reward',   a.xp_reward,
        'earned_at',   i.earned_at
      ) ORDER BY a.name
    ),
    '[]'::jsonb
  )
  INTO v_earned
  FROM inserted i
  JOIN public.achievements a ON a.id = i.achievement_id;

  -- Each newly earned achievement pays its xp_reward. total_xp achievements were
  -- evaluated on the total before this bonus; a bonus that crosses such a
  -- threshold is picked up by the next completed session.
  SELECT coalesce(sum((e->>'xp_reward')::integer), 0)
    INTO v_bonus_xp
    FROM jsonb_array_elements(v_earned) AS e;

  IF v_bonus_xp > 0 THEN
    UPDATE public.profiles
      SET total_xp = total_xp + v_bonus_xp
      WHERE id = v_user_id
      RETURNING total_xp INTO v_total_xp;
  END IF;

  RETURN QUERY SELECT v_session_id, v_xp, v_total_xp, v_earned;
END;
$function$;

revoke execute on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb, integer) from public, anon;
grant execute on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb, integer) to authenticated, service_role;
