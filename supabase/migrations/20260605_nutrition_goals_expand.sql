-- Expand allowed goal values in nutrition_plans
ALTER TABLE nutrition_plans
  DROP CONSTRAINT IF EXISTS nutrition_plans_goal_check;

ALTER TABLE nutrition_plans
  ADD CONSTRAINT nutrition_plans_goal_check
  CHECK (goal IN ('volumen', 'definicion', 'mantenimiento', 'recomposicion', 'rendimiento', 'perdida_moderada', 'otro'));
