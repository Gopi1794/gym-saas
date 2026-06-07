-- Actual quantities consumed per food item in a meal log
CREATE TABLE IF NOT EXISTS nutrition_log_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id        UUID NOT NULL REFERENCES nutrition_logs(id) ON DELETE CASCADE,
  food_id       UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  actual_grams  NUMERIC(8,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nutrition_log_items_log ON nutrition_log_items(log_id);

ALTER TABLE nutrition_log_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_log_items_member" ON nutrition_log_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM nutrition_logs nl
      WHERE nl.id = nutrition_log_items.log_id
      AND nl.member_id = auth.uid()
    )
  );

CREATE POLICY "nutrition_log_items_trainer_read" ON nutrition_log_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nutrition_logs nl
      JOIN profiles member ON member.id = nl.member_id
      JOIN profiles trainer ON trainer.gym_id = member.gym_id
      WHERE nl.id = nutrition_log_items.log_id
      AND trainer.id = auth.uid()
      AND trainer.role IN ('admin', 'trainer')
    )
  );
