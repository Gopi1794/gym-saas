-- Membership plans per gym: price, duration, features for each type (basic/premium/vip)

CREATE TABLE public.membership_plans (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  gym_id       uuid        NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type = ANY (ARRAY['basic','premium','vip'])),
  label        text        NOT NULL DEFAULT '',
  price        numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_days integer   NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  features     text[]      NOT NULL DEFAULT '{}',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_pkey PRIMARY KEY (id),
  CONSTRAINT membership_plans_gym_type_key UNIQUE (gym_id, type)
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

-- Admins can read and write their gym's plans
CREATE POLICY "admins manage gym membership plans"
  ON public.membership_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.gym_id = membership_plans.gym_id
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.gym_id = membership_plans.gym_id
        AND p.role = 'admin'
    )
  );

-- All gym members can read plans (to see pricing)
CREATE POLICY "members read gym membership plans"
  ON public.membership_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.gym_id = membership_plans.gym_id
    )
  );

CREATE INDEX membership_plans_gym_id_idx ON public.membership_plans(gym_id);
