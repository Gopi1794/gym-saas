-- supabase/migrations/20260812_fix_missing_gym_scope_rls.sql
-- Seguridad, no performance: 5 policies de "staff/trainer manage" que
-- chequean el rol del usuario pero nunca comparan el gym_id de la fila
-- contra el gym_id del staff. Resultado: cualquier admin/trainer de
-- CUALQUIER gym puede leer o escribir filas de OTROS gyms en estas tablas.
--
-- Encontrado al revisar a mano las policies para el fix de
-- multiple_permissive_policies (154 findings del Performance Advisor) —
-- el linter de performance no lo detecta porque no es un problema de
-- performance, es un agujero de multi-tenancy.
--
-- Confirmado con la migracion 20260524_harden_multi_tenant_schema.sql:
-- ahi se agrego la columna gym_id (NOT NULL, con backfill) a workout_plans,
-- client_plans y workout_sessions, y se actualizo "admins can read plans in
-- their gym" para usarla — pero las policies de abajo nunca se tocaron y
-- se quedaron con el chequeo de rol viejo, sin comparar gym_id.
--
-- De paso se agrega `TO authenticated` (regla de seguridad #4: sin TO,
-- Postgres asume PUBLIC e incluye a anon) — las 5 estaban en {public}.
--
-- exercises NO esta en esta lista a proposito: es un catalogo global sin
-- gym_id (confirmado en app/actions/import-exercises.ts), asi que
-- "trainers/admins can manage exercises" sin scope de gym es correcto
-- por diseno, no un bug.

-- client_plans: "trainers manage client plans" no comparaba gym_id.
drop policy if exists "trainers manage client plans" on public.client_plans;
create policy "trainers manage client plans"
on public.client_plans
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = client_plans.gym_id)))));

-- workout_plans: "trainers manage plans" no comparaba gym_id.
drop policy if exists "trainers manage plans" on public.workout_plans;
create policy "trainers manage plans"
on public.workout_plans
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_plans.gym_id)))));

-- workout_plan_days: "Staff can manage plan days" joineaba profiles solo
-- por auth.uid(), nunca comparaba p.gym_id contra el gym del plan (wp.gym_id).
drop policy if exists "Staff can manage plan days" on public.workout_plan_days;
create policy "Staff can manage plan days"
on public.workout_plan_days
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))))
with check ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))));

-- workout_plan_exercises: mismo problema que workout_plan_days.
drop policy if exists "Staff can manage plan exercises" on public.workout_plan_exercises;
create policy "Staff can manage plan exercises"
on public.workout_plan_exercises
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))))
with check ((EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))));

-- workout_sessions: "trainers can read member sessions" no comparaba
-- gym_id contra nada — ni siquiera joineaba la sesion, solo chequeaba
-- que el que llama sea staff de algun gym.
drop policy if exists "trainers can read member sessions" on public.workout_sessions;
create policy "trainers can read member sessions"
on public.workout_sessions
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_sessions.gym_id)))));
