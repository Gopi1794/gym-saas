-- Corrige nutrition_plans donde recalculateNutritionPlanTargets persistio
-- calorie_adjustment_pct = 0 en vez del default real del objetivo, por un
-- bug ya corregido en el codigo (ver PR). Solo toca filas donde el valor
-- guardado es exactamente 0 Y el objetivo no es 'mantenimiento'/'recomposicion'
-- (los dos objetivos que legitimamente usan 0% -- no tocarlos evita falsos
-- positivos).
update nutrition_plans
set calorie_adjustment_pct = case goal
  when 'volumen' then 12
  when 'rendimiento' then 8
  when 'perdida_moderada' then -10
  when 'definicion' then -18
  else calorie_adjustment_pct
end
where calorie_adjustment_pct = 0
  and goal in ('volumen', 'rendimiento', 'perdida_moderada', 'definicion');
