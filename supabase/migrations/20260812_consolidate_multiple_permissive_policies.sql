-- supabase/migrations/20260812_consolidate_multiple_permissive_policies.sql
-- Performance Advisor: multiple_permissive_policies en 154 findings de 26
-- tablas. Postgres evalua TODAS las policies permisivas que apliquen al
-- mismo rol+accion y las OR-ea — cada policy de mas es una query extra
-- ejecutada por fila, no solo una vez.
--
-- Dos patrones distintos, tratados distinto:
--
-- (A) El policy angosto ("member lee lo suyo") ya cubre por completo lo
--     que el policy amplio ("staff administra") necesita para SELECT,
--     porque el staff tambien cumple la condicion del angosto (es socio
--     del mismo gym). Ahi el select duplicado del FOR ALL amplio es
--     puro sobrante: se separa ese FOR ALL en INSERT/UPDATE/DELETE
--     (Postgres no permite "FOR ALL menos SELECT" en una sola policy) y
--     el SELECT angosto queda sin tocar.
--
-- (B) Las dos policies cubren poblaciones genuinamente distintas (ej.
--     "mi propio registro" vs "cualquier registro de mi gym si soy
--     staff") y ninguna es subconjunto de la otra. Ahi se fusionan en
--     UNA sola policy de SELECT con `cond_A OR cond_B` — mismo resultado,
--     una sola evaluacion en vez de dos.
--
-- De paso se agrega `TO authenticated` a las policies que estaban en
-- PUBLIC (sin TO, Postgres asume PUBLIC = incluye anon) — regla de
-- seguridad #4 del proyecto. Esto ademas elimina de un saque los
-- hallazgos duplicados para anon/authenticator/cli_login_postgres/
-- dashboard_user/supabase_privileged_role: si la policy ya no aplica a
-- esos roles, no hay nada que el linter pueda encontrar duplicado ahi.
--
-- payments tenia cruft real: "admins can view gym payments" y "members
-- can view own payments" eran copias funcionalmente identicas (mismo
-- chequeo, otro nombre) de "gym_admin_select_payments" y
-- "member_select_own_payments" — probablemente de dos features distintas
-- (cobro manual + RLS bugfix) que no se dieron cuenta de que ya existia
-- una policy equivalente. Se borran las duplicadas y se fusiona el resto.
--
-- exercises tenia ademas "admins can manage exercises" (solo role=admin)
-- como subconjunto estricto de "trainers can manage exercises"
-- (role IN admin,trainer) — se borra la primera directamente.
--
-- workout_plans tenia "admins can read plans in their gym" (admin + su
-- gym) que ahora es subconjunto estricto de "trainers manage plans" ya
-- que esa se corrigio para comparar gym_id en la migracion anterior
-- (20260812_fix_missing_gym_scope_rls.sql) — se borra.

-- ============================================================
-- achievements (patron A)
-- ============================================================
drop policy if exists "admins write gym achievements" on public.achievements;
create policy "admins write gym achievements - insert"
on public.achievements
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "admins write gym achievements - update"
on public.achievements
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "admins write gym achievements - delete"
on public.achievements
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "members read gym achievements" on public.achievements;
create policy "members read gym achievements"
on public.achievements
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = achievements.gym_id)))));

-- ============================================================
-- chat_logs (patron B)
-- ============================================================
drop policy if exists "chat_logs_select_own" on public.chat_logs;
drop policy if exists "chat_logs_admin_read" on public.chat_logs;
create policy "chat_logs_select"
on public.chat_logs
for select to authenticated
using (
  (user_id = (select auth.uid()))
  OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = chat_logs.gym_id))))
);

drop policy if exists "chat_logs_insert_own" on public.chat_logs;
create policy "chat_logs_insert_own"
on public.chat_logs
for insert to authenticated
with check ((user_id = (select auth.uid())));

-- ============================================================
-- check_ins (patron B, ya estaba TO authenticated)
-- ============================================================
drop policy if exists "users can see their own check-ins" on public.check_ins;
drop policy if exists "admins can see all check-ins in their gym" on public.check_ins;
create policy "check_ins_select"
on public.check_ins
for select to authenticated
using (
  ((select auth.uid()) = user_id)
  OR ((gym_id = get_my_gym_id()) AND (get_my_role() = ANY (ARRAY['admin'::text, 'trainer'::text])))
);

