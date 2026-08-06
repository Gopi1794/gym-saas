-- Ninguna de estas policies declaraba `TO` — quedaban en PUBLIC por default (regla 4
-- del checklist de seguridad del proyecto). Ninguna es explotable hoy porque todas
-- comparan contra auth.uid()/assigned_to (NULL para anon nunca matchea), pero es una
-- desviación sistemática de la convención explícita del proyecto. Mismo texto de
-- condición que las policies originales — solo se agrega TO authenticated.

-- exercise_maxes
DROP POLICY IF EXISTS "users manage own maxes" ON exercise_maxes;
DROP POLICY IF EXISTS "trainers read member maxes" ON exercise_maxes;

CREATE POLICY "users manage own maxes"
  ON exercise_maxes TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "trainers read member maxes"
  ON exercise_maxes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles trainer ON trainer.gym_id = p.gym_id
      WHERE p.id = user_id
        AND trainer.id = auth.uid()
        AND trainer.role IN ('admin', 'trainer')
    )
  );

-- workout_session_sets
DROP POLICY IF EXISTS "users read own session sets" ON workout_session_sets;
DROP POLICY IF EXISTS "trainers read gym member session sets" ON workout_session_sets;

CREATE POLICY "users read own session sets"
  ON workout_session_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "trainers read gym member session sets"
  ON workout_session_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      JOIN profiles member  ON member.id  = ws.user_id
      JOIN profiles trainer ON trainer.id = auth.uid()
      WHERE ws.id = session_id
        AND member.gym_id  = trainer.gym_id
        AND trainer.role IN ('admin', 'trainer')
    )
  );

-- workout_session_drafts
DROP POLICY IF EXISTS "members manage own drafts" ON workout_session_drafts;

CREATE POLICY "members manage own drafts"
  ON workout_session_drafts
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- workout_plan_set_configs
DROP POLICY IF EXISTS "trainer manage set configs" ON workout_plan_set_configs;
DROP POLICY IF EXISTS "member read own set configs" ON workout_plan_set_configs;

CREATE POLICY "trainer manage set configs"
  ON workout_plan_set_configs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN workout_plans wp ON wp.gym_id = p.gym_id
      JOIN workout_plan_days wpd ON wpd.plan_id = wp.id
      JOIN workout_plan_exercises wpe ON wpe.day_id = wpd.id
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
        AND wpe.id = workout_plan_set_configs.exercise_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN workout_plans wp ON wp.gym_id = p.gym_id
      JOIN workout_plan_days wpd ON wpd.plan_id = wp.id
      JOIN workout_plan_exercises wpe ON wpe.day_id = wpd.id
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'trainer')
        AND wpe.id = exercise_id
    )
  );

CREATE POLICY "member read own set configs"
  ON workout_plan_set_configs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_plan_exercises wpe
      JOIN workout_plan_days wpd ON wpd.id = wpe.day_id
      JOIN workout_plans wp ON wp.id = wpd.plan_id
      WHERE wpe.id = workout_plan_set_configs.exercise_id
        AND wp.assigned_to = auth.uid()
    )
  );

-- storage: exercise-images (la policy de lectura queda sin TO a propósito — el bucket
-- es público por diseño, "la lectura sigue siendo pública" per su propio comentario).
DROP POLICY IF EXISTS "Admins can upload exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete exercise images" ON storage.objects;

CREATE POLICY "Admins can upload exercise images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exercise-images'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'trainer')
  )
);

CREATE POLICY "Admins can update exercise images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'trainer')
  )
)
WITH CHECK (
  bucket_id = 'exercise-images'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'trainer')
  )
);

CREATE POLICY "Admins can delete exercise images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'trainer')
  )
);
