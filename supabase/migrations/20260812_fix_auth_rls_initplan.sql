-- supabase/migrations/20260812_fix_auth_rls_initplan.sql
-- Performance Advisor: auth_rls_initplan en 68 policies de 32 tablas.
--
-- Postgres re-evalua auth.uid()/auth.role()/get_my_role()/get_my_gym_id()
-- una vez POR FILA cuando aparecen "pelados" en el using/with check de una
-- policy RLS, porque los trata como volatiles aunque en la practica sean
-- estables durante la misma query. Envueltos en un scalar subquery
-- `(select auth.uid())`, el planner los resuelve como InitPlan: una sola
-- vez por query, sin importar cuantas filas evalue la policy. No cambia
-- que permite ninguna policy — mismo using, mismo with check, mismo cmd,
-- mismos roles — solo cambia cuantas veces se ejecuta la funcion.
--
-- Cada policy de este archivo se recrea con drop + create porque Postgres
-- no tiene `ALTER POLICY ... SET USING`.
--
-- Correccion aparte encontrada durante esta revision (no es parte del
-- alcance original de auth_rls_initplan): la policy "trainer manage set
-- configs" de workout_plan_set_configs tenia, en su clausula WITH CHECK,
-- `wpe.id = wpe.exercise_id` — comparaba la propia primary key de
-- workout_plan_exercises contra si misma en vez de contra
-- workout_plan_set_configs.exercise_id (la columna que sí compara la
-- clausula USING, correcta, dos lineas mas arriba). Esa condicion es
-- practicamente siempre falsa, asi que ningun INSERT/UPDATE de un
-- trainer/admin en esa tabla podia pasar el WITH CHECK. Se corrige al
-- mismo tiempo que se regenera la policy para el fix de initplan.

-- achievements
drop policy if exists "members read gym achievements" on public.achievements;
create policy "members read gym achievements"
on public.achievements
for select
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id)))));

drop policy if exists "admins write gym achievements" on public.achievements;
create policy "admins write gym achievements"
on public.achievements
for all
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- ai_audit_logs
drop policy if exists "admins read own gym logs" on public.ai_audit_logs;
create policy "admins read own gym logs"
on public.ai_audit_logs
for select
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.gym_id = ai_audit_logs.gym_id) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- chat_logs
drop policy if exists "chat_logs_select_own" on public.chat_logs;
create policy "chat_logs_select_own"
on public.chat_logs
for select
using ((user_id = (select auth.uid())));

drop policy if exists "chat_logs_insert_own" on public.chat_logs;
create policy "chat_logs_insert_own"
on public.chat_logs
for insert
with check ((user_id = (select auth.uid())));

drop policy if exists "chat_logs_admin_read" on public.chat_logs;
create policy "chat_logs_admin_read"
on public.chat_logs
for select
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = chat_logs.gym_id)))));

-- client_plans
drop policy if exists "clients read own plans" on public.client_plans;
create policy "clients read own plans"
on public.client_plans
for select
using (((select auth.uid()) = client_id));

drop policy if exists "trainers manage client plans" on public.client_plans;
create policy "trainers manage client plans"
on public.client_plans
for all
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- exercise_favorites
drop policy if exists "users manage their own favorites" on public.exercise_favorites;
create policy "users manage their own favorites"
on public.exercise_favorites
for all
using (((select auth.uid()) = user_id));

-- exercise_maxes
drop policy if exists "users manage own maxes" on public.exercise_maxes;
create policy "users manage own maxes"
on public.exercise_maxes
for all to authenticated
using ((user_id = (select auth.uid())))
with check ((user_id = (select auth.uid())));

drop policy if exists "trainers read member maxes" on public.exercise_maxes;
create policy "trainers read member maxes"
on public.exercise_maxes
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN profiles trainer ON ((trainer.gym_id = p.gym_id)))
  WHERE ((p.id = exercise_maxes.user_id) AND (trainer.id = (select auth.uid())) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- exercises
drop policy if exists "authenticated users can read exercises" on public.exercises;
create policy "authenticated users can read exercises"
on public.exercises
for select
using (((select auth.uid()) IS NOT NULL));

drop policy if exists "trainers can manage exercises" on public.exercises;
create policy "trainers can manage exercises"
on public.exercises
for all
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- foods
drop policy if exists "foods_read" on public.foods;
create policy "foods_read"
on public.foods
for select
using (((gym_id IS NULL) OR (gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))));

