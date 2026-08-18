# Manejo de estados del webhook de MercadoPago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el webhook de MercadoPago maneje rechazado/cancelado (hoy ignorados en silencio) y detecte abandono real vía un barrido periódico, sobre el flujo de membresías ya existente — base para el cobro de productos (sub-proyecto 2b, después).

**Architecture:** Sin tabla nueva para rechazado/cancelado (`payments.status` ya soporta esos valores) — el fix es de lógica: escribir la fila que hoy nunca se escribe, vía una función SQL nueva con `ON CONFLICT DO NOTHING`. Abandono sí necesita una tabla nueva (`payment_checkouts`, registrada al crear la preferencia, resuelta por el webhook, expirada por un cron). De paso se arregla un bug real ya confirmado contra la base en vivo: la notificación "Pago recibido" nunca funcionó (columna/tipo inválidos, 9 pagos aprobados y cero notificaciones enviadas).

**Tech Stack:** Next.js 14 App Router (Route Handlers), Supabase (Postgres + RLS + pg_cron), vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-mp-webhook-status-handling-design.md`

## Global Constraints

- Los estados "en tránsito" de MercadoPago (`pending`, `in_process`, `authorized`, `in_mediation`) no escriben nada en la base — se loguean y se responde 200. Solo `approved`, `rejected`, `cancelled` son accionables.
- Rechazado/cancelado usan `ON CONFLICT (mp_payment_id) DO NOTHING` — nunca `DO UPDATE`. No hay transición entre estados escritos, cada uno es la primera y única escritura para ese `mp_payment_id`.
- `extend_member_membership` queda sin modificar — el diseño elegido evita que necesite tocarse.
- El vencimiento de una preferencia de checkout es de 30 minutos, sincronizado entre `payment_checkouts.expires_at` y el `expiration_date_to` que se le manda a la API de MercadoPago.
- El cron de expiración corre cada 15 minutos, reusando `pg_cron` (mismo patrón que `notify_churn_members`).
- `payment_checkouts.kind` acepta `'membership'` y `'product'` aunque este plan solo use `'membership'` — lo deja listo para el sub-proyecto 2b sin migración aparte.
- Solo se notifica al admin/staff del gym, nunca al socio/cliente.
- El handler HTTP del webhook y la ruta de checkout **no ganan tests unitarios nuevos** más allá de la función pura extraída (`resolveActionableMpStatus`) — alcance explícitamente acotado en el spec, no es un descuido a corregir.
- Toda función SQL nueva usa `set search_path = public` y fija su propio `revoke`/`grant` explícito — nunca hereda el `EXECUTE` que Postgres otorga a `PUBLIC` por defecto.
- Migraciones aplicadas a la base remota vía `supabase db query --linked -f <archivo>` — nunca `supabase db push` (la tabla de historial de migraciones de este proyecto no está poblada).
- Nunca correr `npm run build`. Usar `npx tsc --noEmit` para verificar tipos.

---

### Task 1: Migraciones — tipos de notificación (fix de bug) + tabla `payment_checkouts`

**Files:**
- Create: `supabase/migrations/20260817_notifications_payment_types.sql`
- Create: `supabase/migrations/20260817_payment_checkouts_table.sql`

**Interfaces:**
- Produces: valores de `notifications.type` permitidos `'payment_received'`, `'payment_failed'`, `'payment_checkout_expired'` (además de los ya existentes). Tabla `payment_checkouts(id, gym_id, external_reference, kind, status, created_at, expires_at)`. Tasks 2, 4 y 5 dependen de este esquema exacto.

- [ ] **Step 1: Escribir `20260817_notifications_payment_types.sql`**

```sql
-- Habilita los tipos de notificación que usa el manejo de estados del
-- webhook de MercadoPago. 'payment_received' ya se usaba en el código
-- (app/api/mp/webhook/route.ts) pero nunca estuvo en esta lista — cada
-- insert fallaba en silencio, atrapado por un catch que solo lo logueaba.
-- Confirmado contra la base en vivo: 9 pagos aprobados, 0 notificaciones
-- de payment_received registradas nunca. Se corrige de paso.
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member', 'check_in', 'achievement', 'plan_assigned',
  'membership_expiring', 'churn_alert', 'weight_drift', 'calorie_alert',
  'nutrition_duration_ready', 'payment_received', 'payment_failed',
  'payment_checkout_expired'
));
```

- [ ] **Step 2: Escribir `20260817_payment_checkouts_table.sql`**

```sql
-- Trackea cada preferencia de checkout de MercadoPago creada, para poder
-- detectar abandono real (el cliente nunca llega a intentar pagar — MP no
-- manda ningún webhook en ese caso, no hay nada que escuchar). Se inserta
-- al crear la preferencia, se marca 'resolved' en cuanto llega cualquier
-- webhook real para esa referencia, y un cron (ver siguiente migración) la
-- marca 'expired' si sigue 'pending' pasado su vencimiento.
--
-- No reutiliza `payments`: esa tabla representa transacciones reales, no
-- intentos — mezclar los dos conceptos ensuciaría los reportes de ingresos.
--
-- `kind` ya distingue 'membership' de 'product' aunque este sub-proyecto
-- solo use 'membership' — evita una segunda migración cuando se sume el
-- cobro de productos por MercadoPago (sub-proyecto 2b).
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

