-- supabase/migrations/20260809_restrict_public_bucket_listing.sql
-- Security Advisor: public_bucket_allows_listing en avatar, exercise-images
-- y machine-images. Los tres son buckets publicos a proposito (avatares,
-- fotos de ejercicios, fotos de maquinas — contenido que cualquiera puede
-- ver), pero la policy de SELECT amplia que tenian ("bucket_id = 'x'", sin
-- mas condicion) tambien habilita listar TODOS los archivos del bucket via
-- la API de Storage, no solo pedirlos por nombre conocido.
--
-- Un bucket publico sirve los objetos por URL (/storage/v1/object/public/...)
-- SIN evaluar ninguna policy — la regla del proyecto (CLAUDE.md, seguridad
-- Supabase #14) ya lo documenta. La policy de SELECT solo hace falta para
-- listar/consultar storage.objects, no para que getPublicUrl() funcione.
-- Confirmado en el codigo: todo uso de estos tres buckets es .upload() o
-- .getPublicUrl() (que ni siquiera pega contra la red) — ningun .list() en
-- todo el proyecto. Sacar la policy no rompe nada y cierra el listado.

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Exercise images are publicly readable" on storage.objects;
drop policy if exists "Public read machine images" on storage.objects;