drop policy if exists "users can create their own check-ins" on public.check_ins;
drop policy if exists "admins can create check-ins" on public.check_ins;
create policy "check_ins_insert"
on public.check_ins
for insert to authenticated
with check (
  (((select auth.uid()) = user_id) AND (gym_id = get_my_gym_id()))
  OR ((gym_id = get_my_gym_id()) AND (get_my_role() = ANY (ARRAY['admin'::text, 'trainer'::text])))
);

-- ============================================================
-- client_plans (patron B; "trainers manage" ya viene con gym_id
-- corregido por la migracion anterior)
-- ============================================================
drop policy if exists "trainers manage client plans" on public.client_plans;
create policy "trainers manage client plans - insert"
on public.client_plans
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = client_plans.gym_id)))));

create policy "trainers manage client plans - update"
on public.client_plans
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = client_plans.gym_id)))));

create policy "trainers manage client plans - delete"
on public.client_plans
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = client_plans.gym_id)))));

drop policy if exists "clients read own plans" on public.client_plans;
create policy "client_plans_select"
on public.client_plans
for select to authenticated
using (
  ((select auth.uid()) = client_id)
  OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = client_plans.gym_id))))
);

-- ============================================================
-- exercise_maxes (patron B, ya estaba TO authenticated)
-- ============================================================
drop policy if exists "trainers read member maxes" on public.exercise_maxes;
drop policy if exists "users manage own maxes" on public.exercise_maxes;
create policy "exercise_maxes_select"
on public.exercise_maxes
for select to authenticated
using (
  (user_id = (select auth.uid()))
  OR (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN profiles trainer ON ((trainer.gym_id = p.gym_id)))
  WHERE ((p.id = exercise_maxes.user_id) AND (trainer.id = (select auth.uid())) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

create policy "users manage own maxes - insert"
on public.exercise_maxes
for insert to authenticated
with check ((user_id = (select auth.uid())));

create policy "users manage own maxes - update"
on public.exercise_maxes
for update to authenticated
using ((user_id = (select auth.uid())))
with check ((user_id = (select auth.uid())));

create policy "users manage own maxes - delete"
on public.exercise_maxes
for delete to authenticated
using ((user_id = (select auth.uid())));

-- ============================================================
-- exercises (patron A + un policy redundante que se borra)
-- ============================================================
drop policy if exists "admins can manage exercises" on public.exercises;
-- "trainers can manage exercises" ya cubre admin+trainer; admin-only era subconjunto.

drop policy if exists "trainers can manage exercises" on public.exercises;
create policy "trainers can manage exercises - insert"
on public.exercises
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "trainers can manage exercises - update"
on public.exercises
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "trainers can manage exercises - delete"
on public.exercises
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "authenticated users can read exercises" on public.exercises;
create policy "authenticated users can read exercises"
on public.exercises
for select to authenticated
using (true);

-- ============================================================
-- foods (patron A)
-- ============================================================
drop policy if exists "foods_write" on public.foods;
create policy "foods_write - insert"
on public.foods
for insert to authenticated
with check ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "foods_write - update"
on public.foods
for update to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "foods_write - delete"
on public.foods
for delete to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "foods_read" on public.foods;
create policy "foods_read"
on public.foods
for select to authenticated
using (((gym_id IS NULL) OR (gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))));

-- ============================================================
-- gyms (patron A)
-- ============================================================
drop policy if exists "gym owners can manage their gym" on public.gyms;
create policy "gym owners can manage their gym - insert"
on public.gyms
for insert to authenticated
with check (((select auth.uid()) = owner_id));

create policy "gym owners can manage their gym - update"
on public.gyms
for update to authenticated
using (((select auth.uid()) = owner_id));

create policy "gym owners can manage their gym - delete"
on public.gyms
for delete to authenticated
using (((select auth.uid()) = owner_id));

drop policy if exists "authenticated users can read gyms" on public.gyms;
create policy "authenticated users can read gyms"
on public.gyms
for select to authenticated
using (true);

-- ============================================================
-- machine_exercises (patron A)
-- ============================================================
drop policy if exists "staff can manage machine_exercises" on public.machine_exercises;
create policy "staff can manage machine_exercises - insert"
on public.machine_exercises
for insert to authenticated
with check ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "staff can manage machine_exercises - update"
on public.machine_exercises
for update to authenticated
using ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "staff can manage machine_exercises - delete"
on public.machine_exercises
for delete to authenticated
using ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "gym members can read machine_exercises" on public.machine_exercises;
create policy "gym members can read machine_exercises"
on public.machine_exercises
for select to authenticated
using ((machine_id IN ( SELECT m.id
   FROM (machines m
     JOIN profiles p ON ((p.gym_id = m.gym_id)))
  WHERE (p.id = (select auth.uid())))));

-- ============================================================
-- machines (patron A)
-- ============================================================
drop policy if exists "staff can manage machines" on public.machines;
create policy "staff can manage machines - insert"
on public.machines
for insert to authenticated
with check ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "staff can manage machines - update"
on public.machines
for update to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "staff can manage machines - delete"
on public.machines
for delete to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "gym members can read machines" on public.machines;
create policy "gym members can read machines"
on public.machines
for select to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))));