- [ ] **Step 3: Aplicar ambas migraciones a la base remota**

Run:
```bash
supabase db query --linked -f supabase/migrations/20260817_notifications_payment_types.sql
supabase db query --linked -f supabase/migrations/20260817_payment_checkouts_table.sql
```

Expected: sin errores en ninguna de las dos. **Nunca usar `supabase db push`**.

- [ ] **Step 4: Verificar el esquema aplicado**

Run:
```bash
supabase db query --linked -f - <<'EOF'
select conname, pg_get_constraintdef(oid) from pg_constraint
where conname = 'notifications_type_check';
EOF
```
Expected: una fila, la definición incluye `payment_received`, `payment_failed` y `payment_checkout_expired`.

Run:
```bash
supabase db query --linked -f - <<'EOF'
select column_name, data_type from information_schema.columns
where table_name = 'payment_checkouts' order by ordinal_position;
EOF
```
Expected: 7 filas (`id`, `gym_id`, `external_reference`, `kind`, `status`, `created_at`, `expires_at`).

Run:
```bash
supabase db query --linked -f - <<'EOF'
select policyname from pg_policies where tablename = 'payment_checkouts';
EOF
```
Expected: una fila (`admin lee checkouts de su gym`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260817_notifications_payment_types.sql supabase/migrations/20260817_payment_checkouts_table.sql
git commit -m "feat(pagos): tipos de notificacion para estados de pago y tabla payment_checkouts"
```

---

### Task 2: Migraciones — función de expiración + cron, y función para registrar rechazado/cancelado

**Files:**
- Create: `supabase/migrations/20260817_expire_stale_payment_checkouts.sql`
- Create: `supabase/migrations/20260817_record_failed_mp_payment.sql`

**Interfaces:**
- Consumes: tablas `payment_checkouts`, `payments`, `notifications` (Task 1 y esquema ya existente). Tipo `payment_status` (enum ya existente, ver `supabase/migrations/20260523_payments_table.sql`).
- Produces: función `expire_stale_payment_checkouts() returns void`, programada cada 15 minutos vía `pg_cron`. Función `record_failed_mp_payment(p_member_id uuid, p_gym_id uuid, p_amount numeric, p_status payment_status, p_mp_payment_id text) returns void`, invocable solo por `service_role`. Task 5 llama a `record_failed_mp_payment` por nombre y con estos parámetros exactos.

- [ ] **Step 1: Escribir `20260817_expire_stale_payment_checkouts.sql`**

```sql
-- Barrido periódico: cualquier payment_checkouts que siga 'pending' pasado
-- su vencimiento se marca 'expired' y notifica una sola vez al admin. Usa
-- UPDATE...RETURNING dentro de un CTE para notificar exactamente las filas
-- que transicionaron en ESTA corrida — no una ventana de tiempo relativa
-- (ej. "expiró en los últimos 20 min"), que sería frágil si el cron se
-- atrasa o el intervalo no calza exacto con la corrida anterior.
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

- [ ] **Step 2: Escribir `20260817_record_failed_mp_payment.sql`**

```sql
-- Registra un pago rechazado o cancelado. SECURITY DEFINER + solo
-- service_role porque el webhook llama con el cliente admin (no hay
-- usuario autenticado en el contexto de un webhook) — mismo patrón de
-- seguridad ya auditado que usa extend_member_membership.
--
-- ON CONFLICT DO NOTHING, no DO UPDATE: rechazado/cancelado son estados
-- terminales, cada uno es la primera y única escritura para ese
-- mp_payment_id. Si MP reintenta la entrega del mismo webhook (puede
-- pasar si el servidor no respondió 200 a tiempo), el segundo insert se
-- ignora sin error — no hay nada que actualizar.
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

- [ ] **Step 3: Aplicar ambas migraciones a la base remota**

Run:
```bash
supabase db query --linked -f supabase/migrations/20260817_expire_stale_payment_checkouts.sql
supabase db query --linked -f supabase/migrations/20260817_record_failed_mp_payment.sql
```

Expected: sin errores en ninguna de las dos.

- [ ] **Step 4: Verificar funciones, grants y el cron**

Run:
```bash
supabase db query --linked -f - <<'EOF'
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('expire_stale_payment_checkouts', 'record_failed_mp_payment');
EOF
```
Expected: las 2 filas.

Run:
```bash
supabase db query --linked -f - <<'EOF'
select routine_name, grantee, privilege_type from information_schema.role_routine_grants
where routine_name in ('expire_stale_payment_checkouts', 'record_failed_mp_payment')
order by routine_name, grantee;
EOF
```
Expected: `expire_stale_payment_checkouts` otorgada a `authenticated` (y `postgres`, el owner). `record_failed_mp_payment` otorgada **solo** a `service_role` (y `postgres`) — si aparece `authenticated` o `anon` con privilegio sobre `record_failed_mp_payment`, la migración no revocó correctamente, no continuar hasta corregirlo.

Run:
```bash
supabase db query --linked -f - <<'EOF'
select jobname, schedule from cron.job where jobname = 'expire-stale-payment-checkouts';
EOF
```
Expected: una fila, `schedule` es `*/15 * * * *`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260817_expire_stale_payment_checkouts.sql supabase/migrations/20260817_record_failed_mp_payment.sql
git commit -m "feat(pagos): funcion de expiracion de checkouts con cron y funcion para registrar pagos fallidos"
```

---

### Task 3: `lib/payments.ts` — función pura de mapeo de estados

**Files:**
- Modify: `lib/payments.ts`
- Modify: `lib/payments.test.ts`

**Interfaces:**
- Produces: `resolveActionableMpStatus(mpStatus: string): "approved" | "rejected" | "cancelled" | null`. Task 5 la usa para decidir qué hacer con cada notificación del webhook.

- [ ] **Step 1: Agregar los tests (deben fallar — la función todavía no existe)**

Agregar al final de `lib/payments.test.ts` (y sumar `resolveActionableMpStatus` al import existente en la línea 2-7):

```ts
import {
  canCollectPayment,
  isPlanCollectible,
  normalizeMpReference,
  normalizePaymentNotes,
  resolveActionableMpStatus,
} from "./payments"
```

```ts
describe("resolveActionableMpStatus", () => {
  it("approved es accionable", () => {
    expect(resolveActionableMpStatus("approved")).toBe("approved")
  })

  it("rejected es accionable", () => {
    expect(resolveActionableMpStatus("rejected")).toBe("rejected")
  })

  it("cancelled es accionable", () => {
    expect(resolveActionableMpStatus("cancelled")).toBe("cancelled")
  })

  // Los estados "en tránsito" de MercadoPago no son accionables — se
  // resuelven solos vía un webhook de seguimiento para el mismo payment.id,
  // no hay nada útil que escribir todavía.
  it("pending no es accionable", () => {
    expect(resolveActionableMpStatus("pending")).toBeNull()
  })

  it("in_process no es accionable", () => {
    expect(resolveActionableMpStatus("in_process")).toBeNull()
  })

  it("authorized no es accionable", () => {
    expect(resolveActionableMpStatus("authorized")).toBeNull()
  })

  it("in_mediation no es accionable", () => {
    expect(resolveActionableMpStatus("in_mediation")).toBeNull()
  })

  // Fuera de alcance de este sub-proyecto — se comportan igual que hoy
  // (sin acción), no se agrega tracking nuevo para refunds/chargebacks.
  it("refunded no es accionable (fuera de alcance)", () => {
    expect(resolveActionableMpStatus("refunded")).toBeNull()
  })

  it("charged_back no es accionable (fuera de alcance)", () => {
    expect(resolveActionableMpStatus("charged_back")).toBeNull()
  })

  it("un estado desconocido no es accionable", () => {
    expect(resolveActionableMpStatus("algo-que-mercadopago-no-manda-hoy")).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `npx vitest run lib/payments.test.ts`
Expected: FAIL — `resolveActionableMpStatus` no exportado todavía.

- [ ] **Step 3: Implementar la función al final de `lib/payments.ts`**

```ts
/**
 * MercadoPago tiene más estados que nuestro enum de payments (pending,
 * in_process, authorized, in_mediation son variantes de "todavía no se
 * resolvió", y refunded/charged_back quedan fuera de alcance por ahora).
 * Colapsa todo lo no accionable a null — el caller no escribe nada ni
 * notifica nada para null, solo loguea y sigue: el webhook de seguimiento
 * de MP eventualmente va a mandar un estado accionable para el mismo pago.
 */
export function resolveActionableMpStatus(mpStatus: string): "approved" | "rejected" | "cancelled" | null {
  if (mpStatus === "approved") return "approved"
  if (mpStatus === "rejected") return "rejected"
  if (mpStatus === "cancelled") return "cancelled"
  return null
}
```

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `npx vitest run lib/payments.test.ts`
Expected: PASS — 31 tests verdes (21 ya existentes + 10 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/payments.ts lib/payments.test.ts
git commit -m "feat(pagos): funcion pura para mapear estados de MercadoPago a acciones"
```

---

### Task 4: `app/api/mp/checkout/route.ts` — registrar el intento de checkout

**Files:**
- Modify: `app/api/mp/checkout/route.ts`

**Interfaces:**
- Consumes: tabla `payment_checkouts` (Task 1).
- Produces: nada que otras tasks consuman directamente — Task 5 lee `payment_checkouts` por `external_reference`, un valor que ya comparten ambos archivos hoy (mismo formato `${user.id}__${gymId}__${type}__${timestamp}`).

- [ ] **Step 1: Leer el archivo actual completo**

`app/api/mp/checkout/route.ts` ya tiene, en este orden dentro de `handleCheckout`: valida body → resuelve `profile.gym_id` → obtiene `mpToken` vía `admin.rpc("get_mp_token_for_checkout", ...)` → arma `appUrl`/`isLocalhost` → arma `externalRef` → hace el `fetch` a `https://api.mercadopago.com/checkout/preferences`.

- [ ] **Step 2: Insertar el registro de `payment_checkouts` y sincronizar el vencimiento de la preferencia**

Reemplazar el bloque que va desde `const externalRef = ...` hasta el `fetch(...)` de la preferencia (inclusive el `body: JSON.stringify({...})`) por:

```ts
  const externalRef = `${user.id}__${profile.gym_id}__${body.membership_type}__${Date.now()}`

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)

  const { error: checkoutError } = await admin
    .from("payment_checkouts" as never)
    .insert({
      gym_id: profile.gym_id,
      external_reference: externalRef,
      kind: "membership",
      expires_at: expiresAt.toISOString(),
    } as never)

  if (checkoutError) {
    console.error("[mp/checkout] error registrando payment_checkouts:", checkoutError)
    return NextResponse.json({ error: "Error al registrar el intento de pago" }, { status: 500 })
  }

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: body.title,
          quantity: 1,
          unit_price: body.amount,
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `${appUrl}/pagos/success`,
        failure: `${appUrl}/pagos/failure`,
        pending: `${appUrl}/pagos/pending`,
      },
      ...(!isLocalhost && { auto_return: "approved" }),
      external_reference: externalRef,
      notification_url: `${appUrl}/api/mp/webhook?gym_id=${profile.gym_id}`,
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
    }),
  })
```

No hace falta declarar un cliente nuevo — `admin` ya existe más arriba en la función (`const admin = createAdminClient()`).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add app/api/mp/checkout/route.ts
git commit -m "feat(pagos): registrar el intento de checkout y sincronizar su vencimiento con MercadoPago"
```

---

### Task 5: `app/api/mp/webhook/route.ts` — manejar rechazado/cancelado, resolver checkouts, arreglar la notificación

**Files:**
- Modify: `app/api/mp/webhook/route.ts`

**Interfaces:**
- Consumes: `resolveActionableMpStatus` de `@/lib/payments` (Task 3). RPC `record_failed_mp_payment` (Task 2). Tabla `payment_checkouts` (Task 1).

- [ ] **Step 1: Leer el archivo actual completo**

`app/api/mp/webhook/route.ts` tiene hoy: `POST` (verifica firma, parsea la notificación, llama a `processPayment`), `finalizePayment` (extiende membresía + notifica — el insert de notificación tiene el bug: usa `data` en vez de `metadata`), y `processPayment` (dedup por `mp_payment_id`, parsea `external_reference`, busca el token del gym, hace fetch a la API de pagos de MP, si `status !== 'approved'` loguea y sale, si no llama a `finalizePayment`).

- [ ] **Step 2: Agregar el import de `resolveActionableMpStatus`**

Agregar al inicio del archivo, junto a los imports existentes:

```ts
import { resolveActionableMpStatus } from "@/lib/payments"
```

- [ ] **Step 3: Agregar la función `notifyAdmins` compartida (reemplaza el bloque try/catch inline de `finalizePayment`)**

Agregar esta función nueva, después de la declaración de `type AdminClient = ReturnType<typeof createAdminClient>` y antes de `finalizePayment`:

```ts
async function notifyAdmins(
  admin: AdminClient,
  gymId: string,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("gym_id", gymId)
      .eq("role", "admin")

    if (!admins || admins.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("notifications" as never) as any).insert(
      admins.map((a: { id: string }) => ({
        user_id: a.id,
        gym_id: gymId,
        type,
        title,
        body,
        metadata,
      }))
    )
  } catch (notifErr) {
    console.error("[mp/webhook] error sending admin notification:", notifErr)
  }
}
```

- [ ] **Step 4: Reescribir `finalizePayment` para usar `notifyAdmins` (arregla el bug de paso)**

Reemplazar la función `finalizePayment` completa por:

```ts
async function finalizePayment(
  admin: AdminClient,
  paymentId: string,
  memberId: string,
  gymId: string,
  membershipType: "basic" | "premium" | "vip" | undefined,
  payment: { transaction_amount?: number },
): Promise<void> {
  const { data: plan } = await admin
    .from("membership_plans" as never)
    .select("duration_days")
    .eq("gym_id", gymId)
    .eq("type", membershipType ?? "basic")
    .maybeSingle() as unknown as { data: { duration_days: number } | null }

  const durationDays = plan?.duration_days ?? 30

  const { error } = await admin.rpc("extend_member_membership" as never, {
    p_member_id: memberId,
    p_gym_id: gymId,
    p_payment_id: paymentId,
    p_amount: payment.transaction_amount ?? 0,
    p_membership_type: membershipType ?? "basic",
    p_duration_days: durationDays,
  } as never)

  if (error) {
    console.error("[mp/webhook] error in extend_member_membership:", error)
    return
  }

  console.log(`[mp/webhook] payment ${paymentId} finalized — member ${memberId} extended ${durationDays} days`)

  const { data: member } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", memberId)
    .maybeSingle()

  const amount = payment.transaction_amount ?? 0
  const formatted = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount)

  await notifyAdmins(
    admin,
    gymId,
    "payment_received",
    "Pago recibido 💳",
    `${member?.full_name ?? "Un miembro"} pagó ${formatted} (${membershipType ?? "basic"})`,
    { member_id: memberId, payment_id: paymentId, amount },
  )
}
```

Este es el bug arreglado: la notificación ahora usa `metadata` (columna real) y `notifyAdmins` no tiene ningún campo que no exista en la tabla. El resto de la función (extender membresía) queda exactamente igual que antes.

- [ ] **Step 5: Agregar `recordFailedPayment` y `resolveCheckout`**

Agregar estas dos funciones nuevas, después de `finalizePayment` y antes de `processPayment`:

```ts
async function recordFailedPayment(
  admin: AdminClient,
  paymentId: string,
  memberId: string,
  gymId: string,
  status: "rejected" | "cancelled",
  payment: { transaction_amount?: number },
): Promise<void> {
  const { error } = await admin.rpc("record_failed_mp_payment" as never, {
    p_member_id: memberId,
    p_gym_id: gymId,
    p_amount: payment.transaction_amount ?? 0,
    p_status: status,
    p_mp_payment_id: paymentId,
  } as never)

  if (error) {
    console.error("[mp/webhook] error in record_failed_mp_payment:", error)
    return
  }

  console.log(`[mp/webhook] payment ${paymentId} recorded as ${status} — member ${memberId}`)

  const statusLabel = status === "rejected" ? "fue rechazado" : "se canceló"

  await notifyAdmins(
    admin,
    gymId,
    "payment_failed",
    "Un pago no se completó",
    `Un pago por MercadoPago ${statusLabel}.`,
    { member_id: memberId, payment_id: paymentId, status },
  )
}

