-- supabase/migrations/20260809_drop_duplicate_indexes.sql
-- Performance Advisor: duplicate_index en 4 tablas. Verificado con
-- pg_indexes que las 4 parejas son identicas byte a byte (mismas columnas,
-- mismo WHERE parcial cuando aplica) antes de tocar nada.
--
-- exercise_favorites, user_achievements y workout_plan_days: un lado de
-- cada pareja es la unique constraint real (backing un `unique(...)` de
-- tabla, sale por pg_constraint), el otro es un indice suelto creado
-- despues con las mismas columnas — probablemente al armar el ON CONFLICT
-- de cada insert, sin notar que ya existia la constraint. Se borra el
-- indice suelto, se deja la constraint (no se puede borrar un indice que
-- respalda una constraint sin antes borrar la constraint misma).
--
-- notifications: ninguno de los dos es una constraint, son dos indices
-- unicos parciales sueltos con exactamente la misma definicion
-- (user_id, dedup_key) where dedup_key is not null. Se deja
-- notifications_dedup_idx porque es el nombre que ya aparece referenciado
-- en comentarios de app/actions/nutrition-tracking.ts (manejo del error
-- 23505 de unique_violation) — cambiar cual sobrevive ahi evitaria tener
-- que tocar esos comentarios.
--
-- Ningun ON CONFLICT del codigo referencia estos indices por nombre (todos
-- usan ON CONFLICT (columnas), que Postgres resuelve contra CUALQUIER
-- indice/constraint unico que cubra esas columnas) — dejar uno solo de
-- cada pareja no rompe ningun insert existente.

drop index if exists public.exercise_favorites_user_exercise_uidx;
drop index if exists public.user_achievements_user_achievement_uidx;
drop index if exists public.workout_plan_days_plan_day_uidx;
drop index if exists public.notifications_user_dedup_uidx;
