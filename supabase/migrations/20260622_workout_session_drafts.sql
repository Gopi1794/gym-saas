CREATE TABLE workout_session_drafts (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id        uuid    NOT NULL,
  day_of_week    int     NOT NULL,
  day_name       text    NOT NULL,
  exercise_idx   int     NOT NULL DEFAULT 0,
  current_set    int     NOT NULL DEFAULT 1,
  phase          text    NOT NULL DEFAULT 'exercising',
  collected_sets jsonb   NOT NULL DEFAULT '[]',
  rest_ends_at   bigint,
  rest_total     int     NOT NULL DEFAULT 0,
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, plan_id, day_of_week)
);

ALTER TABLE workout_session_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage own drafts"
  ON workout_session_drafts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
