-- Convertir exercise_maxes de snapshot único a log histórico
ALTER TABLE exercise_maxes
  DROP CONSTRAINT IF EXISTS exercise_maxes_user_id_exercise_id_key;

CREATE INDEX IF NOT EXISTS idx_exercise_maxes_user_exercise_recorded
  ON exercise_maxes (user_id, exercise_id, recorded_at DESC);
