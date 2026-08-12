-- supabase/migrations/20260809_revoke_anon_execute_auth_helpers.sql
-- Security Advisor: anon_security_definer_function_executable en
-- get_my_gym_id, get_my_role, get_gym_mp_token, set_gym_mp_token.
--
-- Las cuatro dependen de auth.uid() (get_my_gym_id/get_my_role las usan las
-- policies RLS de sesiones autenticadas; get_gym_mp_token/set_gym_mp_token
-- validan admin+gym adentro del cuerpo) — anon nunca tiene una sesion valida,
-- asi que no gana nada pudiendo llamarlas, y perderlo no le saca nada a nadie.
-- No se toca el grant a `authenticated`: las RLS policies y el panel de
-- Administracion (token de MercadoPago) siguen necesitando esas cuatro.
--
-- Correccion tras autorevision con el MCP de Supabase conectado: la primera
-- version de este archivo revocaba de `anon` puntualmente, pero el ACL real
-- (pg_proc.proacl) mostraba el grant en `PUBLIC` (entrada "=X", sin nombre de
-- rol) — anon hereda todo lo de PUBLIC automaticamente, asi que revocarle a
-- anon un privilegio que nunca tuvo aparte no hace nada; la puerta seguia
-- abierta por PUBLIC. Confirmado con el linter: estas 4 seguian apareciendo
-- para anon despues de correr la version vieja. El fix real es revocar de
-- `public`, que cubre a anon (y a cualquier rol futuro) de una.
--
-- get_my_gym_id/get_my_role no tienen su CREATE FUNCTION en ninguna
-- migracion de este repo (se crearon a mano en el dashboard en algun
-- momento) — queda pendiente aparte traer su definicion real a una
-- migracion versionada, este archivo solo corrige el grant de EXECUTE.

revoke execute on function public.get_my_gym_id() from public;
revoke execute on function public.get_my_role() from public;
revoke execute on function public.get_gym_mp_token(uuid) from public;
revoke execute on function public.set_gym_mp_token(uuid, text) from public;

grant execute on function public.get_my_gym_id() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_gym_mp_token(uuid) to authenticated;
grant execute on function public.set_gym_mp_token(uuid, text) to authenticated;
