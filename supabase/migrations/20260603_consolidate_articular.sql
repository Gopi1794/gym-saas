-- Consolida los ejercicios de movilidad articular individuales en uno solo.
-- Antes: Movilidad de hombros, muñecas, cadera, rodillas, tobillos (5 registros)
-- Después: Movilización Articular (1 registro, cubre todos las articulaciones)

-- 1. Insertar el nuevo ejercicio consolidado (idempotente)
INSERT INTO exercises (name, category, muscle_groups, is_timed, description)
SELECT
  'Movilización Articular',
  'flexibility',
  ARRAY['hombros','codos','muñecas','caderas','rodillas','tobillos'],
  true,
  'Circuito de movilidad articular completo: hombros, codos, muñecas, caderas, rodillas y tobillos. 30-60 s por articulación de forma continua.'
WHERE NOT EXISTS (
  SELECT 1 FROM exercises WHERE name = 'Movilización Articular'
);

-- 2. Por cada día de plan que tenga alguno de los ejercicios viejos,
--    actualizar el primero (por created_at) para que apunte al nuevo.
WITH new_ex AS (
  SELECT id FROM exercises WHERE name = 'Movilización Articular'
),
first_old_per_day AS (
  SELECT DISTINCT ON (wpe.day_id) wpe.id
  FROM workout_plan_exercises wpe
  WHERE wpe.exercise_id IN (
    SELECT id FROM exercises
    WHERE name IN (
      'Movilidad de hombros',
      'Movilidad de muñecas',
      'Movilidad de cadera',
      'Movilidad de rodillas',
      'Movilidad de tobillos'
    )
  )
  ORDER BY wpe.day_id, wpe.created_at ASC
)
UPDATE workout_plan_exercises
SET exercise_id = (SELECT id FROM new_ex)
WHERE id IN (SELECT id FROM first_old_per_day);

-- 3. Borrar los demás workout_plan_exercises que aún apuntan a los viejos
--    (sus set_configs se borran por CASCADE)
DELETE FROM workout_plan_exercises
WHERE exercise_id IN (
  SELECT id FROM exercises
  WHERE name IN (
    'Movilidad de hombros',
    'Movilidad de muñecas',
    'Movilidad de cadera',
    'Movilidad de rodillas',
    'Movilidad de tobillos'
  )
);

-- 4. Borrar los ejercicios viejos del catálogo
DELETE FROM exercises
WHERE name IN (
  'Movilidad de hombros',
  'Movilidad de muñecas',
  'Movilidad de cadera',
  'Movilidad de rodillas',
  'Movilidad de tobillos'
);
