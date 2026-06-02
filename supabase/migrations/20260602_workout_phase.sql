ALTER TABLE workout_plan_exercises
  ADD COLUMN phase text NOT NULL DEFAULT 'main'
  CHECK (phase IN ('warmup', 'main', 'cooldown'));
