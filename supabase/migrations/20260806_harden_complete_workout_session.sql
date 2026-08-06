-- Hardening de complete_workout_session (confirmado con el Security Advisor de Supabase
-- contra la base en producción, no solo lectura de código):
--
-- 1) La función seguía siendo ejecutable por el rol `anon` (sin sesión) a pesar del
--    `REVOKE ... FROM public` de la migración anterior. Postgres/Supabase otorga EXECUTE
--    a anon/authenticated por default privileges al crear la función — ese grant es
--    independiente de PUBLIC y el REVOKE FROM public no lo toca. Hay que revocar
--    explícito de `anon` (y de paso `authenticated`, para volver a otorgarlo limpio).
-- 2) La función no validaba que p_plan_id perteneciera al usuario que llama (podía
--    completarse cualquier plan_id válido, incluso de otro socio o un template), ni
--    impedía completar el mismo plan/día más de una vez el mismo día calendario —
--    permitía farmear XP y logros sin límite, sin pasar por la UI.
-- 3) El overload de 5 argumentos (sin p_sets) no lo usa la app — completeWorkoutSession
--    en app/actions/workout-sessions.ts siempre manda p_sets — y seguía siendo
--    anon-executable. Se elimina: era superficie de ataque sin ningún beneficio.
-- 4) search_path pasa de 'public' a '' (vacío), con todas las tablas calificadas con
--    `public.` — pg_catalog (funciones built-in: now, greatest, coalesce, jsonb_*, etc.)
--    sigue disponible siempre, implícito, sin importar el search_path.

DROP FUNCTION IF EXISTS public.complete_workout_session(uuid, integer, text, integer, integer);

CREATE OR REPLACE FUNCTION public.complete_workout_session(
  p_plan_id         uuid,
  p_day_of_week     integer,
  p_day_name        text,
  p_exercises_count integer,
  p_rest_skips      integer,
  p_sets            jsonb DEFAULT '[]'
)
RETURNS TABLE (
  session_id          uuid,
  xp_earned           integer,
  new_total_xp        integer,
  earned_achievements jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    uuid    := auth.uid();
  v_gym_id     uuid;
  v_session_id uuid;
  v_quality    numeric;
  v_xp         integer;
  v_total_xp   integer;
  v_rest_skips integer := greatest(coalesce(p_rest_skips, 0), 0);
  v_earned     jsonb;
BEGIN
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
    exercises_count, rest_skips, xp_earned
  ) VALUES (
    v_user_id, v_gym_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp
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

  UPDATE public.profiles
    SET total_xp = total_xp + v_xp
    WHERE id = v_user_id
    RETURNING total_xp INTO v_total_xp;

  WITH
    metrics AS (
      SELECT
        (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = v_user_id) AS total_sessions,
        v_total_xp AS total_xp,
        (SELECT count(*)::int FROM public.workout_sessions
          WHERE user_id = v_user_id
            AND date_trunc('week', completed_at AT TIME ZONE 'UTC')
                = date_trunc('week', now() AT TIME ZONE 'UTC')) AS sessions_week,
        (SELECT count(*)::int FROM (
          SELECT d, row_number() OVER (ORDER BY d DESC) - 1 AS expected_offset
          FROM (
            SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
            FROM public.workout_sessions
            WHERE user_id = v_user_id
              AND completed_at >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '365 days'
          ) all_dates
        ) ranked
        WHERE d = (now() AT TIME ZONE 'UTC')::date - (expected_offset * INTERVAL '1 day')) AS streak_days,
        (SELECT coalesce(sum(wss.weight_kg * wss.reps), 0)
          FROM public.workout_session_sets wss
          JOIN public.workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.weight_kg IS NOT NULL
            AND wss.reps IS NOT NULL) AS total_volume_kg,
        (SELECT coalesce(sum(wss.duration_seconds), 0) / 60.0
          FROM public.workout_session_sets wss
          JOIN public.workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.category = 'cardio'
            AND wss.duration_seconds IS NOT NULL) AS total_cardio_minutes
    ),
    candidates AS (
      SELECT a.*
        FROM public.achievements a
        CROSS JOIN metrics m
        WHERE a.gym_id = v_gym_id
          AND (
            (a.condition_type = 'total_sessions'       AND m.total_sessions      >= a.condition_value) OR
            (a.condition_type = 'total_xp'             AND m.total_xp            >= a.condition_value) OR
            (a.condition_type = 'sessions_week'        AND m.sessions_week       >= a.condition_value) OR
            (a.condition_type = 'streak_days'          AND m.streak_days         >= a.condition_value) OR
            (a.condition_type = 'total_volume_kg'      AND m.total_volume_kg     >= a.condition_value) OR
            (a.condition_type = 'total_cardio_minutes' AND m.total_cardio_minutes >= a.condition_value) OR
            (a.condition_type = 'sessions_category'    AND a.condition_target IS NOT NULL AND (
              SELECT count(DISTINCT ws2.id)::int
              FROM public.workout_sessions ws2
              JOIN public.workout_session_sets wss2 ON wss2.session_id = ws2.id
              WHERE ws2.user_id = v_user_id
                AND wss2.category = a.condition_target
            ) >= a.condition_value)
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

  RETURN QUERY SELECT v_session_id, v_xp, v_total_xp, v_earned;
END;
$$;

-- El REVOKE FROM public de la migración anterior no alcanzó (ver comentario arriba).
-- Revocar explícito de cada rol y volver a otorgar limpio solo a authenticated.
REVOKE ALL ON FUNCTION public.complete_workout_session(uuid, integer, text, integer, integer, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workout_session(uuid, integer, text, integer, integer, jsonb)
  TO authenticated;

-- Backstop a nivel de base contra la condición de carrera (doble-tap / doble llamada
-- concurrente) que el chequeo IF EXISTS de arriba, al ser dos pasos, no puede cerrar solo.
CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_one_per_plan_day_uidx
  ON public.workout_sessions (user_id, plan_id, day_of_week, ((completed_at AT TIME ZONE 'UTC')::date));
