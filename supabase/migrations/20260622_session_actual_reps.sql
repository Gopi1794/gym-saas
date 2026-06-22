-- Add actual_reps + planned_reps to workout_session_sets
-- actual_reps: what the member actually did
-- planned_reps: what the trainer assigned
-- reps stays as actual (used for volume calculations)

ALTER TABLE workout_session_sets
  ADD COLUMN IF NOT EXISTS actual_reps INTEGER,
  ADD COLUMN IF NOT EXISTS planned_reps INTEGER;

-- RLS: trainers and admins can read session sets for members of their gym
CREATE POLICY "trainers read gym member session sets"
  ON workout_session_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      JOIN profiles member  ON member.id  = ws.user_id
      JOIN profiles trainer ON trainer.id = auth.uid()
      WHERE ws.id = session_id
        AND member.gym_id  = trainer.gym_id
        AND trainer.role IN ('admin', 'trainer')
    )
  );

-- Update RPC to save actual_reps and planned_reps
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
SET search_path = public
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

  SELECT gym_id INTO v_gym_id FROM profiles WHERE id = v_user_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'user has no gym_id';
  END IF;

  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp      := round(100 * v_quality);

  INSERT INTO workout_sessions (
    user_id, gym_id, plan_id, day_of_week, day_name,
    exercises_count, rest_skips, xp_earned
  ) VALUES (
    v_user_id, v_gym_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp
  )
  RETURNING id INTO v_session_id;

  IF jsonb_array_length(coalesce(p_sets, '[]')) > 0 THEN
    INSERT INTO workout_session_sets (
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

  UPDATE profiles
    SET total_xp = total_xp + v_xp
    WHERE id = v_user_id
    RETURNING total_xp INTO v_total_xp;

  WITH
    metrics AS (
      SELECT
        (SELECT count(*)::int FROM workout_sessions WHERE user_id = v_user_id) AS total_sessions,
        v_total_xp AS total_xp,
        (SELECT count(*)::int FROM workout_sessions
          WHERE user_id = v_user_id
            AND date_trunc('week', completed_at AT TIME ZONE 'UTC')
                = date_trunc('week', now() AT TIME ZONE 'UTC')) AS sessions_week,
        (SELECT count(*)::int FROM (
          SELECT d, row_number() OVER (ORDER BY d DESC) - 1 AS expected_offset
          FROM (
            SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
            FROM workout_sessions
            WHERE user_id = v_user_id
              AND completed_at >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '365 days'
          ) all_dates
        ) ranked
        WHERE d = (now() AT TIME ZONE 'UTC')::date - (expected_offset * INTERVAL '1 day')) AS streak_days,
        (SELECT coalesce(sum(wss.weight_kg * wss.reps), 0)
          FROM workout_session_sets wss
          JOIN workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.weight_kg IS NOT NULL
            AND wss.reps IS NOT NULL) AS total_volume_kg,
        (SELECT coalesce(sum(wss.duration_seconds), 0) / 60.0
          FROM workout_session_sets wss
          JOIN workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.category = 'cardio'
            AND wss.duration_seconds IS NOT NULL) AS total_cardio_minutes
    ),
    candidates AS (
      SELECT a.*
        FROM achievements a
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
              FROM workout_sessions ws2
              JOIN workout_session_sets wss2 ON wss2.session_id = ws2.id
              WHERE ws2.user_id = v_user_id
                AND wss2.category = a.condition_target
            ) >= a.condition_value)
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_achievements ua
            WHERE ua.user_id = v_user_id AND ua.achievement_id = a.id
          )
    ),
    inserted AS (
      INSERT INTO user_achievements (user_id, achievement_id)
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
  JOIN achievements a ON a.id = i.achievement_id;

  RETURN QUERY SELECT v_session_id, v_xp, v_total_xp, v_earned;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_workout_session(uuid, integer, text, integer, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_workout_session(uuid, integer, text, integer, integer, jsonb) TO authenticated;
