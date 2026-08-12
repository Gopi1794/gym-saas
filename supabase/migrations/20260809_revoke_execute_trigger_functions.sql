-- supabase/migrations/20260809_revoke_execute_trigger_functions.sql
-- Security Advisor: anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable en 6 funciones que son
-- disparadores de trigger (returns trigger, usan NEW/OLD) — no llamadas
-- directas de la app: handle_new_user, notify_new_member, notify_check_in,
-- notify_achievement_earned, notify_plan_assigned, set_notification_gym_id.
--
-- Invocarlas a mano via /rest/v1/rpc/ ya fallaba en la practica (NEW/OLD no
-- estan asignados fuera del contexto de un trigger), asi que no eran
-- explotables — pero Postgres les habia otorgado EXECUTE a PUBLIC por
-- default de todas formas, y no hay ningun motivo para dejarlas en la
-- superficie publica de la API. Revocar EXECUTE no afecta a los triggers:
-- el disparo de un trigger no pasa por el chequeo de privilegio EXECUTE del
-- rol que hizo el INSERT/UPDATE, Postgres lo invoca directo.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_new_member() from public, anon, authenticated;
revoke execute on function public.notify_check_in() from public, anon, authenticated;
revoke execute on function public.notify_achievement_earned() from public, anon, authenticated;
revoke execute on function public.notify_plan_assigned() from public, anon, authenticated;
revoke execute on function public.set_notification_gym_id() from public, anon, authenticated;
