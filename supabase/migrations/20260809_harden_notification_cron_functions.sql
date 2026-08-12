-- supabase/migrations/20260809_harden_notification_cron_functions.sql
-- Hallazgos del Security Advisor (Supabase linter) — dos categorías reales:
--
-- 1. notify_churn_members() y notify_expiring_memberships() son funciones
--    pensadas para correr desde un cron, no desde un usuario: no filtran
--    por gym_id del llamador, recorren TODOS los gimnasios de la base.
--    Postgres otorga EXECUTE a PUBLIC por defecto, y ninguna de las dos
--    valida al llamador adentro del cuerpo — el linter confirmó que
--    anon (sin login) puede invocarlas vía /rest/v1/rpc/. Cualquiera sin
--    cuenta puede forzar un recorrido completo de notificaciones de todos
--    los gimnasios, repetidas veces. Se revoca EXECUTE de todos los roles
--    de API y se deja solo para service_role (el cron/job las llama con
--    esa clave, no con la de un usuario).
--
-- 2. function_search_path_mutable: get_my_gym_id, notify_new_member,
--    notify_achievement_earned y notify_plan_assigned no tienen
--    search_path fijado — evaluado en cada llamada según el search_path
--    de sesión, lo que abre la puerta a secuestro de esquema. Se fija a
--    'public', mismo valor que ya usan get_gym_mp_token/set_gym_mp_token/
--    handle_new_user/notify_churn_members/notify_expiring_memberships/
--    set_notification_gym_id en este mismo proyecto — sus cuerpos
--    referencian tablas sin prefijo de esquema (ej. "from profiles"), así
--    que necesitan que 'public' siga resolviendo. search_path = '' las
--    rompería sin antes calificar cada referencia con public.*.

-- 1. Revocar acceso publico a las funciones tipo cron ------------------

revoke execute on function public.notify_churn_members() from public, anon, authenticated;
grant  execute on function public.notify_churn_members() to service_role;

revoke execute on function public.notify_expiring_memberships() from public, anon, authenticated;
grant  execute on function public.notify_expiring_memberships() to service_role;

-- 2. Fijar search_path en las funciones que lo tenian mutable ----------

alter function public.get_my_gym_id() set search_path = 'public';
alter function public.notify_new_member() set search_path = 'public';
alter function public.notify_achievement_earned() set search_path = 'public';
alter function public.notify_plan_assigned() set search_path = 'public';