-- ============================================================
-- membership_plans (patron A, con with_check explicito)
-- ============================================================
drop policy if exists "admins manage gym membership plans" on public.membership_plans;
create policy "admins manage gym membership plans - insert"
on public.membership_plans
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))));

create policy "admins manage gym membership plans - update"
on public.membership_plans
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))));

create policy "admins manage gym membership plans - delete"
on public.membership_plans
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id) AND (p.role = 'admin'::text)))));

drop policy if exists "members read gym membership plans" on public.membership_plans;
create policy "members read gym membership plans"
on public.membership_plans
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.gym_id = membership_plans.gym_id)))));

-- ============================================================
-- nutrition_log_items (patron B)
-- ============================================================
drop policy if exists "nutrition_log_items_member" on public.nutrition_log_items;
create policy "nutrition_log_items_member - insert"
on public.nutrition_log_items
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM nutrition_logs nl
  WHERE ((nl.id = nutrition_log_items.log_id) AND (nl.member_id = (select auth.uid()))))));

create policy "nutrition_log_items_member - update"
on public.nutrition_log_items
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM nutrition_logs nl
  WHERE ((nl.id = nutrition_log_items.log_id) AND (nl.member_id = (select auth.uid()))))));

create policy "nutrition_log_items_member - delete"
on public.nutrition_log_items
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM nutrition_logs nl
  WHERE ((nl.id = nutrition_log_items.log_id) AND (nl.member_id = (select auth.uid()))))));

