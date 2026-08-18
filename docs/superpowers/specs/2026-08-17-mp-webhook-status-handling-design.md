# Manejo de estados del webhook de MercadoPago — sub-proyecto 2a de venta de productos

**Fecha:** 2026-08-17
**Estado:** Aprobado

## Contexto

El webhook de MercadoPago (`app/api/mp/webhook/route.ts`) hoy solo actúa cuando `payment.status === 'approved'` — cualquier otro estado (`rejected`, `pending`, `in_process`, `cancelled`, etc.) se ignora en silencio, sin dejar rastro. Esto se descubrió al planear el sub-proyecto 2b (cobro de productos por MercadoPago): antes de sumar un segundo consumidor de este webhook, conviene arreglar el manejo de estados sobre el flujo que ya existe en producción (membresías), para no estrenar la lógica nueva junto con el checkout de productos.

Hay tres casos distintos, con solución distinta cada uno:

- **Rechazado**: MercadoPago manda un webhook real con `status: 'rejected'`. Se puede arreglar solo con lógica — no hace falta esquema nuevo.
- **Cancelado**: mismo caso que rechazado, MP sí notifica.
- **Abandonado** (el cliente nunca llega a intentar pagar): no genera ningún webhook — no existe ningún `payment` en el lado de MP para notificar. Solo se puede detectar con un barrido periódico sobre las preferencias de checkout creadas, comparando contra su vencimiento.

**Bug encontrado de paso, confirmado contra la base en vivo**: la notificación "Pago recibido" nunca funcionó. El insert en `notifications` usa una columna `data` que no existe (la real se llama `metadata`) y un `type: 'payment_received'` que no está en la lista permitida del constraint — el insert falla siempre, silenciado por el `catch` que solo lo loguea a consola. Hay 9 pagos de MercadoPago aprobados en la base y cero notificaciones de `payment_received` — ninguna nunca se envió. Se arregla en este mismo trabajo porque toca exactamente el código que se está modificando.

Este spec cubre **solo el sub-proyecto 2a**: arreglar el manejo de estados sobre el flujo de membresías existente. El cobro de productos por MercadoPago (2b) se construye después, sobre esta base ya corregida — spec aparte.

## Decisiones de arquitectura

- **Rechazado/cancelado no necesitan tabla nueva.** `payments.status` ya es un enum (`pending`, `approved`, `rejected`, `cancelled`, `refunded`) y `lib/payments.ts` ya tiene labels y colores para los 5 — el modelo de datos ya estaba pensado para esto, el webhook nunca lo aprovechó.
- **Los estados "en tránsito" de MercadoPago no generan ninguna escritura.** MP tiene varios estados intermedios (`pending`, `in_process`, `authorized`, `in_mediation`) que después se resuelven solos vía un webhook de seguimiento para el mismo `payment.id`. No son accionables — no hay nada útil que hacer con "un pago todavía se está procesando" más que esperar la próxima notificación. Se loguean y se responde 200, sin tocar la base. Esto evita todo el problema de "¿qué pasa si el mismo `mp_payment_id` primero llega pendiente y después aprobado?" — como pendiente nunca escribe nada, no hay fila previa con la que choque el insert de aprobado. `extend_member_membership` (la función que ya inserta el pago aprobado) queda sin tocar.
- **Rechazado/cancelado sí escriben, con `ON CONFLICT (mp_payment_id) DO NOTHING`** — no `DO UPDATE`. Un pago rechazado es terminal: si MP reintenta la entrega del mismo webhook (puede pasar si el servidor no respondió 200 a tiempo), el segundo insert debe ignorarse sin error, no pisar nada. No hace falta lógica de "solo actualizar si no es terminal" porque nunca se llega a este insert desde un estado previo escrito — rechazado/cancelado son la primera (y única) escritura para ese `mp_payment_id`.
- **Abandonado sí necesita una tabla nueva, `payment_checkouts`.** No hay ningún `mp_payment_id` que trackear porque nunca hubo un intento de pago real — lo único que existe es la preferencia de checkout creada. Se registra una fila al crear la preferencia (antes de saber si el cliente va a pagar o no), se marca `resolved` en cuanto llega cualquier webhook real para esa referencia (aprobado, rechazado o cancelado — no importa cuál, lo que importa es que hubo actividad), y un cron la marca `expired` si sigue `pending` pasado su vencimiento. No se reutiliza `payments` para esto porque esa tabla representa transacciones reales, no intentos — mezclar los dos conceptos ensuciaría los reportes de ingresos.
- **La preferencia de MercadoPago se crea con vencimiento explícito** (`expires: true`, `expiration_date_to`), sincronizado con el `expires_at` que se guarda en `payment_checkouts`. Hoy la preferencia no vence nunca del lado de MP — si no se sincroniza, se podría marcar algo "expirado" en nuestra base mientras el link todavía es válido y cobrable del lado de MP.
- **El cron reusa la infraestructura que ya existe** (`pg_cron`, mismo patrón que `notify_churn_members` — `cron.schedule('nombre', 'expresión', $$ select funcion() $$)`), no es un mecanismo nuevo para el proyecto.
- **La función del cron usa `UPDATE ... RETURNING` dentro de un CTE** para notificar exactamente las filas que transicionaron en esa corrida — no un chequeo por ventana de tiempo (`expires_at > now() - interval '20 min'`), que sería frágil si el cron se atrasa o el intervalo no calza exacto.

