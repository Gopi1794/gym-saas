# Fix: notify_churn_members duplica notificaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `notify_churn_members()` deja de generar una notificación nueva por corrida de cron para el mismo socio en riesgo — el `dedup_key` pasa a estar atado a la condición (admin + socio), no al día — y la función misma limpia las notificaciones de socios que dejaron de estar en riesgo. Una migración aparte colapsa las 533+ filas duplicadas ya existentes.

**Architecture:** Redefinir `notify_churn_members()` con `create or replace function` — mismo esqueleto SQL que ya existe (`member_churn_status` + join a `profiles admin` + `insert ... on conflict do nothing`), dos cambios: el `dedup_key` sin fecha, y un `delete` previo al insert que borra las notificaciones de pares (admin, socio) que ya no están en rojo. La limpieza de datos existentes va en una migración separada, de una sola vez, que primero colapsa duplicados y después reescribe el `dedup_key` de las filas sobrevivientes al formato nuevo — para que la función ya corregida las reconozca como "ya notificado" en la primera corrida después del deploy, en vez de sumar una fila más al lado.

**Tech Stack:** SQL puro (plpgsql, ya `security definer`). Sin cambios de TypeScript ni de la vista `member_churn_status`.

## Global Constraints

- `dedup_key` no lleva fecha ni timestamp — queda atado a `(admin_id, member_id)`, no al momento de la corrida.
- La limpieza de notificaciones resueltas corre en la misma función, en la misma corrida de cron — no un job separado.
- La migración de limpieza de duplicados es de una sola vez, sobre datos existentes — no altera la lógica de la función (eso lo hace la otra migración).
- No se toca `member_churn_status` (la vista) ni la fórmula de qué es "rojo" — el pedido es sobre la dedup, no sobre el criterio de riesgo.

---

## Contexto verificado antes de planificar

1. **Leí la función actual completa** (`supabase/migrations/20260523_notify_churn.sql:14-41`). El `dedup_key` es `'churn:admin:' || admin.id || ':member:' || cs.id || ':' || v_today`, con `v_today := to_char(current_date, 'YYYY-MM-DD')`. El `on conflict (user_id, dedup_key) where dedup_key is not null do nothing` es válido a nivel SQL (repite el mismo predicado parcial que el índice único, a diferencia del bug que encontramos antes en el insert de `weight_drift` desde TypeScript, donde `supabase-js` no podía expresar ese predicado) — el bug acá no es que el `ON CONFLICT` falle, es que la clave cambia todos los días, así que nunca hay conflicto que detectar mientras el socio siga en rojo.

2. **Confirmé los campos de `member_churn_status`** (`supabase/migrations/20260523_churn_status_view.sql:1-29`): `id, gym_id, full_name, avatar_url, membership_type, membership_expires_at, last_check_in, churn_status`. Es una vista normal (no materializada) sobre `profiles` + `check_ins` — siempre refleja el estado actual, así que un `delete ... where not exists (... churn_status = 'red' ...)` en el mismo momento de la corrida ve el estado real, no uno cacheado.

3. **Confirmé que ninguna migración posterior tocó los privilegios de `notify_churn_members()`** — `20260725_lock_down_security_definer_rpcs.sql` revoca/otorga EXECUTE en otras tres funciones, no en esta. El `grant execute on function notify_churn_members() to authenticated` de la migración original sigue vigente, y `create or replace function` no lo resetea (a diferencia de `drop function` + `create function`) — no hace falta volver a otorgarlo.

4. **El `delete` de notificaciones resueltas necesita identificar el socio de cada notificación** — el `dedup_key` viejo tiene el `member_id` embebido como texto pero en un formato que va a dejar de existir; en cambio `metadata->>'member_id'` ya está en cada fila desde el insert original (`jsonb_build_object('member_id', cs.id, ...)`) y es estable independientemente del formato del `dedup_key`. Uso `metadata->>'member_id'` para el anti-join, no el `dedup_key`.

5. **El orden entre las dos migraciones no es simétrico** — si la migración de limpieza corriera antes de arreglar la función, y el cron dispara en el medio, la función vieja (con fecha) insertaría una fila más con el formato de clave viejo, encima de datos recién limpiados. Arreglar la función primero evita esa ventana. Nombro los archivos para que ordenen así (`fix_notify_churn_members_dedup` antes de `notify_churn_cleanup_duplicates`, alfabéticamente).

6. **Extendí la migración de limpieza más allá de solo borrar duplicados**: pediste "borre los duplicados dejando solo el más reciente por (user_id, admin, member)" — como `user_id` en una notificación de churn siempre ES el admin (no hay otro destinatario para este tipo), agrupo por `(user_id, member_id)`, que es lo mismo con un campo menos. Pero dejar las filas sobrevivientes con su `dedup_key` viejo (con fecha) significa que la primera corrida de la función ya arreglada no las va a reconocer como "ya notificado" — va a insertar una fila nueva con la clave nueva al lado de cada sobreviviente, porque las claves no matchean. Agrego un `update` después del `delete`, en la misma migración, que reescribe el `dedup_key` de las filas sobrevivientes al formato nuevo. Sin esto, la migración deja el sistema "casi" arreglado: los 533 se convierten en 1, pero ese 1 se convierte en 2 en la primera corrida post-deploy, y ahí se estabiliza (no vuelve a crecer) — funcionalmente no es grave, pero es un descuido evitable en la misma migración que ya está tocando estas filas.

---

## Task 1 — Redefinir `notify_churn_members()`

**Files:**
- Create: `supabase/migrations/20260801_fix_notify_churn_members_dedup.sql`

- [ ] **Paso 1: escribir la migración**

