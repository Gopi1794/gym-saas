# Check-in: notificación diaria en vez de una por evento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `notify_check_in()` deja de insertar una fila por check-in — pasa a mantener una única fila por (admin, día) que se reescribe (nuevo conteo, `read` vuelve a `false`) en cada check-in. Corrige de paso el bug de que solo un admin recibía la notificación. El panel gana navegación al hacer click en una notificación de check-in, y una migración borra las 105 filas sueltas del modelo viejo.

**Architecture:** `notify_check_in()` se redefine con `create or replace function` — mismo trigger (`after insert on check_ins`), mismo esqueleto que `notify_expiring_memberships`/`notify_churn_members` (insert `on conflict` sobre `dedup_key`), pero acá el conflicto dispara `do update` (reescribe body y `read=false`) en vez de `do nothing` — la notificación representa un conteo del día, no un evento inmutable. El conteo se recalcula con `count(*)` sobre `check_ins` en cada corrida, nunca se guarda ni se incrementa un número. El corte de "día" usa la misma zona horaria que ya usa el resto de la app (Argentina, hardcodeada) — no existe zona horaria por gym en el schema, así que no se inventa una.

**Tech Stack:** SQL puro (plpgsql, `security definer`) para la función y la migración de limpieza. Un cambio chico de UI en `NotificationBell.tsx` (React) para la navegación al click.

## Global Constraints

- `dedup_key = check_in_daily:{admin_id}:{fecha}` — con fecha, a diferencia de `churn`: acá la condición (el conteo) sí cambia genuinamente cada día.
- El conteo se calcula con `count(*)` en el momento del insert/update — nunca se persiste un contador que se incrementa.
- Se cuentan check-ins totales del día, no socios distintos.
- El corte de día usa `America/Argentina/Buenos_Aires` — la misma zona que ya usa `lib/date-ar.ts` y la página `/check-in`.
- Notifica a TODOS los admins del gym, cada uno con su propia fila (el `dedup_key` ya incluye `admin_id`, así que no chocan entre sí).
- Click en la notificación navega a `/check-in`.
- Migración aparte borra las notificaciones `check_in` existentes (105 filas) — no se convierten, se descartan.

---

## Contexto verificado antes de planificar

1. **Leí `notify_check_in()` completa** (`supabase/migrations/20260517_notifications.sql:91-124`). Confirmado el bug exacto: `select id into v_admin_id from profiles where gym_id = v_member.gym_id and role = 'admin' limit 1` — un solo admin, el que Postgres devuelva primero, sin orden garantizado. Y es un `insert` sin `dedup_key`, una fila por evento — de ahí las 105 acumuladas.

2. **Busqué cómo esta misma app define "hoy" en otros lugares, como pediste, antes de inventar un criterio nuevo:**
   - `lib/date-ar.ts:1` — `const TZ = "America/Argentina/Buenos_Aires"`, usado por `todayAR()`/`startOfTodayAR()` en toda la app (dashboard, reports, check-in, QRScanner).
   - `app/(dashboard)/check-in/page.tsx:3,55` — la página a la que este mismo pedido apunta el click (`/check-in`) ya usa `startOfTodayAR()` para filtrar "los check-ins de hoy". Es literalmente la pantalla de destino.
   - `supabase/schema.sql:325-336`, la vista `today_check_ins` — usa `checked_in_at::date = current_date`, que es UTC (la zona de sesión de Postgres en Supabase). Esta vista NO se usa en ningún lado del código (`app/`, `components/`) — es un vestigio, no una fuente de verdad activa. La descarto como criterio.
   - **`gyms` no tiene columna de zona horaria** (`supabase/schema.sql:12-20`) — no existe el concepto de "zona horaria del gimnasio" en el schema, toda la app asume Argentina de forma global. "La zona horaria del gimnasio" en este código es, hoy, Argentina — no invento una columna nueva ni una config por gym que nadie pidió.
   - **Decisión, documentada en el archivo de la migración también:** el corte de día usa `America/Argentina/Buenos_Aires`, calculado en SQL con `AT TIME ZONE`, mismo nombre de zona que `lib/date-ar.ts`. Es el mismo criterio que ya usa `/check-in`, no uno nuevo.

