-- supabase/migrations/20260812_index_cleanup.sql
-- Performance Advisor, nivel INFO (no WARN): unindexed_foreign_keys (33) y
-- unused_index (4). Menor prioridad que lo de las dos migraciones
-- anteriores, pero mientras estamos en esto lo cerramos.
--
-- Los 33 CREATE INDEX son directos: cada foreign key sin indice propio
-- obliga a Postgres a hacer seq scan cuando el lado padre borra/actualiza
-- (para chequear si quedan filas hijas) o cuando se filtra/joinea por esa
-- columna directamente.
--
-- De los 4 unused_index, se borran 3 y se deja 1:
-- - exercises_external_id_idx: duplicado exacto del indice que ya genera
--   el UNIQUE constraint exercises_external_id_key sobre la misma columna
--   (confirmado via pg_indexes) — pura redundancia.
-- - profiles_trainer_id_idx: confirmado en el codigo (app/actions/members.ts,
--   nutrition-tracking.ts, members/[id]/page.tsx) que trainer_id solo se
--   lee como columna de salida, nunca se filtra `where trainer_id = ...`.
-- - notifications_gym_id_idx: ninguna policy de notifications ni query de
--   la app filtra por gym_id (las tres policies de notifications filtran
--   solo por user_id).
-- - workout_sessions_gym_id_idx: NO se borra. La policy
--   "workout_sessions_select" (de la migracion de consolidacion de mas
--   arriba) recien empezo a comparar profiles.gym_id = workout_sessions.gym_id
--   para la rama de staff — el "unused" es historial de ANTES de ese fix,
--   no una senal confiable de que no sirva de aca en adelante.

-- ============================================================
-- unindexed_foreign_keys (33)
-- ============================================================
create index if not exists achievements_gym_id_fkey_idx on public.achievements (gym_id);
create index if not exists ai_audit_logs_gym_id_fkey_idx on public.ai_audit_logs (gym_id);
create index if not exists ai_audit_logs_plan_id_fkey_idx on public.ai_audit_logs (plan_id);
create index if not exists ai_audit_logs_user_id_fkey_idx on public.ai_audit_logs (user_id);
create index if not exists chat_logs_gym_id_fkey_idx on public.chat_logs (gym_id);
create index if not exists check_ins_gym_id_fkey_idx on public.check_ins (gym_id);
create index if not exists client_plans_assigned_by_fkey_idx on public.client_plans (assigned_by);
create index if not exists client_plans_client_gym_fkey_idx on public.client_plans (client_id, gym_id);
create index if not exists client_plans_plan_gym_fkey_idx on public.client_plans (plan_id, gym_id);
create index if not exists exercise_favorites_exercise_id_fkey_idx on public.exercise_favorites (exercise_id);
create index if not exists exercise_maxes_exercise_id_fkey_idx on public.exercise_maxes (exercise_id);
create index if not exists gyms_owner_id_fkey_idx on public.gyms (owner_id);
create index if not exists machine_exercises_exercise_id_fkey_idx on public.machine_exercises (exercise_id);
create index if not exists machines_gym_id_fkey_idx on public.machines (gym_id);
create index if not exists nutrition_food_favorites_food_id_fkey_idx on public.nutrition_food_favorites (food_id);
create index if not exists nutrition_log_items_food_id_fkey_idx on public.nutrition_log_items (food_id);
create index if not exists nutrition_logs_meal_id_fkey_idx on public.nutrition_logs (meal_id);
create index if not exists nutrition_meal_items_food_id_fkey_idx on public.nutrition_meal_items (food_id);
create index if not exists nutrition_plans_created_by_fkey_idx on public.nutrition_plans (created_by);
create index if not exists payments_recorded_by_fkey_idx on public.payments (recorded_by);
create index if not exists payments_recorded_by_gym_fkey_idx on public.payments (recorded_by, gym_id);
create index if not exists quick_log_entries_meal_id_fkey_idx on public.quick_log_entries (meal_id);
create index if not exists quick_log_entries_user_id_fkey_idx on public.quick_log_entries (user_id);
create index if not exists user_achievements_achievement_id_fkey_idx on public.user_achievements (achievement_id);
create index if not exists workout_plan_exercises_exercise_id_fkey_idx on public.workout_plan_exercises (exercise_id);
create index if not exists workout_plans_assigned_to_gym_fkey_idx on public.workout_plans (assigned_to, gym_id);
create index if not exists workout_plans_created_by_fkey_idx on public.workout_plans (created_by);
create index if not exists workout_plans_created_by_gym_fkey_idx on public.workout_plans (created_by, gym_id);
create index if not exists workout_session_sets_exercise_id_fkey_idx on public.workout_session_sets (exercise_id);
create index if not exists workout_session_sets_session_id_fkey_idx on public.workout_session_sets (session_id);
create index if not exists workout_sessions_plan_gym_fkey_idx on public.workout_sessions (plan_id, gym_id);
create index if not exists workout_sessions_plan_id_fkey_idx on public.workout_sessions (plan_id);
create index if not exists workout_sessions_user_gym_fkey_idx on public.workout_sessions (user_id, gym_id);

-- ============================================================
-- unused_index (3 de 4 — ver comentario de arriba)
-- ============================================================
drop index if exists public.exercises_external_id_idx;
drop index if exists public.profiles_trainer_id_idx;
drop index if exists public.notifications_gym_id_idx;
