-- supabase/migrations/20260812_restore_fk_covering_indexes.sql
-- Corrige un error de la migracion anterior (20260812_index_cleanup.sql).
--
-- Ahi borre notifications_gym_id_idx y profiles_trainer_id_idx razonando
-- que ninguna query ni policy filtra por esas columnas — cierto, pero
-- incompleto: esos indices tambien eran el indice que cubre la foreign
-- key (notifications_gym_id_fkey, profiles_trainer_id_fkey). Postgres los
-- usa para no hacer table scan cuando se borra/actualiza la fila padre
-- (gyms, profiles), y ese uso NO cuenta como "scan" en
-- pg_stat_user_indexes — por eso el linter los marcaba "unused" sin
-- estarlo realmente. Confirmado en vivo: al correr la migracion anterior,
-- el Performance Advisor volvio a marcar esas dos columnas como
-- unindexed_foreign_keys.
--
-- Se recrean con el mismo nombre que ya tenian antes de borrarlos.

create index if not exists notifications_gym_id_idx on public.notifications (gym_id);
create index if not exists profiles_trainer_id_idx on public.profiles (trainer_id);
