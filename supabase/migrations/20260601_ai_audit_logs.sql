CREATE TABLE ai_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action        text NOT NULL CHECK (action IN ('generate_plan', 'import_plan')),
  plan_id       uuid REFERENCES workout_plans(id) ON DELETE SET NULL,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read own gym logs"
  ON ai_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND gym_id = ai_audit_logs.gym_id
        AND role IN ('admin', 'trainer')
    )
  );
