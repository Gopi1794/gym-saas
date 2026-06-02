-- Fix RLS policy for workout_plan_set_configs.
-- The original policy joined profiles from the wrong side; rewrite to match
-- the pattern used by other tables in this project (start FROM profiles).

DROP POLICY IF EXISTS "trainer manage set configs" ON workout_plan_set_configs;
DROP POLICY IF EXISTS "member read own set configs" ON workout_plan_set_configs;

CREATE POLICY "trainer manage set configs"
  ON workout_plan_set_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN workout_plans wp ON wp.gym_id = p.gym_id
      JOIN workout_plan_days wpd ON wpd.plan_id = wp.id
      JOIN workout_plan_exercises wpe ON wpe.day_id = wpd.id
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
        AND wpe.id = workout_plan_set_configs.exercise_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN workout_plans wp ON wp.gym_id = p.gym_id
      JOIN workout_plan_days wpd ON wpd.plan_id = wp.id
      JOIN workout_plan_exercises wpe ON wpe.day_id = wpd.id
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
        AND wpe.id = exercise_id
    )
  );

CREATE POLICY "member read own set configs"
  ON workout_plan_set_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_plan_exercises wpe
      JOIN workout_plan_days wpd ON wpd.id = wpe.day_id
      JOIN workout_plans wp ON wp.id = wpd.plan_id
      WHERE wpe.id = workout_plan_set_configs.exercise_id
        AND wp.assigned_to = auth.uid()
    )
  );
