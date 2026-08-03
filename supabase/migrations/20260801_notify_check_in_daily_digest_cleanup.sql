-- supabase/migrations/20260801_notify_check_in_daily_digest_cleanup.sql
-- Las notificaciones de check_in del modelo viejo (una por evento) no tienen
-- equivalente en el modelo nuevo (una por admin/día) — se descartan, no se
-- convierten. Nombrada para correr después de
-- 20260801_notify_check_in_daily_digest.sql (orden alfabético: el nombre de
-- esta migración es un prefijo + sufijo de la otra).

delete from notifications where type = 'check_in';
