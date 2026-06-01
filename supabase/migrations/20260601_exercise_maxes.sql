-- Tabla para registrar el 1RM (máximo) por ejercicio por usuario
CREATE TABLE exercise_maxes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg    numeric(6,2) NOT NULL,
  recorded_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

ALTER TABLE exercise_maxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own maxes"
  ON exercise_maxes
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins/trainers pueden ver los maxes de sus miembros
CREATE POLICY "trainers read member maxes"
  ON exercise_maxes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles trainer ON trainer.gym_id = p.gym_id
      WHERE p.id = user_id
        AND trainer.id = auth.uid()
        AND trainer.role IN ('admin', 'trainer')
    )
  );