drop policy if exists "nutrition_log_items_trainer_read" on public.nutrition_log_items;
create policy "nutrition_log_items_select"
on public.nutrition_log_items
for select to authenticated
using (
  (EXISTS ( SELECT 1
   FROM nutrition_logs nl
  WHERE ((nl.id = nutrition_log_items.log_id) AND (nl.member_id = (select auth.uid())))))
  OR (EXISTS ( SELECT 1
   FROM ((nutrition_logs nl
     JOIN profiles member ON ((member.id = nl.member_id)))
     JOIN profiles trainer ON ((trainer.gym_id = member.gym_id)))
  WHERE ((nl.id = nutrition_log_items.log_id) AND (trainer.id = (select auth.uid())) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

-- ============================================================
-- nutrition_logs (patron B)
-- ============================================================
drop policy if exists "nutrition_logs_member" on public.nutrition_logs;
create policy "nutrition_logs_member - insert"
on public.nutrition_logs
for insert to authenticated
with check ((member_id = (select auth.uid())));

create policy "nutrition_logs_member - update"
on public.nutrition_logs
for update to authenticated
using ((member_id = (select auth.uid())));

create policy "nutrition_logs_member - delete"
on public.nutrition_logs
for delete to authenticated
using ((member_id = (select auth.uid())));

drop policy if exists "nutrition_logs_trainer_read" on public.nutrition_logs;
create policy "nutrition_logs_select"
on public.nutrition_logs
for select to authenticated
using (
  (member_id = (select auth.uid()))
  OR (member_id IN ( SELECT p.id
   FROM (profiles p
     JOIN profiles me ON ((me.gym_id = p.gym_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

-- ============================================================
-- nutrition_meal_items (patron A — "read" alcanza via recursion de RLS
-- de nutrition_meals/nutrition_plans, "write" es subconjunto)
-- ============================================================
drop policy if exists "nutrition_meal_items_write" on public.nutrition_meal_items;
create policy "nutrition_meal_items_write - insert"
on public.nutrition_meal_items
for insert to authenticated
with check ((meal_id IN ( SELECT nm.id
   FROM ((nutrition_meals nm
     JOIN nutrition_plans np ON ((np.id = nm.plan_id)))
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_meal_items_write - update"
on public.nutrition_meal_items
for update to authenticated
using ((meal_id IN ( SELECT nm.id
   FROM ((nutrition_meals nm
     JOIN nutrition_plans np ON ((np.id = nm.plan_id)))
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_meal_items_write - delete"
on public.nutrition_meal_items
for delete to authenticated
using ((meal_id IN ( SELECT nm.id
   FROM ((nutrition_meals nm
     JOIN nutrition_plans np ON ((np.id = nm.plan_id)))
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "nutrition_meal_items_read" on public.nutrition_meal_items;
create policy "nutrition_meal_items_read"
on public.nutrition_meal_items
for select to authenticated
using ((meal_id IN ( SELECT nutrition_meals.id
   FROM nutrition_meals)));

-- ============================================================
-- nutrition_meals (patron A, mismo razonamiento que meal_items)
-- ============================================================
drop policy if exists "nutrition_meals_write" on public.nutrition_meals;
create policy "nutrition_meals_write - insert"
on public.nutrition_meals
for insert to authenticated
with check ((plan_id IN ( SELECT np.id
   FROM (nutrition_plans np
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_meals_write - update"
on public.nutrition_meals
for update to authenticated
using ((plan_id IN ( SELECT np.id
   FROM (nutrition_plans np
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_meals_write - delete"
on public.nutrition_meals
for delete to authenticated
using ((plan_id IN ( SELECT np.id
   FROM (nutrition_plans np
     JOIN profiles p ON ((p.gym_id = np.gym_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "nutrition_meals_read" on public.nutrition_meals;
create policy "nutrition_meals_read"
on public.nutrition_meals
for select to authenticated
using ((plan_id IN ( SELECT nutrition_plans.id
   FROM nutrition_plans)));

-- ============================================================
-- nutrition_plans (patron A)
-- ============================================================
drop policy if exists "nutrition_plans_write" on public.nutrition_plans;
create policy "nutrition_plans_write - insert"
on public.nutrition_plans
for insert to authenticated
with check ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_plans_write - update"
on public.nutrition_plans
for update to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

create policy "nutrition_plans_write - delete"
on public.nutrition_plans
for delete to authenticated
using ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))));

drop policy if exists "nutrition_plans_read" on public.nutrition_plans;
create policy "nutrition_plans_read"
on public.nutrition_plans
for select to authenticated
using (((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND ((member_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text]))))))));

-- ============================================================
-- payments (cruft real + patron B)
-- ============================================================
drop policy if exists "admins can view gym payments" on public.payments;
-- subconjunto exacto de gym_admin_select_payments (admin only vs admin+trainer+owner)
drop policy if exists "members can view own payments" on public.payments;
-- duplicado exacto de member_select_own_payments

drop policy if exists "gym_admin_select_payments" on public.payments;
drop policy if exists "member_select_own_payments" on public.payments;
create policy "payments_select"
on public.payments
for select to authenticated
using (
  (member_id = (select auth.uid()))
  OR (gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.owner_id = (select auth.uid()))))
  OR (gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

drop policy if exists "admin_insert_payments" on public.payments;
create policy "admin_insert_payments"
on public.payments
for insert to authenticated
with check ((gym_id IN ( SELECT profiles.gym_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));

-- ============================================================
-- profiles (patron B)
-- ============================================================
drop policy if exists "staff can read profiles in their gym" on public.profiles;
drop policy if exists "users can read own profile" on public.profiles;
create policy "profiles_select"
on public.profiles
for select to authenticated
using (
  ((select auth.uid()) = id)
  OR (((select get_my_role()) = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (gym_id = (select get_my_gym_id())))
);

drop policy if exists "staff can update profiles in their gym" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
create policy "profiles_update"
on public.profiles
for update to authenticated
using (
  ((select auth.uid()) = id)
  OR (((select get_my_role()) = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (gym_id = (select get_my_gym_id())))
)
with check (
  ((select auth.uid()) = id)
  OR (((select get_my_role()) = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (gym_id = (select get_my_gym_id())))
);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert to authenticated
with check (((select auth.uid()) = id));

-- ============================================================
-- user_achievements (patron B)
-- ============================================================
drop policy if exists "admins read gym earned" on public.user_achievements;
drop policy if exists "users read own earned" on public.user_achievements;
create policy "user_achievements_select"
on public.user_achievements
for select to authenticated
using (
  (user_id = (select auth.uid()))
  OR (EXISTS ( SELECT 1
   FROM (profiles me
     JOIN profiles target ON ((target.id = user_achievements.user_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (me.gym_id = target.gym_id))))
);

-- ============================================================
-- weight_logs (patron B)
-- ============================================================
drop policy if exists "weight_logs_member" on public.weight_logs;
create policy "weight_logs_member - insert"
on public.weight_logs
for insert to authenticated
with check ((member_id = (select auth.uid())));

create policy "weight_logs_member - update"
on public.weight_logs
for update to authenticated
using ((member_id = (select auth.uid())));

create policy "weight_logs_member - delete"
on public.weight_logs
for delete to authenticated
using ((member_id = (select auth.uid())));

drop policy if exists "weight_logs_trainer_read" on public.weight_logs;
create policy "weight_logs_select"
on public.weight_logs
for select to authenticated
using (
  (member_id = (select auth.uid()))
  OR (member_id IN ( SELECT p.id
   FROM (profiles p
     JOIN profiles me ON ((me.gym_id = p.gym_id)))
  WHERE ((me.id = (select auth.uid())) AND (me.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

-- ============================================================
-- workout_plan_days (patron B, 3 condiciones distintas para "es mi plan"
-- + staff con gym_id ya corregido)
-- ============================================================
drop policy if exists "Staff can manage plan days" on public.workout_plan_days;
create policy "Staff can manage plan days - insert"
on public.workout_plan_days
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))));

create policy "Staff can manage plan days - update"
on public.workout_plan_days
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))))
with check ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))));

create policy "Staff can manage plan days - delete"
on public.workout_plan_days
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM (workout_plans wp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wp.id = workout_plan_days.plan_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id)))));

drop policy if exists "Members can read their plan days" on public.workout_plan_days;
drop policy if exists "members can read their plan days" on public.workout_plan_days;
create policy "workout_plan_days_select"
on public.workout_plan_days
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM workout_plans wp
  WHERE ((wp.id = workout_plan_days.plan_id) AND ((wp.assigned_to = (select auth.uid())) OR (wp.created_by = (select auth.uid())) OR wp.is_template)))));

-- ============================================================
-- workout_plan_exercises (mismo patron que workout_plan_days)
-- ============================================================
-- "plan owner can manage exercises" le daba a wp.created_by acceso de
-- escritura independiente del rol actual del usuario (si un trainer que
-- creo el plan pierde el rol despues, igual podia seguir editando). Se
-- preserva esa condicion con OR en vez de descartarla — esto es una
-- limpieza de performance, no el lugar para tightenear semantics.
drop policy if exists "Staff can manage plan exercises" on public.workout_plan_exercises;
drop policy if exists "plan owner can manage exercises" on public.workout_plan_exercises;
create policy "workout_plan_exercises_insert"
on public.workout_plan_exercises
for insert to authenticated
with check (
  (EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id))))
  OR (EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (wp.created_by = (select auth.uid())))))
);

create policy "workout_plan_exercises_update"
on public.workout_plan_exercises
for update to authenticated
using (
  (EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id))))
  OR (EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (wp.created_by = (select auth.uid())))))
)
with check (
  (EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id))))
  OR (EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (wp.created_by = (select auth.uid())))))
);

create policy "workout_plan_exercises_delete"
on public.workout_plan_exercises
for delete to authenticated
using (
  (EXISTS ( SELECT 1
   FROM ((workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (p.gym_id = wp.gym_id))))
  OR (EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND (wp.created_by = (select auth.uid())))))
);

drop policy if exists "Members can read their plan exercises" on public.workout_plan_exercises;
drop policy if exists "members can read their plan exercises" on public.workout_plan_exercises;
create policy "workout_plan_exercises_select"
on public.workout_plan_exercises
for select to authenticated
using ((EXISTS ( SELECT 1
   FROM (workout_plan_days wpd
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpd.id = workout_plan_exercises.day_id) AND ((wp.assigned_to = (select auth.uid())) OR (wp.created_by = (select auth.uid())) OR wp.is_template)))));

-- ============================================================
-- workout_plan_set_configs (patron B, ya estaba TO authenticated)
-- ============================================================
drop policy if exists "trainer manage set configs" on public.workout_plan_set_configs;
create policy "trainer manage set configs - insert"
on public.workout_plan_set_configs
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM (((profiles p
     JOIN workout_plans wp ON ((wp.gym_id = p.gym_id)))
     JOIN workout_plan_days wpd ON ((wpd.plan_id = wp.id)))
     JOIN workout_plan_exercises wpe ON ((wpe.day_id = wpd.id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (wpe.id = workout_plan_set_configs.exercise_id)))));

create policy "trainer manage set configs - update"
on public.workout_plan_set_configs
for update to authenticated
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

create policy "trainer manage set configs - delete"
on public.workout_plan_set_configs
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM (((profiles p
     JOIN workout_plans wp ON ((wp.gym_id = p.gym_id)))
     JOIN workout_plan_days wpd ON ((wpd.plan_id = wp.id)))
     JOIN workout_plan_exercises wpe ON ((wpe.day_id = wpd.id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (wpe.id = workout_plan_set_configs.exercise_id)))));

drop policy if exists "member read own set configs" on public.workout_plan_set_configs;
create policy "workout_plan_set_configs_select"
on public.workout_plan_set_configs
for select to authenticated
using (
  (EXISTS ( SELECT 1
   FROM ((workout_plan_exercises wpe
     JOIN workout_plan_days wpd ON ((wpd.id = wpe.day_id)))
     JOIN workout_plans wp ON ((wp.id = wpd.plan_id)))
  WHERE ((wpe.id = workout_plan_set_configs.exercise_id) AND (wp.assigned_to = (select auth.uid())))))
  OR (EXISTS ( SELECT 1
   FROM (((profiles p
     JOIN workout_plans wp ON ((wp.gym_id = p.gym_id)))
     JOIN workout_plan_days wpd ON ((wpd.plan_id = wp.id)))
     JOIN workout_plan_exercises wpe ON ((wpe.day_id = wpd.id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (wpe.id = workout_plan_set_configs.exercise_id))))
);

-- ============================================================
-- workout_plans (subconjunto redundante + patron B con 2 condiciones
-- "es mi plan" que quedaron de features distintas)
-- ============================================================
drop policy if exists "admins can read plans in their gym" on public.workout_plans;
-- ahora subconjunto estricto de "trainers manage plans", que ya compara gym_id.

drop policy if exists "trainers manage plans" on public.workout_plans;
create policy "trainers manage plans - insert"
on public.workout_plans
for insert to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_plans.gym_id)))));

