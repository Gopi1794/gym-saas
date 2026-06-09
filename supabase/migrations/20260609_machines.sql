-- Máquinas del gimnasio
CREATE TABLE IF NOT EXISTS public.machines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  qr_identifier    text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Ejercicios asociados a cada máquina
CREATE TABLE IF NOT EXISTS public.machine_exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  UNIQUE(machine_id, exercise_id)
);

-- RLS
ALTER TABLE public.machines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_exercises ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del gym puede ver las máquinas
CREATE POLICY "gym members can read machines"
  ON public.machines FOR SELECT
  USING (gym_id IN (SELECT gym_id FROM public.profiles WHERE id = auth.uid()));

-- Escritura: solo admin/trainer
CREATE POLICY "staff can manage machines"
  ON public.machines FOR ALL
  USING (
    gym_id IN (
      SELECT gym_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
  );

CREATE POLICY "gym members can read machine_exercises"
  ON public.machine_exercises FOR SELECT
  USING (
    machine_id IN (
      SELECT m.id FROM public.machines m
      JOIN public.profiles p ON p.gym_id = m.gym_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "staff can manage machine_exercises"
  ON public.machine_exercises FOR ALL
  USING (
    machine_id IN (
      SELECT m.id FROM public.machines m
      JOIN public.profiles p ON p.gym_id = m.gym_id
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'trainer')
    )
  );