3. **Confirmé que `check_ins` tiene su propia columna `gym_id`** (`supabase/schema.sql:148-155`), no hace falta pasar por `profiles` para saberlo — `NEW.gym_id` ya está en la fila del trigger. Sigo necesitando el join a `profiles` para el nombre del socio (el body lo menciona) y para encontrar los admins.

4. **`check_in` ya es un tipo válido** en el `check` de `notifications.type` desde la migración original — no hace falta tocar la constraint, solo la función.

5. **`NotificationBell.tsx` no tiene navegación por click hoy** (confirmado de nuevo, mismo estado que cuando lo revisé para `weight_drift`) — pero a diferencia de esa vez, acá SÍ me lo pediste explícito con un destino fijo (`/check-in`, no depende de metadata por fila). Agrego un mapa `TYPE_LINK` chico, poblado solo para `check_in` — no construyo navegación genérica para los demás tipos, que no la pidieron.

6. **El `on conflict ... do update` es SQL crudo dentro de la función**, no pasa por `supabase-js` — repite el mismo predicado parcial del índice (`where dedup_key is not null`), igual que `notify_churn_members` y `notify_expiring_memberships` ya hacen con éxito. No es el bug que encontramos en el insert de `weight_drift` desde TypeScript (ahí el problema era que `supabase-js` no puede expresar ese predicado; en SQL crudo sí se puede).

7. **Agrego `set search_path = public`** a la función — no estaba en la versión original de `notify_check_in` (tampoco en `notify_new_member`/`notify_achievement_earned`/`notify_plan_assigned`, del mismo archivo), pero sí está en `notify_churn_members`, la función `security definer` más nueva de este mismo dominio. Ya que estoy reescribiendo la función entera, sumo esto — es exactamente lo que pide la regla de seguridad de este proyecto para toda función `security definer` (evitar secuestro de esquema), y es gratis en este cambio.

---

## Task 1 — Redefinir `notify_check_in()`

**Files:**
- Create: `supabase/migrations/20260801_notify_check_in_daily_digest.sql`

- [ ] **Paso 1: escribir la migración**

```sql
-- supabase/migrations/20260801_notify_check_in_daily_digest.sql
-- notify_check_in() insertaba una fila por check-in (105 acumuladas, casi
-- todas del mismo socio) y solo notificaba a UN admin (limit 1, sin orden
-- garantizado). Pasa a mantener una única fila por (admin, día): se
-- reescribe con el conteo nuevo y read vuelve a false en cada check-in, y
-- notifica a todos los admins del gym.
--
-- "Día" = America/Argentina/Buenos_Aires, mismo criterio que lib/date-ar.ts
-- y /check-in (startOfTodayAR) — no existe zona horaria por gym en el
-- schema, toda la app asume Argentina.

create or replace function notify_check_in()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_name text;
  v_count       integer;
  v_today       text;
begin
  if NEW.gym_id is null then return NEW; end if;

  select full_name into v_member_name from profiles where id = NEW.user_id;

  v_today := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');

  -- Conteo en el momento, sobre check_ins — nunca un número guardado que se
  -- incrementa (dos check-ins simultáneos podrían pisarse).
  select count(*) into v_count
    from check_ins
   where gym_id = NEW.gym_id
     and (checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
       = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

  insert into notifications (user_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    'check_in',
    'Check-ins de hoy',
    v_count::text || ' check-in' || (case when v_count = 1 then '' else 's' end) || ' hoy',
    jsonb_build_object('gym_id', NEW.gym_id, 'check_in_count', v_count, 'last_member_name', v_member_name),
    'check_in_daily:' || admin.id::text || ':' || v_today
  from profiles admin
  where admin.gym_id = NEW.gym_id
    and admin.role = 'admin'
  on conflict (user_id, dedup_key) where dedup_key is not null
  do update set
    body     = excluded.body,
    metadata = excluded.metadata,
    read     = false;

  return NEW;
end;
$$;
```

