-- profiles: actividad diaria (además de frecuencia) + referencia metabólica
-- explícita para cuando gender no es 'male'/'female' — nunca se infiere ni
-- se promedia, la elige el trainer (ver lib/nutrition.ts calcTmb).
alter table profiles
  add column if not exists daily_activity     text check (daily_activity in ('sedentary', 'moderate', 'active')),
  add column if not exists metabolic_reference text check (metabolic_reference in ('male', 'female'));

-- workout_sessions: duración real medida (no confundir con
-- workout_session_sets.duration_seconds, que es la duración de un set de
-- cardio individual — esta es la duración total de la sesión).
alter table workout_sessions
  add column if not exists duration_seconds integer;

-- nutrition_plans: valores realmente usados para calcular el plan (no una
-- referencia a gym_nutrition_defaults, que puede cambiar después) + estado
-- de revisión de seguridad.
alter table nutrition_plans
  add column if not exists calorie_adjustment_pct numeric(5,2),
  add column if not exists protein_per_kg          numeric(4,2),
  add column if not exists fat_per_kg              numeric(4,2),
  add column if not exists needs_review            boolean not null default false,
  add column if not exists needs_review_reason     text;

-- Defaults de proteína/ajuste calórico por objetivo, configurables por gym.
-- Una fila por gym, creada perezosamente (insert on conflict) la primera vez
-- que se pide — ver getGymNutritionDefaults en app/actions/nutrition.ts.
create table if not exists gym_nutrition_defaults (
  gym_id                    uuid primary key references gyms(id) on delete cascade,
  volumen_pct               numeric(5,2) not null default 12,
  volumen_protein           numeric(4,2) not null default 1.8,
  rendimiento_pct           numeric(5,2) not null default 8,
  rendimiento_protein       numeric(4,2) not null default 1.8,
  mantenimiento_protein     numeric(4,2) not null default 1.7,
  recomposicion_protein     numeric(4,2) not null default 2.0,
  perdida_moderada_pct      numeric(5,2) not null default -10,
  perdida_moderada_protein  numeric(4,2) not null default 2.0,
  definicion_pct            numeric(5,2) not null default -18,
  definicion_protein        numeric(4,2) not null default 2.2,
  updated_at                timestamptz not null default now()
);

alter table gym_nutrition_defaults enable row level security;

create policy "gym_nutrition_defaults_read" on gym_nutrition_defaults for select
  to authenticated
  using (gym_id in (select gym_id from profiles where id = (select auth.uid())));

create policy "gym_nutrition_defaults_write" on gym_nutrition_defaults for all
  to authenticated
  using (
    gym_id in (select gym_id from profiles where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    gym_id in (select gym_id from profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Nuevo tipo de notificación: "ya hay duración real suficiente para refinar
-- el plan nutricional de este socio" (se dispara desde complete_workout_session
-- en Task 2).
alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check check (type in (
    'new_member', 'check_in', 'achievement', 'plan_assigned',
    'membership_expiring', 'churn_alert', 'weight_drift', 'calorie_alert',
    'nutrition_duration_ready'
  ));
