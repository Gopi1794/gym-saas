  -- =============================================================================
  -- GymFlow — Seed de demo
  -- gym_id : 00000000-0000-0000-0000-000000000001
  -- admin  : c9dda43f-2e2c-4dee-8edf-08d4a0d0de71
  -- Correr en Supabase SQL Editor (tiene permisos de service role)
  -- Para limpiar: ejecutar seed_demo_cleanup.sql
  -- =============================================================================

  -- PASO PREVIO: Correr primero supabase/create_demo_users.ts para crear los auth.users
  -- npx tsx supabase/create_demo_users.ts

  -- ── 1. Profiles ───────────────────────────────────────────────────────────────
  INSERT INTO profiles (id, full_name, avatar_url, role, gym_id, membership_type, membership_expires_at, gender, total_xp, date_of_birth, weight_kg, height_cm, goal, training_frequency, trainer_id, onboarding_seen) VALUES
    ('a1000000-0000-0000-0000-000000000001','Lucas Martínez',   'https://randomuser.me/api/portraits/men/32.jpg',    'member','00000000-0000-0000-0000-000000000001','premium',now()+interval'18 days', 'male',  2450,'1997-03-15',78,178,'gain_muscle','5+',  'c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true),
    ('a1000000-0000-0000-0000-000000000002','Valentina García',  'https://randomuser.me/api/portraits/women/44.jpg',   'member','00000000-0000-0000-0000-000000000001','vip',    now()+interval'55 days', 'female',1820,'2000-07-22',62,165,'lose_weight','3-4','c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true),
    ('a1000000-0000-0000-0000-000000000003','Matías Rodríguez',  'https://randomuser.me/api/portraits/men/45.jpg',    'member','00000000-0000-0000-0000-000000000001','basic',  now()+interval'8 days',  'male',   890,'1994-11-08',85,182,'performance','5+',  'c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true),
    ('a1000000-0000-0000-0000-000000000004','Sofía Herrera',     'https://randomuser.me/api/portraits/women/28.jpg',   'member','00000000-0000-0000-0000-000000000001','premium',now()+interval'42 days', 'female',3210,'1990-05-30',57,160,'maintain',  '3-4','c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true),
    ('a1000000-0000-0000-0000-000000000005','Federico López',    'https://randomuser.me/api/portraits/men/67.jpg',    'member','00000000-0000-0000-0000-000000000001','basic',  now()+interval'25 days', 'male',   445,'2002-01-19',72,175,'gain_muscle','1-2','c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true),
    ('a1000000-0000-0000-0000-000000000006','Camila Torres',     'https://randomuser.me/api/portraits/women/55.jpg',   'member','00000000-0000-0000-0000-000000000001','vip',    now()+interval'60 days', 'female',1560,'1998-09-04',65,168,'lose_weight','3-4','c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',true)
  ON CONFLICT (id) DO UPDATE SET
    full_name            = EXCLUDED.full_name,
    avatar_url           = EXCLUDED.avatar_url,
    role                 = EXCLUDED.role,
    gym_id               = EXCLUDED.gym_id,
    membership_type      = EXCLUDED.membership_type,
    membership_expires_at= EXCLUDED.membership_expires_at,
    gender               = EXCLUDED.gender,
    total_xp             = EXCLUDED.total_xp,
    date_of_birth        = EXCLUDED.date_of_birth,
    weight_kg            = EXCLUDED.weight_kg,
    height_cm            = EXCLUDED.height_cm,
    goal                 = EXCLUDED.goal,
    training_frequency   = EXCLUDED.training_frequency,
    trainer_id           = EXCLUDED.trainer_id,
    onboarding_seen      = EXCLUDED.onboarding_seen;

  -- ── 3. Planes de membresía ────────────────────────────────────────────────────
  INSERT INTO membership_plans (id, gym_id, type, label, price, duration_days, features) VALUES
    ('c2000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','basic',  'Basic Flow',   8000,  30, ARRAY['Acceso sala principal','Vestuarios','App GymFlow']),
    ('c2000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','premium','Premium Flow', 14000, 30, ARRAY['Todo Basic','Clases grupales','Plan de entrenamiento personalizado','Chat con IA']),
    ('c2000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','vip',    'VIP Flow',     22000, 30, ARRAY['Todo Premium','Plan nutricional','Seguimiento semanal','Acceso 24hs'])
  ON CONFLICT (gym_id, type) DO UPDATE
    SET label = EXCLUDED.label, price = EXCLUDED.price, features = EXCLUDED.features;

  -- ── 4. Ejercicios ─────────────────────────────────────────────────────────────
  INSERT INTO exercises (id, name, description, category, muscle_groups, is_timed) VALUES
    ('b1000000-0000-0000-0000-000000000001','Sentadilla con barra',     'Movimiento compuesto para tren inferior',         'strength',ARRAY['glutes','quadriceps','hamstrings'],false),
    ('b1000000-0000-0000-0000-000000000002','Press de banca plano',     'Ejercicio básico de pecho con barra',             'strength',ARRAY['chest','triceps','shoulders'],    false),
    ('b1000000-0000-0000-0000-000000000003','Peso muerto convencional', 'Movimiento compuesto de cadena posterior',        'strength',ARRAY['back','glutes','hamstrings'],     false),
    ('b1000000-0000-0000-0000-000000000004','Dominadas',                'Jalón vertical con peso corporal',                'strength',ARRAY['back','biceps'],                  false),
    ('b1000000-0000-0000-0000-000000000005','Press militar',            'Press de hombros con barra en pie',               'strength',ARRAY['shoulders','triceps'],             false),
    ('b1000000-0000-0000-0000-000000000006','Remo con barra',           'Tirón horizontal para espalda media',             'strength',ARRAY['back','biceps'],                  false),
    ('b1000000-0000-0000-0000-000000000007','Curl de bíceps',           'Flexión de codo con mancuernas',                  'strength',ARRAY['biceps'],                         false),
    ('b1000000-0000-0000-0000-000000000008','Extensión de tríceps',     'Extensión de codo en polea alta',                 'strength',ARRAY['triceps'],                        false),
    ('b1000000-0000-0000-0000-000000000009','Carrera en cinta',         'Cardio aeróbico en cinta',                        'cardio',  ARRAY['legs'],                           true),
    ('b1000000-0000-0000-0000-000000000010','Plancha frontal',          'Isometría de core',                               'strength',ARRAY['core'],                           true),
    ('b1000000-0000-0000-0000-000000000011','Hip Thrust',               'Empuje de cadera con barra para glúteos',         'strength',ARRAY['glutes','hamstrings'],             false),
    ('b1000000-0000-0000-0000-000000000012','Zancadas caminando',       'Estocadas con mancuernas en movimiento',          'strength',ARRAY['quadriceps','glutes'],             false)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Planes de entrenamiento ────────────────────────────────────────────────
  INSERT INTO workout_plans (id, gym_id, name, description, created_by, assigned_to, level) VALUES
    ('c1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Fuerza Máxima 4x',        'Programa de fuerza con énfasis en movimientos básicos. 4 días por semana.',                    'c9dda43f-2e2c-4dee-8edf-08d4a0d0de71','a1000000-0000-0000-0000-000000000001','intermediate'),
    ('c1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Cardio + Tonificación',   'Combinación de cardio y trabajo muscular para definición. Ideal para pérdida de peso.',         'c9dda43f-2e2c-4dee-8edf-08d4a0d0de71','a1000000-0000-0000-0000-000000000002','beginner'),
    ('c1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Rendimiento Atlético',    'Programa de alta intensidad para mejorar potencia, velocidad y resistencia deportiva.',          'c9dda43f-2e2c-4dee-8edf-08d4a0d0de71','a1000000-0000-0000-0000-000000000003','advanced')
  ON CONFLICT (id) DO NOTHING;

  -- Días — Plan 1: Fuerza Máxima 4x (Lun/Mar/Jue/Vie)
  INSERT INTO workout_plan_days (id, plan_id, day_of_week, name) VALUES
    ('d1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',1,'Piernas'),
    ('d1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001',2,'Pecho y Hombros'),
    ('d1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001',4,'Espalda y Bíceps'),
    ('d1000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000001',5,'Full Body + Core')
  ON CONFLICT (id) DO NOTHING;

  -- Días — Plan 2: Cardio + Tonificación (Lun/Mie/Vie)
  INSERT INTO workout_plan_days (id, plan_id, day_of_week, name) VALUES
    ('d1000000-0000-0000-0000-000000000005','c1000000-0000-0000-0000-000000000002',1,'Cardio + Tren inferior'),
    ('d1000000-0000-0000-0000-000000000006','c1000000-0000-0000-0000-000000000002',3,'Full Body'),
    ('d1000000-0000-0000-0000-000000000007','c1000000-0000-0000-0000-000000000002',5,'Cardio + Core')
  ON CONFLICT (id) DO NOTHING;

  -- Días — Plan 3: Rendimiento Atlético (Lun/Mar/Jue/Vie/Sab)
  INSERT INTO workout_plan_days (id, plan_id, day_of_week, name) VALUES
    ('d1000000-0000-0000-0000-000000000008','c1000000-0000-0000-0000-000000000003',1,'Fuerza Lower'),
    ('d1000000-0000-0000-0000-000000000009','c1000000-0000-0000-0000-000000000003',2,'Fuerza Upper'),
    ('d1000000-0000-0000-0000-000000000010','c1000000-0000-0000-0000-000000000003',4,'Potencia + HIIT'),
    ('d1000000-0000-0000-0000-000000000011','c1000000-0000-0000-0000-000000000003',5,'Resistencia'),
    ('d1000000-0000-0000-0000-000000000012','c1000000-0000-0000-0000-000000000003',6,'Cardio Activo')
  ON CONFLICT (id) DO NOTHING;

  -- Ejercicios en días — Plan 1: Piernas
  INSERT INTO workout_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index, phase) VALUES
    ('d1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',5, 5, 180,0,'main'),
    ('d1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000011',4,10, 90, 1,'main'),
    ('d1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000012',3,12, 60, 2,'main'),
    ('d1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000010',3, 1, 60, 3,'cooldown');

  -- Pecho y Hombros
  INSERT INTO workout_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index, phase) VALUES
    ('d1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002',5, 5, 180,0,'main'),
    ('d1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000005',4, 8, 120,1,'main'),
    ('d1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000008',3,12, 60, 2,'main');

  -- Espalda y Bíceps
  INSERT INTO workout_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index, phase) VALUES
    ('d1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000003',4, 5, 180,0,'main'),
    ('d1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000006',4, 8, 120,1,'main'),
    ('d1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000004',3, 6, 120,2,'main'),
    ('d1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000007',3,12, 60, 3,'main');

  -- Full Body + Core
  INSERT INTO workout_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index, phase) VALUES
    ('d1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000002',3, 8, 120,0,'main'),
    ('d1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000001',3, 8, 120,1,'main'),
    ('d1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000009',1, 1,  0, 2,'cooldown'),
    ('d1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000010',3, 1, 60, 3,'cooldown');

  -- Ejercicios Plan 2: Cardio + Tonificación
  INSERT INTO workout_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index, phase) VALUES
    ('d1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000009',1, 1,  0, 0,'main'),
    ('d1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000012',3,15, 45, 1,'main'),
    ('d1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000011',3,15, 45, 2,'main'),
    ('d1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000001',3,12, 90, 0,'main'),
    ('d1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000002',3,12, 90, 1,'main'),
    ('d1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000006',3,12, 60, 2,'main'),
    ('d1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000009',1, 1,  0, 0,'main'),
    ('d1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000010',4, 1, 45, 1,'main');

  -- ── 6. Check-ins (últimos 30 días, patrón realista por miembro) ───────────────
  -- Lucas: 5x semana
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '8 hours'::interval,
        now() - (n || ' days')::interval + '9.5 hours'::interval, 'qr'
  FROM generate_series(1,30) n WHERE n % 7 NOT IN (0,6);

  -- Valentina: 3x semana
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '10 hours'::interval,
        now() - (n || ' days')::interval + '11 hours'::interval, 'qr'
  FROM generate_series(1,30) n WHERE n % 7 IN (1,3,5);

  -- Matías: 5x semana
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '7 hours'::interval,
        now() - (n || ' days')::interval + '8.5 hours'::interval, 'qr'
  FROM generate_series(1,30) n WHERE n % 7 NOT IN (0,6);

  -- Sofía: 4x semana
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '9 hours'::interval,
        now() - (n || ' days')::interval + '10.5 hours'::interval, 'qr'
  FROM generate_series(1,30) n WHERE n % 7 IN (1,2,4,5);

  -- Federico: irregular (1-2x semana, es nuevo)
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '11 hours'::interval,
        now() - (n || ' days')::interval + '12 hours'::interval, 'qr'
  FROM generate_series(1,20) n WHERE n % 7 IN (2,5);

  -- Camila: 3x semana
  INSERT INTO check_ins (user_id, gym_id, checked_in_at, checked_out_at, method)
  SELECT 'a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
        now() - (n || ' days')::interval + '18 hours'::interval,
        now() - (n || ' days')::interval + '19.5 hours'::interval, 'qr'
  FROM generate_series(1,15) n WHERE n % 7 IN (1,3,6);

  -- ── 7. Sesiones de entrenamiento ──────────────────────────────────────────────
  INSERT INTO workout_sessions (user_id, gym_id, plan_id, day_of_week, day_name, exercises_count, xp_earned, completed_at)
  SELECT
    'a1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    EXTRACT(DOW FROM CURRENT_DATE - n)::integer,
    CASE EXTRACT(DOW FROM CURRENT_DATE - n)::integer
      WHEN 1 THEN 'Piernas'
      WHEN 2 THEN 'Pecho y Hombros'
      WHEN 4 THEN 'Espalda y Bíceps'
      ELSE 'Full Body + Core'
    END,
    4, 50,
    now() - (n || ' days')::interval
  FROM generate_series(1,30) n WHERE n % 7 NOT IN (0,6);

  INSERT INTO workout_sessions (user_id, gym_id, plan_id, day_of_week, day_name, exercises_count, xp_earned, completed_at)
  SELECT
    'a1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002',
    EXTRACT(DOW FROM CURRENT_DATE - n)::integer,
    CASE EXTRACT(DOW FROM CURRENT_DATE - n)::integer WHEN 1 THEN 'Cardio + Tren inferior' WHEN 3 THEN 'Full Body' ELSE 'Cardio + Core' END,
    3, 40,
    now() - (n || ' days')::interval
  FROM generate_series(1,30) n WHERE n % 7 IN (1,3,5);

  INSERT INTO workout_sessions (user_id, gym_id, plan_id, day_of_week, day_name, exercises_count, xp_earned, completed_at)
  SELECT
    'a1000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    EXTRACT(DOW FROM CURRENT_DATE - n)::integer,
    'Full Body', 4, 50,
    now() - (n || ' days')::interval
  FROM generate_series(1,60) n WHERE n % 7 IN (1,2,4,5);

  -- ── 8. Pagos ──────────────────────────────────────────────────────────────────
  INSERT INTO payments (gym_id, member_id, amount, status, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',14000,'approved',now()-interval'45 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',14000,'approved',now()-interval'15 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',22000,'approved',now()-interval'30 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003', 8000,'approved',now()-interval'60 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003', 8000,'approved',now()-interval'30 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000004',14000,'approved',now()-interval'42 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000005', 8000,'approved',now()-interval'20 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000006',22000,'approved',now()-interval'15 days'),
    ('00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',22000,'approved',now()-interval'3 days');

  -- ── 9. Logros ─────────────────────────────────────────────────────────────────
  INSERT INTO achievements (id, gym_id, name, description, icon, xp_reward, condition_type, condition_value) VALUES
    ('b2000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Primer Paso',       'Completaste tu primera sesión de entrenamiento', '🏅',  50, 'total_sessions', 1),
    ('b2000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','En Racha',          'Entrenaste 7 días seguidos sin parar',           '🔥', 150, 'streak_days',    7),
    ('b2000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10 Sesiones',       'Llegaste a 10 sesiones completadas',             '💪', 200, 'total_sessions', 10),
    ('b2000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Constancia de Acero','Completaste 30 sesiones en el gym',             '🏆', 500, 'total_sessions', 30)
  ON CONFLICT (id) DO NOTHING;

  -- Logros ganados
  INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES
    ('a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001',now()-interval'44 days'),
    ('a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000002',now()-interval'38 days'),
    ('a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000003',now()-interval'30 days'),
    ('a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000004',now()-interval'10 days'),
    ('a1000000-0000-0000-0000-000000000002','b2000000-0000-0000-0000-000000000001',now()-interval'29 days'),
    ('a1000000-0000-0000-0000-000000000002','b2000000-0000-0000-0000-000000000003',now()-interval'15 days'),
    ('a1000000-0000-0000-0000-000000000004','b2000000-0000-0000-0000-000000000001',now()-interval'89 days'),
    ('a1000000-0000-0000-0000-000000000004','b2000000-0000-0000-0000-000000000002',now()-interval'82 days'),
    ('a1000000-0000-0000-0000-000000000004','b2000000-0000-0000-0000-000000000003',now()-interval'70 days'),
    ('a1000000-0000-0000-0000-000000000004','b2000000-0000-0000-0000-000000000004',now()-interval'30 days'),
    ('a1000000-0000-0000-0000-000000000003','b2000000-0000-0000-0000-000000000001',now()-interval'59 days'),
    ('a1000000-0000-0000-0000-000000000003','b2000000-0000-0000-0000-000000000003',now()-interval'40 days')
  ON CONFLICT DO NOTHING;

  -- ── 10. Alimentos ─────────────────────────────────────────────────────────────
  -- Valores por 100g
  INSERT INTO foods (id, gym_id, name, calories, protein, carbs, fat, fiber, sodium, household_unit, grams_per_unit) VALUES
    ('e1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Avena',              389,17,  66,  7,  10.6,6,  'taza',   80),
    ('e1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Leche descremada',    34, 3.4, 5,  0.1, 0,  44,  'vaso',  250),
    ('e1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Huevo entero',       155,13,  1.1,11,  0,  124, 'unidad', 55),
    ('e1000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Pechuga de pollo',   165,31,  0,  3.6, 0,  74,  'porción',150),
    ('e1000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Arroz blanco cocido', 130, 2.7,28,  0.3, 0.4,1,   'taza',  180),
    ('e1000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','Brócoli',             34, 2.8, 7,  0.4, 2.6,33,  'taza',  150),
    ('e1000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','Banana',              89, 1.1,23,  0.3, 2.6,1,   'unidad',120),
    ('e1000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','Proteína Whey',      380,80,  5,  3,  0,  150, 'scoop',  30),
    ('e1000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','Aceite de oliva',    884, 0,   0, 100,  0,  0,   'cdita',  5),
    ('e1000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Papa hervida',        87, 1.9,20,  0.1, 1.8,4,   'unidad',150),
    ('e1000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','Atún en agua',       116,26,  0,  1,  0,  50,  'lata',  140),
    ('e1000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','Pan integral',       247, 9,  41,  4,  7,  400, 'rebanada',30),
    ('e1000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','Yogur griego',        97, 9,   4,  5,  0,  36,  'pote',  200),
    ('e1000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','Manzana',             52, 0.3,14,  0.2, 2.4,1,   'unidad',150),
    ('e1000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000001','Manteca de maní',    588,25,  20, 50,  6,  17,  'cda',   16)
  ON CONFLICT (id) DO NOTHING;

  -- ── 11. Plan nutricional de Lucas (Volumen) ───────────────────────────────────
  INSERT INTO nutrition_plans (id, gym_id, member_id, created_by, name, goal, target_calories, target_protein, target_carbs, target_fat, is_active) VALUES
    ('f1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c9dda43f-2e2c-4dee-8edf-08d4a0d0de71',
    'Plan Volumen — Lucas', 'volumen', 3100, 215, 370, 90, true)
  ON CONFLICT (id) DO NOTHING;

  -- Comidas
  INSERT INTO nutrition_meals (id, plan_id, name, time_label, order_index) VALUES
    ('a2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','Desayuno',      '07:00', 0),
    ('a2000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001','Media Mañana',  '10:30', 1),
    ('a2000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000001','Almuerzo',      '13:00', 2),
    ('a2000000-0000-0000-0000-000000000004','f1000000-0000-0000-0000-000000000001','Merienda',      '17:00', 3),
    ('a2000000-0000-0000-0000-000000000005','f1000000-0000-0000-0000-000000000001','Cena',          '20:30', 4)
  ON CONFLICT (id) DO NOTHING;

  -- Items por comida
  -- Desayuno: Avena 80g + Leche 250g + Banana 120g + Proteína Whey 30g
  INSERT INTO nutrition_meal_items (meal_id, food_id, quantity_grams) VALUES
    ('a2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001', 80),
    ('a2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002',250),
    ('a2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000007',120),
    ('a2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000008', 30);

  -- Media Mañana: Yogur griego 200g + Manzana 150g + Manteca de maní 16g
  INSERT INTO nutrition_meal_items (meal_id, food_id, quantity_grams) VALUES
    ('a2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000013',200),
    ('a2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000014',150),
    ('a2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000015', 16);

  -- Almuerzo: Pollo 200g + Arroz 180g + Brócoli 200g + Aceite de oliva 15g
  INSERT INTO nutrition_meal_items (meal_id, food_id, quantity_grams) VALUES
    ('a2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000004',200),
    ('a2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000005',180),
    ('a2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000006',200),
    ('a2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000009', 15);

  -- Merienda: Pan integral 60g + Atún 140g + Papa 150g
  INSERT INTO nutrition_meal_items (meal_id, food_id, quantity_grams) VALUES
    ('a2000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000012', 60),
    ('a2000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000011',140),
    ('a2000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000010',150);

  -- Cena: Huevo 220g + Arroz 150g + Brócoli 150g + Aceite de oliva 10g
  INSERT INTO nutrition_meal_items (meal_id, food_id, quantity_grams) VALUES
    ('a2000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000003',220),
    ('a2000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000005',150),
    ('a2000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000006',150),
    ('a2000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000009', 10);

  -- ── 12. Logs de nutrición de Lucas (últimos 7 días) ───────────────────────────
  INSERT INTO nutrition_logs (member_id, meal_id, log_date)
  SELECT 'a1000000-0000-0000-0000-000000000001'::uuid, meal_id::uuid, (CURRENT_DATE - n)
  FROM (VALUES
    ('a2000000-0000-0000-0000-000000000001'),
    ('a2000000-0000-0000-0000-000000000002'),
    ('a2000000-0000-0000-0000-000000000003'),
    ('a2000000-0000-0000-0000-000000000004'),
    ('a2000000-0000-0000-0000-000000000005')
  ) meals(meal_id),
  generate_series(1,7) n
  WHERE NOT (n = 3 AND meal_id = 'a2000000-0000-0000-0000-000000000004')
    AND NOT (n = 5 AND meal_id IN ('a2000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000005'));

  -- ── 13. Historial de peso de Lucas (últimos 60 días — tendencia alcista) ───────
  INSERT INTO weight_logs (member_id, log_date, weight_kg)
  SELECT
    'a1000000-0000-0000-0000-000000000001',
    CURRENT_DATE - (n * 4),
    73.5 + (n::numeric / 15 * -1 + 15::numeric/15) * 2.8 + (random() * 0.4 - 0.2)
  FROM generate_series(0, 14) n;

  -- ── 14. Logs de agua de Lucas (últimos 7 días) ────────────────────────────────
  INSERT INTO water_logs (member_id, log_date, glasses)
  SELECT 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - n,
        (5 + floor(random() * 4))::integer
  FROM generate_series(0, 6) n
  ON CONFLICT DO NOTHING;
