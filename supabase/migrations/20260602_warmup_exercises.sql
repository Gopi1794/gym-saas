-- Ejercicios de precalentamiento / movilidad / activación
-- Sólo inserta si no existe ya un ejercicio con el mismo nombre (idempotente)

INSERT INTO exercises (name, category, muscle_groups, is_timed, description)
SELECT name, category, muscle_groups, is_timed, description
FROM (VALUES

  -- ── Cardio ligero ────────────────────────────────────────────────────────
  ('Caminadora',             'cardio',      ARRAY['piernas','glúteos'],           true,  'Cardio ligero en cinta. Velocidad baja, 5-10 min.'),
  ('Elíptica',               'cardio',      ARRAY['piernas','glúteos','espalda'], true,  'Cardio de bajo impacto en elíptica, 5-10 min.'),
  ('Bici estática',          'cardio',      ARRAY['cuádriceps','glúteos'],        true,  'Cardio ligero en bicicleta estática, 5-10 min.'),
  ('Saltar soga',            'cardio',      ARRAY['piernas','hombros'],           true,  'Salto de soga a ritmo moderado.'),

  -- ── Movilidad articular ──────────────────────────────────────────────────
  ('Movilidad de hombros',   'flexibility', ARRAY['hombros'],                     true,  'Círculos y rangos de movimiento del hombro.'),
  ('Movilidad de cadera',    'flexibility', ARRAY['caderas','glúteos'],           true,  'Rotaciones y aperturas de cadera.'),
  ('Movilidad de tobillos',  'flexibility', ARRAY['tobillos','pantorrillas'],     true,  'Círculos de tobillo y flexión dorsal.'),
  ('Movilidad de muñecas',   'flexibility', ARRAY['muñecas','antebrazos'],        true,  'Círculos y extensión de muñeca.'),
  ('Movilidad de rodillas',  'flexibility', ARRAY['rodillas','cuádriceps'],       true,  'Círculos y flexo-extensión de rodilla.'),
  ('Movilidad de columna',   'flexibility', ARRAY['espalda'],                     true,  'Cat-Cow y rotaciones de columna.'),
  ('Círculos de brazos',     'flexibility', ARRAY['hombros','espalda alta'],      true,  'Círculos amplios hacia adelante y atrás.'),
  ('Hip 90/90',              'flexibility', ARRAY['caderas','glúteos'],           true,  'Movilidad de cadera en posición 90/90 en el suelo.'),

  -- ── Zona media / Core ────────────────────────────────────────────────────
  ('Bicho muerto',           'strength',    ARRAY['core','lumbares'],             false, 'Contracción isométrica de core. Extender brazo y pierna opuestos.'),
  ('Elevación de cadera',    'strength',    ARRAY['glúteos','isquiotibiales'],    false, 'Puente de glúteos desde el suelo.'),
  ('Plancha',                'strength',    ARRAY['core','hombros'],              true,  'Plancha isométrica. Mantener posición con core activado.'),
  ('Plancha lateral',        'strength',    ARRAY['core','oblicuos'],             true,  'Plancha lateral isométrica.'),
  ('Rodamiento de pelota',   'balance',     ARRAY['core','lumbares'],             true,  'Movilidad lumbar rodando sobre pelota de foam.'),

  -- ── Activación SNC ───────────────────────────────────────────────────────
  ('Sentadilla con salto',   'hiit',        ARRAY['cuádriceps','glúteos','pantorrillas'], false, 'Sentadilla explosiva con salto. Activación del sistema nervioso.'),
  ('Arrancada con mancuerna','hiit',        ARRAY['hombros','glúteos','espalda'], false, 'Arrancada unilateral con mancuerna. Requiere técnica aprendida.'),
  ('Salto al cajón',         'hiit',        ARRAY['cuádriceps','glúteos'],        false, 'Box jump explosivo. Activación de cadena posterior.'),
  ('Estocada con salto',     'hiit',        ARRAY['cuádriceps','glúteos'],        false, 'Lunge jump alternando piernas. Alta activación neuromuscular.')

) AS t(name, category, muscle_groups, is_timed, description)
WHERE NOT EXISTS (
  SELECT 1 FROM exercises e WHERE e.name = t.name
);