El trigger `on_check_in` (`after insert on check_ins for each row execute function notify_check_in()`) no cambia — sigue disparando por cada insert, solo cambia qué hace la función adentro.

- [ ] **Paso 2: correr la migración en Supabase y probar manualmente**

```sql
-- Simular dos check-ins seguidos del mismo gym (ajustar los uuid a datos reales)
insert into check_ins (user_id, gym_id) values ('<member-uuid-1>', '<gym-uuid>');
select body, read from notifications where type = 'check_in' order by created_at desc limit 5;

insert into check_ins (user_id, gym_id) values ('<member-uuid-2>', '<gym-uuid>');
select body, read from notifications where type = 'check_in' order by created_at desc limit 5;
```

Esperado: después del segundo insert, sigue habiendo **una sola fila** de `check_in` por admin (no dos), el `body` muestra el conteo actualizado (ej. "2 check-ins hoy"), y `read = false` aunque se haya marcado como leída después del primer check-in.

Con un gym que tenga 2+ admins, confirmar que ambos reciben su propia fila:

```sql
select user_id, body from notifications
where type = 'check_in' and dedup_key like 'check_in_daily:%'
order by created_at desc;
```

Esperado: una fila por admin del gym, mismo `body` (mismo conteo), `user_id` distinto.

---

## Task 2 — Navegación al click en `NotificationBell.tsx`

**Files:**
- Modify: `components/notifications/NotificationBell.tsx`

**Interfaces:**
- Produces: `TYPE_LINK: Partial<Record<NotificationType, string>>` — mapa de tipo → ruta, poblado solo para `check_in` por ahora. Cualquier tipo sin entrada no es clickeable (comportamiento actual, sin cambios).

- [ ] **Paso 1: import de `useRouter`**

Agregar:

```ts
import { useRouter } from "next/navigation"
```

- [ ] **Paso 2: mapa de destinos y handler**

Agregar después de `TYPE_COLOR` (línea 41):

```ts
const TYPE_LINK: Partial<Record<NotificationType, string>> = {
  check_in: "/check-in",
}
```

Dentro del componente, junto a `const supabase = useMemo(...)`:

```ts
const router = useRouter()

function handleNotificationClick(href: string) {
  setOpen(false)
  router.push(href)
}
```

- [ ] **Paso 3: JSX — fila clickeable cuando hay destino**

Reemplazar (dentro del `.map`, líneas 198-237):

```tsx
notifications.map((n) => {
  const Icon = TYPE_ICON[n.type] ?? Bell
  return (
    <div
      key={n.id}
      className={cn(
        "group relative flex gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0",
        !n.read && "bg-zinc-900/60"
      )}
    >
```

por:

```tsx
notifications.map((n) => {
  const Icon = TYPE_ICON[n.type] ?? Bell
  const href = TYPE_LINK[n.type]
  return (
    <div
      key={n.id}
      role={href ? "button" : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={href ? () => handleNotificationClick(href) : undefined}
      onKeyDown={href ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleNotificationClick(href)
        }
      } : undefined}
      className={cn(
        "group relative flex gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0",
        !n.read && "bg-zinc-900/60",
        href && "cursor-pointer hover:bg-zinc-900/40 transition-colors"
      )}
    >
```

El botón de descartar (`dismiss`, línea ~230) ya hace `e.stopPropagation()` antes de cualquier otra cosa — clickear la X no dispara también la navegación de la fila. `role="button"` + `tabIndex`/`onKeyDown` solo se agregan cuando hay `href`, así que el resto de los tipos de notificación quedan exactamente como están, sin foco ni afordancia de click nuevos.

- [ ] **Paso 4: suscribir el canal realtime a `UPDATE` además de `INSERT`**

**Corrección de review**: sin esto el modelo de digest no funciona en vivo — el primer check-in del día es un `INSERT` (llega bien), pero cada check-in siguiente es un `UPDATE` sobre la misma fila (el `on conflict ... do update` de Task 1), y el canal de acá solo escucha `INSERT`. El admin no vería el contador subir sin refrescar, que es justo el comportamiento pedido ("vuelve a resaltarse cuando entra alguien más"). Esto deja de ser "fuera de alcance" — es parte de que la feature funcione.

