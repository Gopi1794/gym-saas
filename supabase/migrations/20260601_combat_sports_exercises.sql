-- Ejercicios para deportes de combate y entrenamiento atlético
INSERT INTO exercises (name, category, muscle_groups, is_timed, description)
VALUES
  -- Olímpicos / potencia
  ('clean con kettlebell',     'hiit',     ARRAY['piernas','espalda','hombros','core'], false, 'Movimiento olímpico adaptado con kettlebell. Trabaja potencia de cadena posterior.'),
  ('clean con mancuerna',      'hiit',     ARRAY['piernas','espalda','hombros','core'], false, 'Movimiento olímpico unilateral con mancuerna. Potencia y coordinación.'),
  ('high pull con barra',      'hiit',     ARRAY['espalda','hombros','piernas','trapecio'], false, 'Tirón alto explosivo. Precursor del arranque olímpico.'),
  ('segundo tiempo',           'hiit',     ARRAY['piernas','hombros','core'],           false, 'Push press explosivo desde rack o limpio. Potencia de tren superior.'),

  -- Pliométricos / explosivos
  ('sentadilla con salto',     'hiit',     ARRAY['piernas','gluteos'],                  false, 'Sentadilla con carga reducida (20-30% 1RM) y salto explosivo al tope.'),
  ('burpee box jump',          'hiit',     ARRAY['full body'],                          false, 'Burpee seguido de salto al cajón. Máxima potencia y capacidad aeróbica.'),
  ('box jump',                 'hiit',     ARRAY['piernas','gluteos'],                  false, 'Salto explosivo al cajón. Trabaja potencia de tren inferior.'),
  ('salto lateral con banda',  'hiit',     ARRAY['piernas','gluteos','abductores'],     false, 'Saltos laterales continuos con banda elástica en tobillos.'),
  ('salto en largo',           'hiit',     ARRAY['piernas','gluteos','core'],           false, 'Salto horizontal explosivo. Mide potencia de tren inferior.'),
  ('push-up pliométrico',      'hiit',     ARRAY['pecho','triceps','hombros'],          false, 'Flexión explosiva con despegue de manos. Potencia de tren superior.'),
  ('pull-up explosivo',        'hiit',     ARRAY['espalda','biceps'],                   false, 'Dominada con impulso explosivo, intentando llevar el pecho a la barra.'),

  -- Kettlebell
  ('swing con kettlebell',     'hiit',     ARRAY['gluteos','isquiotibiales','core','espalda'], false, 'Oscilación de kettlebell con bisagra de cadera. Base del entrenamiento con pesas rusas.'),

  -- Medicine ball
  ('medicine ball slam',       'hiit',     ARRAY['core','hombros','espalda'],           true,  'Lanzamiento explosivo de pelota al piso. Trabaja potencia y core anti-rotación.'),
  ('medicine ball chest pass', 'hiit',     ARRAY['pecho','triceps','hombros'],          false, 'Pase de pecho explosivo contra pared. Potencia de empuje horizontal.'),
  ('lanzamiento a la pared',   'hiit',     ARRAY['core','hombros','piernas'],           false, 'Lanzamiento rotacional de medicine ball contra pared. Potencia de rotación.'),
  ('lanzamiento al piso',      'hiit',     ARRAY['core','hombros','espalda'],           false, 'Slam de medicine ball al piso con rotación. Core y potencia total.'),

  -- Funcionales / combate
  ('sprints',                  'cardio',   ARRAY['piernas','gluteos'],                  true,  'Carreras de velocidad máxima. Distancia y descanso variables según objetivo.'),
  ('skipping alto',            'cardio',   ARRAY['piernas','core'],                     true,  'Carrera en el lugar con rodillas altas. Trabaja frecuencia de zancada y core.'),
  ('sombra',                   'cardio',   ARRAY['full body'],                          true,  'Boxeo o kickboxing en el aire. Trabaja técnica, ritmo y capacidad aeróbica.'),
  ('saltos en el lugar',       'hiit',     ARRAY['piernas','gluteos'],                  false, 'Saltos verticales continuos con máxima altura.'),
  ('saltos en caída desde cajón', 'hiit',  ARRAY['piernas','gluteos','core'],           false, 'Drop jump desde cajón. Entrena reflejos y absorción de impacto.'),
  ('desplazamientos laterales','hiit',     ARRAY['piernas','gluteos','abductores'],     false, 'Desplazamientos rápidos de cono a cono con carga. Agilidad lateral.'),
  ('pasos laterales con disco','hiit',     ARRAY['piernas','gluteos','abductores'],     false, 'Pasos laterales sosteniendo disco. Fuerza y agilidad de tren inferior.'),

  -- Fuerza funcional
  ('landmine press',           'strength', ARRAY['hombros','pecho','triceps','core'],   false, 'Press unilateral desde barra anclada al piso. Combina fuerza y rotación.'),
  ('rotación con cable',       'strength', ARRAY['core','oblicuos','hombros'],          false, 'Rotación de torso con polea. Anti-rotación y potencia rotacional.'),
  ('pallof press',             'strength', ARRAY['core','oblicuos'],                    false, 'Press isométrico con banda o polea. Anti-rotación de core.'),
  ('ab wheel',                 'strength', ARRAY['core','abdominales','hombros'],       false, 'Rueda abdominal. Uno de los mejores ejercicios para core total.'),
  ('russian twist con peso',   'strength', ARRAY['core','oblicuos'],                   false, 'Rotación de torso con disco o medicine ball. Core rotacional.'),
  ('dominadas lastradas',      'strength', ARRAY['espalda','biceps'],                   false, 'Dominadas con peso añadido en cinturón o chaleco.'),
  ('farmer walk',              'strength', ARRAY['antebrazo','trapecio','core','piernas'], false, 'Caminata con carga pesada. Fuerza de agarre, core y tren inferior.'),
  ('bicho muerto',             'strength', ARRAY['core','abdominales'],                 true,  'Dead bug. Ejercicio de estabilización de core en posición supina.'),
  ('zancada con mancuerna',    'strength', ARRAY['piernas','gluteos'],                  false, 'Estocada con mancuernas. Fuerza unilateral de tren inferior.')
ON CONFLICT DO NOTHING;