async function resolveCheckout(admin: AdminClient, externalReference: string | undefined): Promise<void> {
  if (!externalReference) return

  const { data: checkout } = await admin
    .from("payment_checkouts" as never)
    .select("id, status")
    .eq("external_reference", externalReference)
    .maybeSingle() as unknown as { data: { id: string; status: string } | null }

  if (!checkout || checkout.status !== "pending") return

  await admin
    .from("payment_checkouts" as never)
    .update({ status: "resolved" } as never)
    .eq("id", checkout.id)
}
```

- [ ] **Step 6: Reescribir `processPayment`**

Reemplazar la función `processPayment` completa por:

```ts
async function processPayment(paymentId: string, externalRef?: string) {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("mp_payment_id", paymentId)
    .maybeSingle()

  if (existing) {
    console.log("[mp/webhook] already processed:", paymentId)
    return
  }

  const parts = externalRef?.split("__") ?? []
  let memberId = parts[0]
  let gymId = parts[1]
  let membershipType = parts[2] as "basic" | "premium" | "vip" | undefined

  if (!gymId) {
    console.warn("[mp/webhook] gym_id ausente en external_reference, skipping:", paymentId)
    return
  }

  const { data: mpToken } = await admin.rpc("get_mp_token_for_checkout", { p_gym_id: gymId })
  if (!mpToken) {
    console.warn("[mp/webhook] no mp token for gym:", gymId)
    return
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!mpRes.ok) {
    console.error("[mp/webhook] failed to fetch payment:", await mpRes.text())
    return
  }

  const payment = await mpRes.json()

  const action = resolveActionableMpStatus(payment.status)
  if (action === null) {
    console.log("[mp/webhook] estado no accionable, no se escribe nada:", payment.status)
    return
  }

  if (!memberId) {
    const preParts = (payment.external_reference as string | undefined)?.split("__") ?? []
    memberId = preParts[0]
    gymId = preParts[1] ?? gymId
    membershipType = preParts[2] as "basic" | "premium" | "vip" | undefined

    if (!memberId) {
      console.warn("[mp/webhook] no member_id in payment external_reference:", paymentId)
      return
    }
  }

  if (action === "approved") {
    await finalizePayment(admin, paymentId, memberId, gymId, membershipType, payment)
  } else {
    await recordFailedPayment(admin, paymentId, memberId, gymId, action, payment)
  }

  await resolveCheckout(admin, payment.external_reference as string | undefined)
}
```

Cambios respecto al original: el corte temprano `if (payment.status !== "approved") { ...; return }` se reemplaza por `resolveActionableMpStatus`. `memberId`/`gymId`/`membershipType` pasan de `const` a `let` para poder reasignarse en el fallback sin duplicar la llamada a `finalizePayment` en dos lugares (el original la tenía duplicada al final de las dos ramas del `if (!memberId)`). Al final, en cualquiera de los dos casos accionables, se llama a `resolveCheckout` para marcar el `payment_checkouts` correspondiente como resuelto.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add app/api/mp/webhook/route.ts
git commit -m "feat(pagos): manejar rechazado y cancelado en el webhook, resolver checkouts, arreglar notificacion de pago recibido"
```

---

## Verificación final

Después de la Task 5:

1. `npx vitest run lib/payments.test.ts` — 31/31 en verde.
2. `npx tsc --noEmit` — sin errores en todo el proyecto.
3. No hay forma de probar el flujo end-to-end sin un pago real de MercadoPago (sandbox) o un webhook simulado con firma válida — queda fuera de alcance de este plan, igual que ya estaba fuera de alcance en el spec. Revisión manual recomendada: crear un checkout de prueba y confirmar en el dashboard de Supabase que aparece la fila en `payment_checkouts`, y que expira sola pasados 30 minutos si no se completa.
