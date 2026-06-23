CREATE TABLE quick_log_entries (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  gym_id      uuid,
  description text    NOT NULL,
  calories    int     NOT NULL DEFAULT 0,
  protein_g   numeric NOT NULL DEFAULT 0,
  carbs_g     numeric NOT NULL DEFAULT 0,
  fat_g       numeric NOT NULL DEFAULT 0,
  logged_at   date    NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE quick_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage own quick logs"
  ON quick_log_entries
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
