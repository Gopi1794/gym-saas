CREATE TABLE IF NOT EXISTS nutrition_food_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, food_id)
);

ALTER TABLE nutrition_food_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own favorites"
  ON nutrition_food_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
