-- Seed: Split Semanal Completo
-- Lunes=Piernas · Martes=Espalda+Hombros · Miérc+Vier=Pecho
-- Juev+Sáb=Bíceps+Tríceps · Todos=Abdominales

DO $$
DECLARE
  v_gym_id   uuid;
  v_admin_id uuid;
  v_plan_id  uuid;
  v_day0     uuid;  -- Lunes
  v_day1     uuid;  -- Martes
  v_day2     uuid;  -- Miércoles
  v_day3     uuid;  -- Jueves
  v_day4     uuid;  -- Viernes
  v_day5     uuid;  -- Sábado
BEGIN

  SELECT id INTO v_gym_id  FROM gyms    LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles
    WHERE gym_id = v_gym_id AND role IN ('admin','trainer') LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. INSERTAR EJERCICIOS (idempotente por nombre)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO exercises (name, category, muscle_groups, is_timed)
  SELECT t.name, t.cat, t.mg, t.timed
  FROM (VALUES
    -- PIERNAS
    ('sentadillas con barra',          'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('sentadillas con disco',           'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('sentadillas con mancuerna',       'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('sillón de cuádriceps',           'strength', ARRAY['cuadriceps'],                         false),
    ('sentadillas hack',               'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('prensa',                         'strength', ARRAY['cuadriceps','glúteos','isquiotibiales'],false),
    ('step up',                        'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('abducción en máquina',           'strength', ARRAY['aductores','glúteos'],                false),
    ('sentadilla sumo',                'strength', ARRAY['aductores','cuadriceps','glúteos'],   false),
    ('búlgaras',                       'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('pull through',                   'strength', ARRAY['glúteos','isquiotibiales'],           false),
    ('hip thrust',                     'strength', ARRAY['glúteos','isquiotibiales'],           false),
    ('peso muerto convencional',       'strength', ARRAY['isquiotibiales','glúteos','espalda baja'],false),
    ('peso muerto rumano',             'strength', ARRAY['isquiotibiales','glúteos'],           false),
    ('desplazamientos',                'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('mountain climbers',              'cardio',   ARRAY['core','cuadriceps'],                  false),
    ('puente isométrico',              'strength', ARRAY['glúteos','isquiotibiales'],           true),
    ('puente ranita',                  'strength', ARRAY['glúteos','isquiotibiales'],           false),
    ('gemelos en máquina',             'strength', ARRAY['pantorrillas'],                       false),
    ('gemelos en switch',              'strength', ARRAY['pantorrillas'],                       false),
    ('gemelos en prensa',              'strength', ARRAY['pantorrillas'],                       false),
    ('estocadas adelante',             'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('estocadas atrás',               'strength', ARRAY['cuadriceps','glúteos'],               false),
    ('estocadas cruzadas',             'strength', ARRAY['cuadriceps','glúteos','aductores'],   false),
    ('camilla de isquiotibiales',      'strength', ARRAY['isquiotibiales'],                     false),
    ('hack para isquio',               'strength', ARRAY['isquiotibiales'],                     false),
    ('peso muerto unilateral',         'strength', ARRAY['isquiotibiales','glúteos'],           false),
    ('buenos días',                   'strength', ARRAY['isquiotibiales','espalda baja'],      false),
    -- ESPALDA
    ('dominadas',                      'strength', ARRAY['dorsal','bíceps'],                    false),
    ('remo trx',                       'strength', ARRAY['dorsal','romboides'],                 false),
    ('seal row',                       'strength', ARRAY['dorsal','romboides'],                 false),
    ('dorsalera abierto',              'strength', ARRAY['dorsal'],                             false),
    ('dorsalera cerrado',              'strength', ARRAY['dorsal'],                             false),
    ('remo bajo abierto',              'strength', ARRAY['dorsal','romboides'],                 false),
    ('remo bajo cerrado',              'strength', ARRAY['dorsal','romboides'],                 false),
    ('remo bajo unilateral',           'strength', ARRAY['dorsal'],                             false),
    ('remo con barra',                 'strength', ARRAY['dorsal','trapecio'],                  false),
    ('remo t',                         'strength', ARRAY['dorsal','romboides'],                 false),
    ('serrucho con mancuerna',         'strength', ARRAY['dorsal'],                             false),
    ('pull over polea abierto',        'strength', ARRAY['dorsal','pectoral'],                  false),
    ('pull over polea soga',           'strength', ARRAY['dorsal','pectoral'],                  false),
    ('pull over con mancuerna',        'strength', ARRAY['dorsal','pectoral'],                  false),
    ('encogimiento',                   'strength', ARRAY['trapecio'],                           false),
    ('face pull',                      'strength', ARRAY['deltoides posterior','trapecio'],     false),
    -- HOMBROS
    ('press militar con barra',        'strength', ARRAY['deltoides','tríceps'],               false),
    ('press militar con mancuerna',    'strength', ARRAY['deltoides','tríceps'],               false),
    ('press con mancuerna agarre supino','strength',ARRAY['deltoides'],                         false),
    ('press arnold',                   'strength', ARRAY['deltoides','tríceps'],               false),
    ('frontal con barra agarre supino','strength', ARRAY['deltoides anterior'],                 false),
    ('frontales con barra agarre prono','strength',ARRAY['deltoides anterior'],                 false),
    ('frontales con disco',            'strength', ARRAY['deltoides anterior'],                 false),
    ('laterales con mancuerna',        'strength', ARRAY['deltoides lateral'],                  false),
    ('laterales con polea',            'strength', ARRAY['deltoides lateral'],                  false),
    ('posterior parado',               'strength', ARRAY['deltoides posterior'],                false),
    ('posterior en banco',             'strength', ARRAY['deltoides posterior'],                false),
    -- PECHO
    ('press plano',                    'strength', ARRAY['pectoral','tríceps','deltoides'],    false),
    ('apertura en plano',              'strength', ARRAY['pectoral'],                           false),
    ('press inclinado',                'strength', ARRAY['pectoral superior','tríceps'],       false),
    ('apertura inclinado',             'strength', ARRAY['pectoral superior'],                  false),
    ('press declinado',                'strength', ARRAY['pectoral inferior','tríceps'],       false),
    ('apertura declinado',             'strength', ARRAY['pectoral inferior'],                  false),
    ('cruces con mancuernas sentado',  'strength', ARRAY['pectoral'],                           false),
    ('press inclinado smith',          'strength', ARRAY['pectoral superior','tríceps'],       false),
    ('cruces en polea alta',           'strength', ARRAY['pectoral'],                           false),
    ('cruces en polea baja',           'strength', ARRAY['pectoral superior'],                  false),
    ('flexiones abiertas',             'strength', ARRAY['pectoral','tríceps'],               false),
    ('peck deck',                      'strength', ARRAY['pectoral'],                           false),
    ('svend press',                    'strength', ARRAY['pectoral'],                           false),
    ('press con mancuerna pecho',      'strength', ARRAY['pectoral','tríceps'],               false),
    -- BÍCEPS
    ('curl con barra recta',           'strength', ARRAY['bíceps','antebrazos'],              false),
    ('curl concentrado',               'strength', ARRAY['bíceps'],                             false),
    ('curl con barra w en scott',      'strength', ARRAY['bíceps'],                             false),
    ('spider curl',                    'strength', ARRAY['bíceps'],                             false),
    ('curl martillo',                  'strength', ARRAY['bíceps','antebrazos'],              false),
    ('curl alternado inclinado',       'strength', ARRAY['bíceps'],                             false),
    ('curl martillo inclinado',        'strength', ARRAY['bíceps','antebrazos'],              false),
    ('curl alternado parado',          'strength', ARRAY['bíceps'],                             false),
    ('curl alternado sentado',         'strength', ARRAY['bíceps'],                             false),
    ('curl en polea con soga',         'strength', ARRAY['bíceps'],                             false),
    ('curl en polea con barra',        'strength', ARRAY['bíceps'],                             false),
    ('extensión de bíceps en polea alta','strength',ARRAY['bíceps'],                           false),
    ('curl 21',                        'strength', ARRAY['bíceps'],                             false),
    ('martillo con disco',             'strength', ARRAY['bíceps','antebrazos'],              false),
    -- TRÍCEPS
    ('flexiones cerradas',             'strength', ARRAY['tríceps','pectoral'],               false),
    ('extensión 2 brazos',            'strength', ARRAY['tríceps'],                            false),
    ('extensión trx',                 'strength', ARRAY['tríceps'],                            false),
    ('press francés con mancuerna',   'strength', ARRAY['tríceps'],                            false),
    ('press francés con barra',       'strength', ARRAY['tríceps'],                            false),
    ('extensión polea tras nuca',     'strength', ARRAY['tríceps'],                            false),
    ('fondos en paralelas',            'strength', ARRAY['tríceps','pectoral','deltoides'],   false),
    ('fondos blancos',                 'strength', ARRAY['tríceps','pectoral'],               false),
    ('press cerrado con barra',        'strength', ARRAY['tríceps','pectoral'],               false),
    ('tríceps en polea con banco inclinado','strength',ARRAY['tríceps'],                       false),
    ('tríceps en polea con barra',    'strength', ARRAY['tríceps'],                            false),
    ('tríceps en polea con soga',     'strength', ARRAY['tríceps'],                            false),
    ('extensión de tríceps 1 brazo', 'strength', ARRAY['tríceps'],                            false),
    -- ABDOMINALES
    ('plancha',                        'strength', ARRAY['core','abdominales'],                true),
    ('cruzados',                       'strength', ARRAY['oblicuos'],                          false),
    ('elevación de rodillas',         'strength', ARRAY['abdominales','flexores cadera'],     false),
    ('toque de puntas de pie',         'strength', ARRAY['abdominales'],                        false),
    ('abs ruedita',                    'strength', ARRAY['core','abdominales'],                false),
    ('toque de talones',               'strength', ARRAY['oblicuos'],                          false),
    ('plancha escalador',              'cardio',   ARRAY['core','cuadriceps'],                  false),
    ('plancha lateral',                'strength', ARRAY['oblicuos','core'],                   true),
    ('oblicuos con manteca',           'strength', ARRAY['oblicuos'],                          false),
    ('oblicuos con balón',            'strength', ARRAY['oblicuos'],                          false),
    ('elevación de piernas en paralela','strength',ARRAY['abdominales','flexores cadera'],    false),
    ('espinales cruzados',             'strength', ARRAY['espalda baja'],                       false),
    ('nadador',                        'strength', ARRAY['espalda baja','glúteos'],            false),
    ('saltos al step',                 'cardio',   ARRAY['pantorrillas','cuadriceps'],          false),
    ('bicicleta',                      'cardio',   ARRAY['abdominales','oblicuos'],             false),
    ('abdominales en declinado',       'strength', ARRAY['abdominales'],                        false)
  ) AS t(name, cat, mg, timed)
  WHERE NOT EXISTS (
    SELECT 1 FROM exercises e WHERE lower(e.name) = lower(t.name)
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. PLAN
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plans (name, description, is_template, gym_id, created_by, assigned_to)
  VALUES (
    'Split Semanal Completo',
    'Lunes: Piernas · Martes: Espalda/Hombros · Miérc+Vier: Pecho · Juev+Sáb: Bíceps/Tríceps · Abdominales todos los días',
    true, v_gym_id, v_admin_id, null
  )
  RETURNING id INTO v_plan_id;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. DÍAS
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 0) RETURNING id INTO v_day0;
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 1) RETURNING id INTO v_day1;
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 2) RETURNING id INTO v_day2;
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 3) RETURNING id INTO v_day3;
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 4) RETURNING id INTO v_day4;
  INSERT INTO workout_plan_days (plan_id, day_of_week) VALUES (v_plan_id, 5) RETURNING id INTO v_day5;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. LUNES — PIERNAS
  -- sets, reps, reps_max, rest_seconds, phase, notes, order_index
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_exercises
    (day_id, exercise_id, sets, reps, reps_max, rest_seconds, phase, notes, order_index)
  SELECT v_day0, e.id, t.s::smallint, t.r::smallint, t.rm::smallint, t.rest::smallint, 'main'::text, t.note::text, t.ord::int
  FROM (VALUES
    ('sentadillas con barra',       3, 10, NULL, 120, 'Con barra 30 kg',             1),
    ('sentadillas con disco',        3, 10, NULL,  90, NULL,                          2),
    ('sentadillas con mancuerna',    3, 10, NULL,  90, NULL,                          3),
    ('sillón de cuádriceps',        4,  8, NULL,  90, '65 kg',                       4),
    ('sentadillas hack',             3, 10, NULL,  90, NULL,                          5),
    ('prensa',                       5, 10, NULL, 120, '95 kg',                       6),
    ('step up',                      3, 10, NULL,  60, NULL,                          7),
    ('abducción en máquina',        3, 10, NULL,  60, NULL,                          8),
    ('sentadilla sumo',              3, 12, NULL,  90, '20 kg',                       9),
    ('búlgaras',                    3, 10, NULL,  90, NULL,                         10),
    ('pull through',                 3, 10, NULL,  90, NULL,                         11),
    ('hip thrust',                   3, 10, NULL,  90, NULL,                         12),
    ('peso muerto convencional',     3, 10, NULL, 120, NULL,                         13),
    ('peso muerto rumano',           3, 10, NULL, 120, NULL,                         14),
    ('desplazamientos',              3, 10, NULL,  60, NULL,                         15),
    ('mountain climbers',            3, 10, NULL,  60, NULL,                         16),
    ('puente isométrico',           3, 30, NULL,  60, 'Tiempo en segundos',         17),
    ('puente ranita',                3, 10, NULL,  60, NULL,                         18),
    ('gemelos en máquina',          3, 10, NULL,  60, NULL,                         19),
    ('gemelos en switch',            4, 20, NULL,  60, '30 kg',                      20),
    ('gemelos en prensa',            4, 20, NULL,  60, '80 kg',                      21),
    ('estocadas adelante',           3, 20, NULL,  90, '20 kg',                      22),
    ('estocadas atrás',             3, 10, NULL,  90, NULL,                         23),
    ('estocadas cruzadas',           3, 10, NULL,  90, NULL,                         24),
    ('camilla de isquiotibiales',    4, 10, NULL,  90, '3 apoyos',                   25),
    ('hack para isquio',             3, 10, NULL,  90, NULL,                         26),
    ('peso muerto unilateral',       3, 10, NULL, 120, NULL,                         27),
    ('buenos días',                 3, 10, NULL,  90, NULL,                         28)
  ) AS t(name, s, r, rm, rest, note, ord)
  JOIN exercises e ON lower(e.name) = lower(t.name);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. MARTES — ESPALDA Y HOMBROS
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_exercises
    (day_id, exercise_id, sets, reps, reps_max, rest_seconds, phase, notes, order_index)
  SELECT v_day1, e.id, t.s::smallint, t.r::smallint, t.rm::smallint, t.rest::smallint, 'main'::text, t.note::text, t.ord::int
  FROM (VALUES
    ('dominadas',                     3,  8, NULL, 120, NULL,                          1),
    ('remo trx',                      3, 10, NULL,  90, NULL,                          2),
    ('seal row',                      3, 10, NULL,  90, NULL,                          3),
    ('dorsalera abierto',             4, 10, NULL,  90, '45 kg',                       4),
    ('dorsalera cerrado',             4, 10, NULL,  90, '45 kg',                       5),
    ('remo bajo abierto',             3, 10, NULL,  90, NULL,                          6),
    ('remo bajo cerrado',             3, 10, NULL,  90, NULL,                          7),
    ('remo bajo unilateral',          3, 10, NULL,  90, NULL,                          8),
    ('remo con barra',                3, 10, NULL,  90, NULL,                          9),
    ('remo t',                        4, 10, NULL,  90, '30 kg',                      10),
    ('serrucho con mancuerna',        3, 10, NULL,  90, NULL,                         11),
    ('pull over polea abierto',       3, 10, NULL,  90, NULL,                         12),
    ('pull over polea soga',          3, 10, NULL,  90, NULL,                         13),
    ('pull over con mancuerna',       3, 10, NULL,  90, NULL,                         14),
    ('encogimiento',                  3, 15, NULL,  60, '50 kg',                      15),
    ('face pull',                     3, 10, NULL,  60, NULL,                         16),
    ('press militar con barra',       4, 11, NULL, 120, '17,5 kg + barra',            17),
    ('press militar con mancuerna',   3, 10, NULL, 120, NULL,                         18),
    ('press con mancuerna agarre supino', 3, 10, NULL, 90, NULL,                      19),
    ('press arnold',                  3, 10, NULL,  90, NULL,                         20),
    ('frontal con barra agarre supino', 3, 10, NULL, 60, NULL,                        21),
    ('frontales con barra agarre prono', 3, 10, NULL, 60, NULL,                       22),
    ('frontales con disco',           3, 10, NULL,  60, NULL,                         23),
    ('laterales con mancuerna',       3, 15, NULL,  60, '13 kg',                      24),
    ('laterales con polea',           3, 10, NULL,  60, NULL,                         25),
    ('posterior parado',              3, 10, NULL,  60, NULL,                         26),
    ('posterior en banco',            3, 10, NULL,  60, NULL,                         27)
  ) AS t(name, s, r, rm, rest, note, ord)
  JOIN exercises e ON lower(e.name) = lower(t.name);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. MIÉRCOLES Y VIERNES — PECHO (insertamos en ambos días)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_exercises
    (day_id, exercise_id, sets, reps, reps_max, rest_seconds, phase, notes, order_index)
  SELECT d.day_id, e.id, t.s::smallint, t.r::smallint, t.rm::smallint, t.rest::smallint, 'main'::text, t.note::text, t.ord::int
  FROM (SELECT unnest(ARRAY[v_day2, v_day4]) AS day_id) d
  CROSS JOIN (VALUES
    ('press plano',                   4, 10, NULL, 120, '25 kg + barra',               1),
    ('apertura en plano',             3, 15, NULL,  90, '24 kg',                        2),
    ('press inclinado',               4, 10, NULL, 120, '30 kg',                        3),
    ('apertura inclinado',            3, 15, NULL,  90, '24 kg',                        4),
    ('press declinado',               3, 10, NULL, 120, NULL,                           5),
    ('apertura declinado',            3, 10, NULL,  90, NULL,                           6),
    ('cruces con mancuernas sentado', 3, 10, NULL,  90, NULL,                           7),
    ('press inclinado smith',         3, 10, NULL, 120, NULL,                           8),
    ('cruces en polea alta',          3, 10, NULL,  90, NULL,                           9),
    ('cruces en polea baja',          3, 10, NULL,  90, NULL,                          10),
    ('flexiones abiertas',            3, 10, NULL,  60, NULL,                          11),
    ('peck deck',                     3, 10, NULL,  90, '20 kg',                       12),
    ('svend press',                   5, 10, NULL,  60, NULL,                          13),
    ('press con mancuerna pecho',     3, 10, NULL,  90, NULL,                          14)
  ) AS t(name, s, r, rm, rest, note, ord)
  JOIN exercises e ON lower(e.name) = lower(t.name);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 7. JUEVES Y SÁBADO — BÍCEPS Y TRÍCEPS
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_exercises
    (day_id, exercise_id, sets, reps, reps_max, rest_seconds, phase, notes, order_index)
  SELECT d.day_id, e.id, t.s::smallint, t.r::smallint, t.rm::smallint, t.rest::smallint, 'main'::text, t.note::text, t.ord::int
  FROM (SELECT unnest(ARRAY[v_day3, v_day5]) AS day_id) d
  CROSS JOIN (VALUES
    ('curl con barra recta',           4, 10, NULL, 90, '15 kg',                        1),
    ('curl concentrado',               3, 10, NULL, 60, NULL,                            2),
    ('curl con barra w en scott',      3, 10, NULL, 90, NULL,                            3),
    ('spider curl',                    3, 10, NULL, 90, NULL,                            4),
    ('curl martillo',                  3, 10, NULL, 90, '9 kg',                          5),
    ('curl alternado inclinado',       3, 10, NULL, 90, NULL,                            6),
    ('curl martillo inclinado',        3, 10, NULL, 90, NULL,                            7),
    ('curl alternado parado',          3, 20, NULL, 60, '8 kg',                          8),
    ('curl alternado sentado',         3, 10, NULL, 90, NULL,                            9),
    ('curl en polea con soga',         3, 10, NULL, 60, NULL,                           10),
    ('curl en polea con barra',        3, 10, NULL, 60, NULL,                           11),
    ('extensión de bíceps en polea alta', 3, 10, NULL, 60, NULL,                        12),
    ('curl 21',                        2, 21, NULL, 90, '10 kg',                        13),
    ('martillo con disco',             3, 10, NULL, 90, NULL,                           14),
    ('flexiones cerradas',             3, 10, NULL, 60, NULL,                           15),
    ('extensión 2 brazos',            4, 12, NULL, 90, '5 kg c/mano',                  16),
    ('extensión trx',                 3, 10, NULL, 90, NULL,                           17),
    ('press francés con mancuerna',   3, 10, NULL, 90, NULL,                           18),
    ('press francés con barra',       3, 10, NULL, 90, NULL,                           19),
    ('extensión polea tras nuca',     3, 10, NULL, 90, NULL,                           20),
    ('fondos en paralelas',            3, 10, NULL, 90, NULL,                           21),
    ('fondos blancos',                 3, 10, NULL, 90, NULL,                           22),
    ('press cerrado con barra',        3, 10, NULL, 90, NULL,                           23),
    ('tríceps en polea con banco inclinado', 3, 10, NULL, 60, NULL,                     24),
    ('tríceps en polea con barra',    3, 12, NULL, 60, '35 kg',                        25),
    ('tríceps en polea con soga',     3, 10, NULL, 60, NULL,                           26),
    ('extensión de tríceps 1 brazo', 3, 10, NULL, 60, NULL,                           27)
  ) AS t(name, s, r, rm, rest, note, ord)
  JOIN exercises e ON lower(e.name) = lower(t.name);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 8. ABDOMINALES — todos los días (order_index 100+)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO workout_plan_exercises
    (day_id, exercise_id, sets, reps, reps_max, rest_seconds, phase, notes, order_index)
  SELECT d.day_id, e.id, t.s::smallint, t.r::smallint, t.rm::smallint, t.rest::smallint, 'main'::text, t.note::text, t.ord::int + 100
  FROM (SELECT unnest(ARRAY[v_day0, v_day1, v_day2, v_day3, v_day4, v_day5]) AS day_id) d
  CROSS JOIN (VALUES
    ('plancha',                         3, 30, NULL, 60, 'Tiempo en segundos',   1),
    ('cruzados',                        3, 10, NULL, 60, NULL,                    2),
    ('elevación de rodillas',          3, 10, NULL, 60, NULL,                    3),
    ('toque de puntas de pie',          3, 10, NULL, 60, NULL,                    4),
    ('abs ruedita',                     3, 10, NULL, 60, NULL,                    5),
    ('toque de talones',                3, 10, NULL, 60, NULL,                    6),
    ('plancha escalador',               3, 10, NULL, 60, NULL,                    7),
    ('plancha lateral',                 3, 30, NULL, 60, 'Tiempo en segundos',   8),
    ('oblicuos con manteca',            3, 10, NULL, 60, NULL,                    9),
    ('oblicuos con balón',             3, 10, NULL, 60, NULL,                   10),
    ('elevación de piernas en paralela',3, 10, NULL, 60, NULL,                   11),
    ('espinales cruzados',              3, 10, NULL, 60, NULL,                   12),
    ('nadador',                         3, 10, NULL, 60, NULL,                   13),
    ('saltos al step',                  3, 10, NULL, 60, NULL,                   14),
    ('bicicleta',                       3, 10, NULL, 60, NULL,                   15),
    ('abdominales en declinado',        3, 10, NULL, 60, NULL,                   16)
  ) AS t(name, s, r, rm, rest, note, ord)
  JOIN exercises e ON lower(e.name) = lower(t.name);

END $$;