## Componentes

### 1. Migración: tipos de notificación nuevos + fix del bug existente

```sql
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member', 'check_in', 'achievement', 'plan_assigned',
  'membership_expiring', 'churn_alert', 'weight_drift', 'calorie_alert',
  'nutrition_duration_ready', 'payment_received', 'payment_failed',
  'payment_checkout_expired'
));
```

`payment_failed` cubre tanto rechazado como cancelado (el texto del body distingue cuál fue). No se agrega `payment_pending` porque ese estado nunca dispara una notificación.

### 2. Migración: tabla `payment_checkouts`

```sql
create table payment_checkouts (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references gyms(id) on delete cascade,
  external_reference  text not null unique,
  kind                text not null check (kind in ('membership', 'product')),
  status              text not null default 'pending' check (status in ('pending', 'resolved', 'expired')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null
);

create index payment_checkouts_pending_expiry_idx
  on payment_checkouts(expires_at)
  where status = 'pending';

alter table payment_checkouts enable row level security;

create policy "admin lee checkouts de su gym" on payment_checkouts
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = payment_checkouts.gym_id
        and role = 'admin'
    )
  );

-- Sin policy de insert/update para authenticated — se escribe solo desde
-- el cliente admin (checkout route, webhook, cron), igual que payments.
```

`kind` ya distingue `'membership'` de `'product'` aunque este sub-proyecto solo use `'membership'` — evita una segunda migración cuando llegue 2b.

### 3. Migración: función de expiración + cron

```sql
create or replace function expire_stale_payment_checkouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update payment_checkouts
    set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning id, gym_id, external_reference, kind
  )
  insert into notifications (user_id, gym_id, type, title, body, metadata, dedup_key)
  select
    admin.id,
    e.gym_id,
    'payment_checkout_expired',
    'Un cobro no se completó',
    'Un cliente no terminó de pagar por MercadoPago — el link de pago quedó sin usar.',
    jsonb_build_object('checkout_id', e.id, 'external_reference', e.external_reference, 'kind', e.kind),
    'checkout_expired:' || e.id::text
  from expired e
  join profiles admin on admin.gym_id = e.gym_id and admin.role = 'admin'
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end;
$$;

grant execute on function expire_stale_payment_checkouts() to authenticated;

select cron.schedule(
  'expire-stale-payment-checkouts',
  '*/15 * * * *',
  $$ select expire_stale_payment_checkouts() $$
);
```

Cada 15 minutos, cualquier `payment_checkouts` pendiente cuyo `expires_at` ya pasó se marca `expired` y notifica una sola vez (el `UPDATE...RETURNING` solo devuelve las filas que efectivamente transicionaron en esa corrida — una fila ya `expired` no vuelve a aparecer en corridas siguientes).

### 4. `lib/payments.ts` — función pura de mapeo de estados

```ts
/**
 * MercadoPago tiene más estados que nuestro enum (pending, in_process,
 * authorized, in_mediation son variantes de "todavía no se resolvió", y
 * refunded/charged_back quedan fuera de alcance de este sub-proyecto).
 * Colapsa todo lo no accionable a null — el caller no escribe nada ni
 * notifica nada para null, solo loguea y sigue.
 */
export function resolveActionableMpStatus(mpStatus: string): "approved" | "rejected" | "cancelled" | null {
  if (mpStatus === "approved") return "approved"
  if (mpStatus === "rejected") return "rejected"
  if (mpStatus === "cancelled") return "cancelled"
  return null
}
```

### 5. `app/api/mp/checkout/route.ts` — registrar el intento de checkout

Después de crear `externalRef` y antes de llamar a la API de MercadoPago:

- Calcular `expiresAt = new Date(Date.now() + 30 * 60 * 1000)` (30 minutos).
- Insertar en `payment_checkouts` (`gym_id`, `external_reference: externalRef`, `kind: 'membership'`, `expires_at: expiresAt`) con el cliente admin. Si el insert falla, la ruta responde error y **no** crea la preferencia en MercadoPago — si no se puede ni registrar el intento, no tiene sentido dejar que el cliente pague sin que quede rastro.
- Sumar al body de la preferencia: `expires: true`, `expiration_date_from: new Date().toISOString()`, `expiration_date_to: expiresAt.toISOString()`.

### 6. Migración: función SQL para registrar rechazado/cancelado

Nueva función SQL, mínima, para el insert de rechazado/cancelado — necesaria porque el cliente JS de Supabase no permite expresar `on conflict ... where ... do nothing` a mano en un upsert simple contra un índice único parcial; es más simple resolverlo en una función que el webhook llama vía RPC.