Agregar un segundo listener en el mismo canal (no reemplazar el de `INSERT`, sumar uno para `UPDATE`), que actualiza la fila en el estado local por `id` en vez de agregarla al principio de la lista:

Reemplazar (dentro de `useEffect`, el bloque del canal):

```ts
    const channel = supabase
      .channel(`notifications:${userId}:${seqRef.current}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()
```

por:

```ts
    const channel = supabase
      .channel(`notifications:${userId}:${seqRef.current}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? payload.new : n)))
        }
      )
      .subscribe()
```

`payload.new` en un evento `UPDATE` de Postgres ya trae la fila completa después del cambio (`body`, `read`, etc. actualizados por el `do update` de la función) — no hace falta pedir nada más, solo reemplazar la fila vieja por la nueva en el array local.

- [ ] **Paso 5: verificación de tipos y lint**

```bash
npx tsc --noEmit
npm run lint
```

---

## Task 3 — Limpiar las notificaciones de check-in existentes

**Files:**
- Create: `supabase/migrations/20260801_notify_check_in_daily_digest_cleanup.sql`

- [ ] **Paso 1: escribir la migración**

```sql
-- supabase/migrations/20260801_notify_check_in_daily_digest_cleanup.sql
-- Las notificaciones de check_in del modelo viejo (una por evento) no tienen
-- equivalente en el modelo nuevo (una por admin/día) — se descartan, no se
-- convierten. Nombrada para correr después de
-- 20260801_notify_check_in_daily_digest.sql (orden alfabético: el nombre de
-- esta migración es un prefijo + sufijo de la otra).

delete from notifications where type = 'check_in';
```

- [ ] **Paso 2: correr la migración en Supabase y verificar**

```sql
select count(*) from notifications where type = 'check_in';
```

Esperado: 0.

---

## Verificación manual (`npm run dev`)

1. **Conteo y reescritura, en vivo:** como socio, hacer check-in (QR o manual). Entrar como admin de ese gym (pestaña separada, sesión abierta) y confirmar la notificación "1 check-in hoy" en la campanita, apenas llega (realtime `INSERT`). Sin recargar esa pestaña del admin, hacer un segundo check-in (otro socio) desde la otra pestaña — confirmar que el badge/panel del admin se actualiza SOLO con el realtime, sin refrescar: sigue siendo 1 fila, pero el `body` pasa a "2 check-ins hoy" y vuelve a resaltarse como no leída (realtime `UPDATE`, Task 2 Paso 4).
2. **Todos los admins:** con un gym que tenga 2+ admins, confirmar que ambos ven la notificación (no solo uno, que era el bug original).
3. **Día siguiente:** no es practicable esperar un día real para probar esto — confirmar por lectura de código que el `dedup_key` incluye `v_today` y que un cambio de fecha produce una clave distinta, así que el día siguiente arranca una fila nueva sin tocar la de ayer.
4. **Click navega:** con la notificación de check-in visible en el panel, click en la fila (no en la X) → confirma que cierra el panel y navega a `/check-in`. Confirmar que otros tipos de notificación (por ejemplo `achievement`) NO son clickeables ni muestran cursor de mano.
5. **Limpieza:** confirmar que las notificaciones `check_in` viejas desaparecieron después de correr la migración de Task 3, y que no rompió nada más (otros tipos siguen intactos).

---

## Fuera de alcance

- No se agrega una columna de zona horaria por gym — no existe en el schema y no la pediste; el criterio es el mismo que ya usa toda la app (Argentina, hardcodeado).
- No se toca `today_check_ins` (la vista UTC sin uso) — está muerta, pero borrarla no fue parte de este pedido.
- No se agrega un listener de `DELETE` al canal realtime — `dismiss()` y "Limpiar todo" ya actualizan el estado local de forma optimista sin depender del eco de realtime, y no lo pediste.
