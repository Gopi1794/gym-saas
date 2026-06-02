CREATE TABLE workout_plan_set_configs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id      uuid NOT NULL REFERENCES workout_plan_exercises(id) ON DELETE CASCADE,
  set_number       smallint NOT NULL,
  reps             smallint,
  reps_max         smallint,
  percent_1rm      smallint,
  duration_seconds smallint,
  notes            text,
  UNIQUE (exercise_id, set_number)
);

ALTER TABLE workout_plan_set_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer manage set configs"
  ON workout_plan_set_configs
  USING (
    EXISTS (
      SELECT 1
      FROM workout_plan_exercises wpe
      JOIN workout_plan_days wpd ON wpd.id = wpe.day_id
      JOIN workout_plans wp ON wp.id = wpd.plan_id
      JOIN profiles p ON p.gym_id = wp.gym_id
      WHERE wpe.id = exercise_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_plan_exercises wpe
      JOIN workout_plan_days wpd ON wpd.id = wpe.day_id
      JOIN workout_plans wp ON wp.id = wpd.plan_id
      JOIN profiles p ON p.gym_id = wp.gym_id
      WHERE wpe.id = exercise_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
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
      WHERE wpe.id = exercise_id
        AND wp.assigned_to = auth.uid()
    )
  );