drop policy if exists "foods_write" on public.foods;
create policy "foods_write"
on public.foods
for all
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- gyms
drop policy if exists "gym owners can manage their gym" on public.gyms;
create policy "gym owners can manage their gym"
on public.gyms
for all
using (((select auth.uid()) = owner_id));

drop policy if exists "authenticated users can read gyms" on public.gyms;
create policy "authenticated users can read gyms"
on public.gyms
for select
using (((select auth.role()) = 'authenticated'::text));

-- machine_exercises
drop policy if exists "gym members can read machine_exercises" on public.machine_exercises;
create policy "gym members can read machine_exercises"
on public.machine_exercises
for select
using ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE (p.id = (select auth.uid())))));

drop policy if exists "staff can manage machine_exercises" on public.machine_exercises;
create policy "staff can manage machine_exercises"
on public.machine_exercises
for all
using ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- machines
drop policy if exists "gym members can read machines" on public.machines;
create policy "gym members can read machines"
on public.machines
for select
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))));

drop policy if exists "staff can manage machines" on public.machines;
create policy "staff can manage machines"
on public.machines
for all
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- membership_plans
drop policy if exists "admins manage gym membership plans" on public.membership_plans;
create policy "admins manage gym membership plans"
on public.membership_plans
for all
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))));

drop policy if exists "members read gym membership plans" on public.membership_plans;
create policy "members read gym membership plans"
on public.membership_plans
for select
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id)))));

-- notifications
drop policy if exists "users select own notifications" on public.notifications;
create policy "users select own notifications"
on public.notifications
for select
using ((user_id = (select auth.uid())));

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications
for update
using ((user_id = (select auth.uid())))
with check ((user_id = (select auth.uid())));

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
on public.notifications
for delete
using ((user_id = (select auth.uid())));

-- nutrition_food_favorites
drop policy if exists "users manage own favorites" on public.nutrition_food_favorites;
create policy "users manage own favorites"
on public.nutrition_food_favorites
for all
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

-- nutrition_log_items
drop policy if exists "nutrition_log_items_member" on public.nutrition_log_items;
create policy "nutrition_log_items_member"
on public.nutrition_log_items
for all
using ((EXISTS ( SELECT 1
   FROM nutrition_logs nl
  WHERE ((nl.id = nutrition_log_items.log_id) AND (nl.member_id = (select auth.uid()))))));