```sql
-- supabase/migrations/20260801_fix_notify_churn_members_dedup.sql
-- El dedup_key incluía la fecha (v_today), así que cambiaba todos los días y
-- el ON CONFLICT nunca encontraba una fila previa: un socio en rojo 40 días
-- generaba 40 notificaciones idénticas al mismo admin.
--
-- Dos cambios sobre la función original (20260523_notify_churn.sql):
-- 1. dedup_key sin fecha, atado a (admin_id, member_id) — una notificación
--    por socio en riesgo mientras siga en riesgo, no una por corrida.
-- 2. Antes de insertar, borra las notificaciones de churn de pares
--    (admin, socio) que ya no están en rojo — si no, la notificación vieja
--    queda diciendo que el socio sigue en riesgo cuando ya no es cierto.

create or replace function notify_churn_members()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Resuelto: el socio volvió, renovó, o dejó de estar en rojo por lo que
  -- sea — la notificación vieja ya no aplica.
  delete from notifications n
  where n.type = 'churn_alert'
    and not exists (
      select 1
      from member_churn_status cs
      join profiles admin
        on admin.gym_id = cs.gym_id
       and admin.role = 'admin'
      where cs.churn_status = 'red'
        and cs.gym_id is not null
        and admin.id = n.user_id
        and cs.id::text = n.metadata->>'member_id'
    );

  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    'churn_alert',
    'Miembro en riesgo de abandono',
    coalesce(cs.full_name, 'Un miembro') || ' no asiste o tiene la membresía por vencer',
    jsonb_build_object(
      'member_id',   cs.id,
      'member_name', cs.full_name,
      'churn_status', cs.churn_status,
      'last_check_in', cs.last_check_in,
      'membership_expires_at', cs.membership_expires_at
    ),
    'churn:' || admin.id::text || ':' || cs.id::text
  from member_churn_status cs
  join profiles admin
    on admin.gym_id = cs.gym_id
   and admin.role = 'admin'
  where cs.churn_status = 'red'
    and cs.gym_id is not null
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;
```

No hace falta tocar el `grant execute` ni el `cron.schedule` — ninguno de los dos cambia, y `create or replace function` preserva los privilegios ya otorgados.

- [ ] **Paso 2: correr la migración en Supabase y probar manualmente**

En el SQL editor de Supabase, después de correr la migración:

```sql
-- Ver el dedup_key nuevo en acción — correr dos veces seguidas
select notify_churn_members();
select count(*) from notifications where type = 'churn_alert' and created_at > now() - interval '1 minute';
select notify_churn_members();
select count(*) from notifications where type = 'churn_alert' and created_at > now() - interval '1 minute';
```

Esperado: el segundo `count` es igual al primero (no crece) — la segunda corrida no insertó nada nuevo para los mismos socios en rojo, porque el `ON CONFLICT` ahora sí encuentra la fila.

Para probar la limpieza: tomar un socio actualmente en rojo con una notificación de churn activa, hacerle un check-in (o renovarle la membresía) para sacarlo de rojo, correr `select notify_churn_members();` de nuevo, y confirmar que su notificación desapareció:

```sql
select * from notifications
where type = 'churn_alert' and metadata->>'member_id' = '<uuid del socio de prueba>';
```

Esperado: 0 filas.

---

## Task 2 — Limpiar los duplicados existentes

**Files:**
- Create: `supabase/migrations/20260801_notify_churn_cleanup_duplicates.sql`

- [ ] **Paso 1: escribir la migración**

```sql
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
```

- [ ] **Paso 2: correr la migración en Supabase y verificar el resultado**

Antes de correrla, contar cuántas hay (para tener el "antes"):

```sql
select user_id, metadata->>'member_id' as member_id, count(*)
from notifications
where type = 'churn_alert'
group by user_id, metadata->>'member_id'
having count(*) > 1
order by count(*) desc;
```

Esperado antes: varias filas con `count > 1` (el reporte menciona hasta 40 para un mismo socio).

Después de correr la migración, el mismo query no debería devolver ninguna fila:

```sql
select user_id, metadata->>'member_id' as member_id, count(*)
from notifications
where type = 'churn_alert'
group by user_id, metadata->>'member_id'
having count(*) > 1;
```

Esperado: 0 filas.

Y confirmar el formato del `dedup_key` sobreviviente:

```sql
select dedup_key from notifications where type = 'churn_alert' limit 5;
```

Esperado: formato `churn:{uuid}:{uuid}`, sin fecha.

---

## Verificación manual adicional

1. **Campanita del admin:** entrar como admin de un gym con al menos un socio en rojo (sin check-in hace 30+ días, o con membresía vencida/por vencer). Confirmar que la notificación de churn aparece una sola vez, no duplicada.
2. **Resolución real:** hacer que ese socio deje de estar en rojo (check-in, o renovarle la membresía) y correr `select notify_churn_members();` a mano. Confirmar que la notificación desaparece de la campanita del admin (sin recargar hace falta esperar al realtime, o refrescar la página).
3. **Confirmar que el cron sigue programado:** `select * from cron.job where jobname = 'notify-churn-members';` — no debería haber cambiado (ni la migración de Task 1 ni la de Task 2 tocan `cron.schedule`).

---

## Fuera de alcance

- No se cambia el criterio de qué es "rojo" (`member_churn_status`) — el pedido es sobre la dedup, no sobre el umbral de riesgo.
- No se refresca el `metadata` (por ejemplo `last_check_in`) de una notificación existente mientras el socio sigue en rojo entre corridas — el `ON CONFLICT DO NOTHING` no la actualiza. No lo pediste, y el dato relevante (que sigue en riesgo) no cambia mientras siga en rojo.