```sql
create or replace function record_failed_mp_payment(
  p_member_id     uuid,
  p_gym_id        uuid,
  p_amount        numeric,
  p_status        payment_status,
  p_mp_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payments (gym_id, member_id, amount, status, method, mp_payment_id)
  values (p_gym_id, p_member_id, p_amount, p_status, 'mercadopago', p_mp_payment_id)
  on conflict (mp_payment_id) where mp_payment_id is not null do nothing;
end;
$$;

revoke all on function record_failed_mp_payment(uuid, uuid, numeric, payment_status, text) from public, anon, authenticated;
grant execute on function record_failed_mp_payment(uuid, uuid, numeric, payment_status, text) to service_role;
```

Mismo patrón de seguridad que `extend_member_membership`: `SECURITY DEFINER`, revocada de todo salvo `service_role`, porque el webhook ya llama con el cliente admin (no hay usuario autenticado en el contexto de un webhook).

### 7. `app/api/mp/webhook/route.ts` — reescribir el manejo de estados

- `processPayment` usa `resolveActionableMpStatus(payment.status)` para decidir:
  - `null` (no accionable) → loguear y devolver, sin tocar la base.
  - `'approved'` → **sin cambios**: sigue llamando a `finalizePayment` → `extend_member_membership` exactamente como hoy.
  - `'rejected'` / `'cancelled'` → nuevo: llamar a `record_failed_mp_payment` (componente 6) vía `admin.rpc(...)` con `member_id`, `gym_id`, `amount`, el status mapeado, y `mp_payment_id`. Después, notificar a los admins del gym con `type: 'payment_failed'` (mismo patrón de insert que ya usa `finalizePayment` para `payment_received`, corrigiendo el bug: `metadata` en vez de `data`, sin campos que no existen en la tabla).
- En cualquiera de los tres casos accionables (incluyendo `approved`), buscar la fila de `payment_checkouts` por `external_reference` con el cliente admin (`admin.from("payment_checkouts").select("id, status").eq("external_reference", externalRef).maybeSingle()`) y, si existe y sigue `pending`, actualizarla a `resolved` con un `.update()` directo — no hace falta una RPC nueva para esto, el cliente admin ya bypasea RLS. Así el cron no la expira después aunque el pago haya tardado en confirmarse.
- El bug de la notificación existente (`finalizePayment`) se arregla en el mismo cambio: `metadata` en vez de `data`, sin agregar campos que no existen en la tabla — mismo fix, un solo lugar donde se construye el insert de notificación para ambos casos (aprobado y fallido), para no duplicar el bug de nuevo en el código nuevo.

## Manejo de errores

- **Webhook duplicado para un pago ya registrado como rechazado/cancelado**: el `on conflict ... do nothing` lo absorbe sin error — la función igual devuelve éxito, el webhook responde 200 (MP deja de reintentar).
- **Estado no accionable** (`pending`, `in_process`, etc.): no es un error, es el comportamiento esperado — se loguea y se sigue.
- **Falla el insert en `payment_checkouts` al crear el checkout**: la ruta de checkout falla completa, no se llega a crear la preferencia en MercadoPago. Sin esto, un pago podría cobrarse sin que quede ningún registro del intento.
- **El cron corre sin filas pendientes vencidas**: no-op, sin error — el `CTE` simplemente no devuelve filas y no se inserta ninguna notificación.
- **Refund o chargeback después de un pago ya aprobado**: fuera de alcance de este sub-proyecto (ver abajo) — se comporta igual que hoy, sin cambios.

## Testing

- `lib/payments.test.ts` (se agrega a un archivo existente o se crea, según lo que ya exista): tests para `resolveActionableMpStatus` cubriendo los 3 casos accionables y al menos dos no accionables (`pending`, un estado inventado/desconocido) — función pura, cobertura completa es barata.
- El handler HTTP del webhook (`route.ts`) y la ruta de checkout **no ganan tests unitarios nuevos** más allá de la función pura extraída — hoy no tienen ninguno, y agregarles cobertura completa (mockear `fetch` a la API de MercadoPago, la verificación HMAC, etc.) es un esfuerzo bastante mayor que el resto de este sub-proyecto. Se deja fuera de alcance explícitamente, no es un descuido.

## Fuera de alcance

- El cobro de productos por MercadoPago en sí (sub-proyecto 2b, spec aparte) — este sub-proyecto solo deja la base (manejo de estados + `payment_checkouts` con su `kind` ya genérico) lista para que 2b la reuse.
- Refunds y chargebacks — se registran hoy de la misma forma que antes de este cambio (nada), no se automatiza ninguna acción ni se agrega tracking nuevo.
- Reintentar automáticamente un pago rechazado, o generar un nuevo link de pago — el staff genera uno nuevo a mano si el cliente quiere reintentar.
- Notificar al socio/cliente sobre el resultado del pago — solo se notifica al admin/staff del gym. El socio ya ve el resultado en las páginas `/pagos/success|failure|pending` de MercadoPago.
- Tests unitarios de cobertura completa para los route handlers HTTP — ver sección Testing.
- Ajustar `extend_member_membership` — queda exactamente como está, porque el diseño elegido (no escribir nada en estados no accionables) evita que necesite tocarse.