drop policy if exists "nutrition_log_items_trainer_read" on public.nutrition_log_items;
create policy "nutrition_log_items_trainer_read"
on public.nutrition_log_items
for select
using ((EXISTS ( SELECT 1
   FROM ((nutrition_logs nl
     JOIN profiles member ON ((member.id = nl.member_id)))
     JOIN profiles trainer ON ((trainer.gym_id = member.gym_id)))
  WHERE ((nl.id = nutrition_log_items.log_id) AND (trainer.id = (select auth.uid())) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- nutrition_logs
drop policy if exists "nutrition_logs_member" on public.nutrition_logs;
create policy "nutrition_logs_member"
on public.nutrition_logs
for all
using ((member_id = (select auth.uid())));

drop policy if exists "nutrition_logs_trainer_read" on public.nutrition_logs;
create policy "nutrition_logs_trainer_read"
on public.nutrition_logs
for select
using ((member_id IN ( SELECT p.id
   FROM (profiles p
     JOIN profiles me ON ((me.gym_id = p.gym_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- nutrition_meal_items
drop policy if exists "nutrition_meal_items_write" on public.nutrition_meal_items;
create policy "nutrition_meal_items_write"
on public.nutrition_meal_items
for all
using ((meal_id IN ( SELECT nm.id
   FROM ((nutrition_meals nm
     JOIN nutrition_plans np ON ((np.id = nm.plan_id)))
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- nutrition_meals
drop policy if exists "nutrition_meals_write" on public.nutrition_meals;
create policy "nutrition_meals_write"
on public.nutrition_meals
for all
using ((plan_id IN ( SELECT np.id
   FROM (nutrition_plans np
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- nutrition_plans
drop policy if exists "nutrition_plans_read" on public.nutrition_plans;
create policy "nutrition_plans_read"
on public.nutrition_plans
for select
using (((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND ((member_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))))));

drop policy if exists "nutrition_plans_write" on public.nutrition_plans;
create policy "nutrition_plans_write"
on public.nutrition_plans
for all
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- payments
drop policy if exists "gym_admin_select_payments" on public.payments;
create policy "gym_admin_select_payments"
on public.payments
for select
using (((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.owner_id = (select auth.uid())))) OR (gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))));

drop policy if exists "member_select_own_payments" on public.payments;
create policy "member_select_own_payments"
on public.payments
for select
using ((member_id = (select auth.uid())));

drop policy if exists "admin_insert_payments" on public.payments;
create policy "admin_insert_payments"
on public.payments
for insert
with check ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));

drop policy if exists "admins can view gym payments" on public.payments;
create policy "admins can view gym payments"
on public.payments
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.gym_id = payments.gym_id) AND (profiles.role = 'admin'::text)))));

drop policy if exists "members can view own payments" on public.payments;
create policy "members can view own payments"
on public.payments
for select to authenticated
using ((member_id = (select auth.uid())));

-- profiles
drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
using (((select auth.uid()) = id));

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
using (((select auth.uid()) = id));

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
with check (((select auth.uid()) = id));

-- quick_log_entries
drop policy if exists "members manage own quick logs" on public.quick_log_entries;
create policy "members manage own quick logs"
on public.quick_log_entries
for all
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

-- user_achievements
drop policy if exists "users read own earned" on public.user_achievements;
create policy "users read own earned"
on public.user_achievements
for select
using ((user_id = (select auth.uid())));

drop policy if exists "admins read gym earned" on public.user_achievements;
create policy "admins read gym earned"
on public.user_achievements
for select
using ((EXISTS ( SELECT 1
   FROM (profiles me
     JOIN profiles target ON ((target.id = user_achievements.user_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (me.gym_id = target.gym_id)))));

-- water_logs
drop policy if exists "water_logs_member" on public.water_logs;
create policy "water_logs_member"
on public.water_logs
for all
using ((member_id = (select auth.uid())));

-- weight_logs
drop policy if exists "weight_logs_member" on public.weight_logs;
create policy "weight_logs_member"
on public.weight_logs
for all
using ((member_id = (select auth.uid())));

drop policy if exists "weight_logs_trainer_read" on public.weight_logs;
create policy "weight_logs_trainer_read"
on public.weight_logs
for select
using ((member_id IN ( SELECT p.id
   FROM (profiles p
     JOIN profiles me ON ((me.gym_id = p.gym_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- workout_plan_days
drop policy if exists "members can read their plan days" on public.workout_plan_days;
create policy "members can read their plan days"
on public.workout_plan_days
for select
using ((EXISTS ( SELECT 1
   FROM workout_plans wp
  WHERE ((wp.id = workout_plan_days.plan_id) AND ((wp.assigned_to = (select auth.uid())) OR wp.is_template)))));

drop policy if exists "Members can read their plan days" on public.workout_plan_days;
create policy "Members can read their plan days"
on public.workout_plan_days
for select
using ((plan_id IN ( SELECT workout_plans.id
   FROM workout_plans
  WHERE ((workout_plans.assigned_to = (select auth.uid())) OR (workout_plans.created_by = (select auth.uid()))))));

drop policy if exists "Staff can manage plan days" on public.workout_plan_days;
create policy "Staff can manage plan days"
on public.workout_plan_days
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- workout_plan_exercises
drop policy if exists "plan owner can manage exercises" on public.workout_plan_exercises;
create policy "plan owner can manage exercises"
on public.workout_plan_exercises
for all
using ((EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (wp.created_by = (select auth.uid()))))));

drop policy if exists "members can read their plan exercises" on public.workout_plan_exercises;
create policy "members can read their plan exercises"
on public.workout_plan_exercises
for select
using ((EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND ((wp.assigned_to = (select auth.uid())) OR wp.is_template)))));

drop policy if exists "Members can read their plan exercises" on public.workout_plan_exercises;
create policy "Members can read their plan exercises"
on public.workout_plan_exercises
for select
using ((day_id IN ( SELECT wpd.id
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wpd.plan_id = wp.id)))
  WHERE ((wp.assigned_to = (select auth.uid())) OR (wp.created_by = (select auth.uid()))))));

drop policy if exists "Staff can manage plan exercises" on public.workout_plan_exercises;
create policy "Staff can manage plan exercises"
on public.workout_plan_exercises
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- workout_plan_set_configs
drop policy if exists "trainer manage set configs" on public.workout_plan_set_configs;
create policy "trainer manage set configs"
on public.workout_plan_set_configs
for all to authenticated
using ((EXISTS ( SELECT 1
   FROM (((profiles p
     JOIN workout_plans wp ON ((wp.gym_id = p.gym_id)))
     JOIN workout_plan_days wpd ON ((wpd.plan_id = wp.id)))
     JOIN workout_plan_exercises wpe ON ((wpe.day_id = wpd.id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (wpe.id = workout_plan_set_configs.exercise_id)))))
with check ((EXISTS ( SELECT 1
   FROM (((profiles p
     JOIN workout_plans wp ON ((wp.gym_id = p.gym_id)))
     JOIN workout_plan_days wpd ON ((wpd.plan_id = wp.id)))
     JOIN workout_plan_exercises wpe ON ((wpe.day_id = wpd.id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (wpe.id = workout_plan_set_configs.exercise_id)))));

drop policy if exists "member read own set configs" on public.workout_plan_set_configs;
create policy "member read own set configs"
on public.workout_plan_set_configs
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM ((workout_plan_exercises wpe
     JOIN workout_plan_days wpd ON ((wpd.id = wpe.day_id)))
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpe.id = workout_plan_set_configs.exercise_id) AND (wp.assigned_to = (select auth.uid()))))));

-- workout_plans
drop policy if exists "members can read their assigned plan" on public.workout_plans;
create policy "members can read their assigned plan"
on public.workout_plans
for select
using (((select auth.uid()) = assigned_to));

drop policy if exists "trainers manage plans" on public.workout_plans;
create policy "trainers manage plans"
on public.workout_plans
for all
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "members read assigned plans" on public.workout_plans;
create policy "members read assigned plans"
on public.workout_plans
for select
using (((is_template = true) OR (created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM client_plans
  WHERE ((client_plans.plan_id = workout_plans.id) AND (client_plans.client_id = (select auth.uid())))))));

drop policy if exists "admins can read plans in their gym" on public.workout_plans;
create policy "admins can read plans in their gym"
on public.workout_plans
for select
using ((EXISTS ( SELECT 1
   FROM profiles admin_p
  WHERE ((admin_p.id = (select auth.uid())) AND (admin_p.role = 'admin'::text) AND (admin_p.gym_id = workout_plans.gym_id)))));

-- workout_session_drafts
drop policy if exists "members manage own drafts" on public.workout_session_drafts;
create policy "members manage own drafts"
on public.workout_session_drafts
for all to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

-- workout_session_sets
drop policy if exists "users read own session sets" on public.workout_session_sets;
create policy "users read own session sets"
on public.workout_session_sets
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM workout_sessions ws
  WHERE ((ws.id = workout_session_sets.session_id) AND (ws.user_id = (select auth.uid()))))));

drop policy if exists "trainers read gym member session sets" on public.workout_session_sets;
create policy "trainers read gym member session sets"
on public.workout_session_sets
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM ((workout_sessions ws
     JOIN profiles member ON ((member.id = ws.user_id)))
     JOIN profiles trainer ON ((trainer.id = (select auth.uid()))))
  WHERE ((ws.id = workout_session_sets.session_id) AND (member.gym_id = trainer.gym_id) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

-- workout_sessions
drop policy if exists "members can insert own sessions" on public.workout_sessions;
create policy "members can insert own sessions"
on public.workout_sessions
for insert
with check (((select auth.uid()) = user_id));

drop policy if exists "members can read own sessions" on public.workout_sessions;
create policy "members can read own sessions"
on public.workout_sessions
for select
using (((select auth.uid()) = user_id));

drop policy if exists "trainers can read member sessions" on public.workout_sessions;
create policy "trainers can read member sessions"
on public.workout_sessions
for select
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));
