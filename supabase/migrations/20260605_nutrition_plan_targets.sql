-- Add daily macro targets to nutrition_plans
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS target_calories NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS target_protein  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS target_carbs    NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS target_fat      NUMERIC(8,2);
