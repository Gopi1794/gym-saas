-- =============================================================================
-- GymFlow — Seed de máquinas comunes + vinculación con ejercicios
-- Inserta las máquinas en TODOS los gyms y las vincula a la biblioteca global.
-- La vinculación usa ILIKE sobre el nombre del ejercicio, así funciona tanto
-- con el seed de demo como con ejercicios agregados manualmente.
-- Correr en Supabase SQL Editor — seguro repetir (ON CONFLICT DO NOTHING).
-- =============================================================================

DO $$
DECLARE
  gid uuid;
BEGIN
  FOR gid IN SELECT id FROM public.gyms LOOP

    -- ── 1. Insertar máquinas ────────────────────────────────────────────────
    INSERT INTO public.machines (gym_id, name, description) VALUES

    -- Tren inferior
    (gid, 'Prensa de Piernas',              'Cuádriceps, isquiotibiales y glúteos en posición supina'),
    (gid, 'Hack Squat',                     'Cuádriceps con espalda apoyada, menor carga lumbar que la sentadilla libre'),
    (gid, 'Extensión de Cuádriceps',        'Aislamiento del cuádriceps en posición sentada'),
    (gid, 'Curl Femoral Tumbado',           'Aislamiento de isquiotibiales en decúbito prono'),
    (gid, 'Curl Femoral Sentado',           'Aislamiento de isquiotibiales en posición sedente'),
    (gid, 'Abductor',                       'Músculos abductores de cadera y glúteo medio'),
    (gid, 'Aductor',                        'Músculos aductores de cadera e ingle'),
    (gid, 'Pantorrillas en Máquina',        'Gastrocnemio y sóleo de pie o sentado'),
    (gid, 'Hip Thrust en Máquina',          'Glúteo mayor con empuje de cadera horizontal'),

    -- Tren superior — empuje
    (gid, 'Press de Pecho en Máquina',      'Pectoral mayor, deltoides anterior y tríceps'),
    (gid, 'Peck Deck / Mariposa',           'Aislamiento del pectoral mayor con movimiento de aducción'),
    (gid, 'Press de Hombros en Máquina',    'Deltoides anterior y medio con soporte de respaldo'),
    (gid, 'Elevaciones Laterales en Máquina','Deltoides medio con recorrido guiado'),

    -- Tren superior — tirón
    (gid, 'Jalón al Pecho',                 'Dorsal ancho, romboides y bíceps en polea alta'),
    (gid, 'Remo en Máquina',                'Dorsal, trapecios y romboides con apoyo en el pecho'),
    (gid, 'Remo con Polea Baja',            'Espalda media y bíceps con polea al nivel del asiento'),

    -- Brazos
    (gid, 'Curl de Bíceps en Máquina',      'Bíceps braquial con recorrido guiado'),
    (gid, 'Predicador en Máquina',          'Bíceps en banco Scott, rango completo de movimiento'),
    (gid, 'Extensión de Tríceps en Polea',  'Tríceps con polea alta, agarre en cuerda o barra'),

    -- Multifunción
    (gid, 'Máquina Smith',                  'Barra guiada en rieles para press, sentadilla y remo'),
    (gid, 'Polea Doble / Crossover',        'Torre de poleas ajustable para pectoral, espalda y brazos'),

    -- Cardio
    (gid, 'Cinta de Correr',                'Cardio de bajo a alto impacto con velocidad e inclinación regulables'),
    (gid, 'Bicicleta Estática',             'Cardio de bajo impacto, ideal para calentamiento y recuperación'),
    (gid, 'Elíptica',                       'Cardio de bajo impacto que trabaja tren superior e inferior'),
    (gid, 'Remo Ergómetro',                 'Cardio de cuerpo completo: piernas, espalda, hombros y brazos')

    ON CONFLICT DO NOTHING;

    -- ── 2. Vincular con ejercicios de la biblioteca ─────────────────────────
    -- Usa ILIKE para matchear tanto el seed de demo como ejercicios propios.
    -- Si el ejercicio no existe en la biblioteca, no se crea el vínculo (sin error).

    INSERT INTO public.machine_exercises (machine_id, exercise_id)
    SELECT m.id, e.id
    FROM public.machines m
    CROSS JOIN public.exercises e
    WHERE m.gym_id = gid
      AND (
        -- Prensa de Piernas ← sentadilla / prensa / leg press
        (m.name = 'Prensa de Piernas' AND (
          e.name ILIKE '%sentadilla%' OR e.name ILIKE '%prensa de pierna%' OR e.name ILIKE '%leg press%'
        ))
        -- Hack Squat ← sentadilla / hack
        OR (m.name = 'Hack Squat' AND (
          e.name ILIKE '%hack squat%' OR e.name ILIKE '%sentadilla hack%'
        ))
        -- Extensión de Cuádriceps ← extensión cuádr / leg extension
        OR (m.name = 'Extensión de Cuádriceps' AND (
          e.name ILIKE '%extensión de cuádr%' OR e.name ILIKE '%leg extension%' OR e.name ILIKE '%extensión cuádr%'
        ))
        -- Curl Femoral ← curl femoral / leg curl / isquio
        OR (m.name IN ('Curl Femoral Tumbado', 'Curl Femoral Sentado') AND (
          e.name ILIKE '%curl femoral%' OR e.name ILIKE '%leg curl%' OR e.name ILIKE '%isquiotibial%'
        ))
        -- Abductor
        OR (m.name = 'Abductor' AND e.name ILIKE '%abductor%')
        -- Aductor
        OR (m.name = 'Aductor' AND e.name ILIKE '%aductor%')
        -- Pantorrillas
        OR (m.name = 'Pantorrillas en Máquina' AND (
          e.name ILIKE '%pantorrilla%' OR e.name ILIKE '%gemelo%' OR e.name ILIKE '%calf%'
        ))
        -- Hip Thrust ← hip thrust
        OR (m.name = 'Hip Thrust en Máquina' AND e.name ILIKE '%hip thrust%')
        -- Press de Pecho ← press de banca / press de pecho / bench press
        OR (m.name = 'Press de Pecho en Máquina' AND (
          e.name ILIKE '%press de banca%' OR e.name ILIKE '%press de pecho%' OR e.name ILIKE '%bench press%'
        ))
        -- Peck Deck ← mariposa / peck deck / aperturas / fly
        OR (m.name = 'Peck Deck / Mariposa' AND (
          e.name ILIKE '%mariposa%' OR e.name ILIKE '%peck deck%' OR e.name ILIKE '%apertura%' OR e.name ILIKE '% fly%'
        ))
        -- Press de Hombros ← press militar / press de hombros / shoulder press
        OR (m.name = 'Press de Hombros en Máquina' AND (
          e.name ILIKE '%press militar%' OR e.name ILIKE '%press de hombro%' OR e.name ILIKE '%shoulder press%'
        ))
        -- Elevaciones Laterales ← elevacion lateral / lateral raise
        OR (m.name = 'Elevaciones Laterales en Máquina' AND (
          e.name ILIKE '%elevacion lateral%' OR e.name ILIKE '%elevación lateral%' OR e.name ILIKE '%lateral raise%'
        ))
        -- Jalón al Pecho ← jalón / lat pulldown / dominadas
        OR (m.name = 'Jalón al Pecho' AND (
          e.name ILIKE '%jalón%' OR e.name ILIKE '%jalon%' OR e.name ILIKE '%lat pulldown%' OR e.name ILIKE '%dominada%'
        ))
        -- Remo en Máquina / Remo con Polea ← remo
        OR (m.name IN ('Remo en Máquina', 'Remo con Polea Baja') AND (
          e.name ILIKE '%remo%' OR e.name ILIKE '%rowing%'
        ))
        -- Curl de Bíceps / Predicador ← curl de bíceps / bicep curl / predicador
        OR (m.name = 'Curl de Bíceps en Máquina' AND (
          e.name ILIKE '%curl de bícep%' OR e.name ILIKE '%curl bicep%' OR e.name ILIKE '%bicep curl%'
        ))
        OR (m.name = 'Predicador en Máquina' AND (
          e.name ILIKE '%predicador%' OR e.name ILIKE '%scott%' OR e.name ILIKE '%curl de bícep%'
        ))
        -- Extensión de Tríceps ← extensión de tríceps / tricep
        OR (m.name = 'Extensión de Tríceps en Polea' AND (
          e.name ILIKE '%extensión de trícep%' OR e.name ILIKE '%extension de tricep%' OR e.name ILIKE '%tricep pushdown%'
        ))
        -- Máquina Smith ← sentadilla / press de banca / press militar / remo
        OR (m.name = 'Máquina Smith' AND (
          e.name ILIKE '%sentadilla%' OR e.name ILIKE '%press de banca%' OR e.name ILIKE '%press militar%' OR e.name ILIKE '%remo%'
        ))
        -- Polea Doble / Crossover ← cruce / apertura / fly / curl / extensión tríceps
        OR (m.name = 'Polea Doble / Crossover' AND (
          e.name ILIKE '%cruce%' OR e.name ILIKE '%crossover%' OR e.name ILIKE '%apertura%' OR e.name ILIKE '%curl de bícep%' OR e.name ILIKE '%extensión de trícep%'
        ))
        -- Cinta de Correr ← carrera / cinta / correr / running / treadmill
        OR (m.name = 'Cinta de Correr' AND (
          e.name ILIKE '%carrera%' OR e.name ILIKE '%cinta%' OR e.name ILIKE '%correr%' OR e.name ILIKE '%running%' OR e.name ILIKE '%treadmill%'
        ))
        -- Bicicleta Estática ← bicicleta / spinning / cycling
        OR (m.name = 'Bicicleta Estática' AND (
          e.name ILIKE '%bicicleta%' OR e.name ILIKE '%spinning%' OR e.name ILIKE '%cycling%'
        ))
        -- Elíptica ← elíptica / elliptical
        OR (m.name = 'Elíptica' AND (
          e.name ILIKE '%elíptica%' OR e.name ILIKE '%eliptica%' OR e.name ILIKE '%elliptical%'
        ))
        -- Remo Ergómetro ← remo ergómetro / concept / rowing
        OR (m.name = 'Remo Ergómetro' AND (
          e.name ILIKE '%remo ergómetro%' OR e.name ILIKE '%remo ergometro%' OR e.name ILIKE '%concept2%' OR e.name ILIKE '%rowing%'
        ))
      )
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;
