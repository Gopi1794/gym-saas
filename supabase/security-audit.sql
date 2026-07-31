-- ============================================================
-- AUDITORÍA DE SEGURIDAD — Supabase / Postgres
-- Correr en el SQL Editor. Ninguna consulta modifica nada.
--
-- ANTES DE ESTO: Dashboard → Advisors → Security Advisor.
-- El linter integrado detecta casi todo esto solo. Este script
-- sirve para entender el detalle y para lo que el linter no cubre.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ¿Toda tabla pública tiene RLS activo?
--    Esperado: ninguna fila con rowsecurity = false.
--    Una tabla sin RLS es de lectura/escritura pública para
--    cualquiera con la clave publishable.
-- ------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;


-- ------------------------------------------------------------
-- 2. ¿Alguna tabla tiene RLS activo pero cero policies?
--    Esperado: ninguna con policies = 0.
--    RLS sin policies bloquea todo en silencio: la app muestra
--    listas vacías sin tirar un solo error.
-- ------------------------------------------------------------
select t.tablename, count(p.policyname) as policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename
order by policies, t.tablename;


-- ------------------------------------------------------------
-- 3. Policies abiertas — LA CONSULTA MÁS IMPORTANTE
--    Esperado: solo filas con roles = {service_role}.
--    Cualquier {public} o {authenticated} con qual = true es un
--    agujero: las policies permisivas se suman con OR, así que
--    una sola laxa anula a todas las estrictas de esa tabla.
-- ------------------------------------------------------------
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;


-- ------------------------------------------------------------
-- 4. Policies de Storage
--    Viven en el esquema 'storage', NO en 'public'.
--    Una auditoría filtrada por public no las ve.
--    Buscar: escritura para {public}, o condiciones que solo
--    validan bucket_id sin alcance por dueño o inquilino.
-- ------------------------------------------------------------
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
order by cmd, policyname;


-- ------------------------------------------------------------
-- 5. Funciones SECURITY DEFINER y quién puede ejecutarlas
--    Estas funciones IGNORAN RLS por completo.
--    Postgres otorga EXECUTE a PUBLIC por defecto, y Supabase
--    expone toda función del esquema public como endpoint RPC.
--    Esperado para funciones de servidor:
--      anon_puede = false, autenticado_puede = false, service_puede = true
-- ------------------------------------------------------------
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  has_function_privilege('anon',          p.oid, 'execute') as anon_puede,
  has_function_privilege('authenticated', p.oid, 'execute') as autenticado_puede,
  has_function_privilege('service_role',  p.oid, 'execute') as service_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by anon_puede desc, autenticado_puede desc, p.proname;


-- ------------------------------------------------------------
-- 6. Cuerpo de una función sospechosa
--    Si el cuerpo no valida al llamador, la función NO está
--    protegida — sin importar lo que diga el comentario.
--    Patrón esperado para funciones llamables por usuarios:
--      if not exists (select 1 from profiles
--                     where id = (select auth.uid()) and ...)
--      then raise exception 'Not authorized'; end if;
-- ------------------------------------------------------------
-- select pg_get_functiondef(p.oid)
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'REEMPLAZAR';


-- ------------------------------------------------------------
-- 7. Funciones SECURITY DEFINER sin search_path fijo
--    Esperado: ninguna fila.
--    Sin search_path fijo quedan expuestas a secuestro de esquema.
-- ------------------------------------------------------------
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (p.proconfig is null or not exists (
    select 1 from unnest(p.proconfig) c where c like 'search_path=%'
  ));


-- ------------------------------------------------------------
-- 8. Policies que usan auth.uid() sin envolver en subconsulta
--    No es un agujero: es performance.
--    auth.uid() pelado se re-evalúa por fila.
--    (select auth.uid()) se cachea una vez por consulta.
-- ------------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  and (qual not like '%( SELECT auth.uid()%' or qual is null)
order by tablename;


-- ------------------------------------------------------------
-- 9. Probar un permiso sin dejar rastro
--    'set local role' te hace pasar por ese rol.
--    'rollback' deshace todo: probás en producción sin efectos.
-- ------------------------------------------------------------
-- begin;
-- set local role service_role;
-- select public.mi_funcion(gen_random_uuid(), 'prueba');
-- rollback;


-- ------------------------------------------------------------
-- 10. VERIFICACIÓN DESDE AFUERA — no se hace en SQL
--     Lo anterior dice qué configuraste. Esto dice qué pasa
--     realmente cuando alguien golpea la puerta.
--
--     En ventana de incógnito, con la clave PUBLISHABLE
--     (nunca la secreta):
--
--     https://TU-PROYECTO.supabase.co/rest/v1/TABLA?select=*&apikey=PUBLISHABLE_KEY
--
--     Esperado: []
--     Si devuelve datos, hay una filtración real.
-- ------------------------------------------------------------