create policy "trainers manage plans - update"
on public.workout_plans
for update to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_plans.gym_id)))));

create policy "trainers manage plans - delete"
on public.workout_plans
for delete to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_plans.gym_id)))));

drop policy if exists "members can read their assigned plan" on public.workout_plans;
drop policy if exists "members read assigned plans" on public.workout_plans;
create policy "workout_plans_select"
on public.workout_plans
for select to authenticated
using (
  ((select auth.uid()) = assigned_to)
  OR (is_template = true)
  OR (created_by = (select auth.uid()))
  OR (EXISTS ( SELECT 1
   FROM client_plans
  WHERE ((client_plans.plan_id = workout_plans.id) AND (client_plans.client_id = (select auth.uid())))))
);

-- ============================================================
-- workout_session_sets (patron B, ya estaba TO authenticated)
-- ============================================================
drop policy if exists "users read own session sets" on public.workout_session_sets;
drop policy if exists "trainers read gym member session sets" on public.workout_session_sets;
create policy "workout_session_sets_select"
on public.workout_session_sets
for select to authenticated
using (
  (EXISTS ( SELECT 1
   FROM workout_sessions ws
  WHERE ((ws.id = workout_session_sets.session_id) AND (ws.user_id = (select auth.uid())))))
  OR (EXISTS ( SELECT 1
   FROM ((workout_sessions ws
     JOIN profiles member ON ((member.id = ws.user_id)))
     JOIN profiles trainer ON ((trainer.id = (select auth.uid()))))
  WHERE ((ws.id = workout_session_sets.session_id) AND (member.gym_id = trainer.gym_id) AND (trainer.role = ANY (ARRAY['admin'::text, 'trainer'::text])))))
);

-- ============================================================
-- workout_sessions (patron B; "trainers can read" ya viene con gym_id
-- corregido por la migracion anterior)
-- ============================================================
drop policy if exists "members can read own sessions" on public.workout_sessions;
drop policy if exists "trainers can read member sessions" on public.workout_sessions;
create policy "workout_sessions_select"
on public.workout_sessions
for select to authenticated
using (
  ((select auth.uid()) = user_id)
  OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['admin'::text, 'trainer'::text])) AND (profiles.gym_id = workout_sessions.gym_id))))
);

drop policy if exists "members can insert own sessions" on public.workout_sessions;
create policy "members can insert own sessions"
on public.workout_sessions
for insert to authenticated
with check (((select auth.uid()) = user_id));
