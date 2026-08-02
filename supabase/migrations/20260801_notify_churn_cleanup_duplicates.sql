-- supabase/migrations/20260801_notify_churn_cleanup_duplicates.sql
-- Limpieza de una sola vez de los duplicados que generó el dedup_key con
-- fecha (ver 20260801_fix_notify_churn_members_dedup.sql) — algunos socios
-- llegaron a acumular ~40 notificaciones idénticas.

-- Por cada (user_id, member_id) de tipo churn_alert, dejar solo la fila más
-- reciente. Filtro metadata->>'member_id' is not null por las dudas: si
-- alguna fila legacy no lo tuviera, agruparla junto a otras por NULL sería
-- incorrecto — mejor dejarla afuera del colapso que borrarla por error.
delete from notifications n
using (
  select id,
         row_number() over (
           partition by user_id, (metadata->>'member_id')
           order by created_at desc
         ) as rn
  from notifications
  where type = 'churn_alert'
    and metadata->>'member_id' is not null
) dupes
where n.id = dupes.id
  and dupes.rn > 1;

-- Las filas sobrevivientes quedan con el dedup_key viejo (con fecha embebida)
-- — se reescriben al formato nuevo para que la próxima corrida de
-- notify_churn_members() las reconozca como "ya notificado" en vez de
-- insertar una fila más al lado la primera vez que corra.
update notifications
set dedup_key = 'churn:' || user_id::text || ':' || (metadata->>'member_id')
where type = 'churn_alert'
  and metadata->>'member_id' is not null;
