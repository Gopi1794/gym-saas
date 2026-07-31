# Fix: assignTrainer y updateMemberMembership contra privilegios de columna — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `assignTrainer` y `updateMemberMembership` (`app/actions/members.ts`) dejan de fallar con "permission denied" — las columnas que escriben (`trainer_id`, `membership_type`, `membership_expires_at`) quedaron fuera de la lista de privilegios que `20260726_profiles_column_privileges.sql` le dio a `authenticated`, así que el UPDATE final de cada una pasa a hacerse con el cliente admin, que no está sujeto a esos privilegios.

**Architecture:** Ningún cambio de esquema ni de validaciones de negocio — las tres validaciones de `assignTrainer` y las dos de `updateMemberMembership` ya son correctas y ya corren antes del update. El único cambio es de qué cliente de Supabase hace el `.update()` final: `createClient()` (RLS) → `createAdminClient()` (service role) para esa llamada puntual. El resto de cada función (los `select` de validación) se queda en el cliente normal — no hay ninguna razón para ampliar el bypass más allá de lo que está roto.

**Tech Stack:** Sin cambios de schema ni librerías nuevas.

## Global Constraints

- Solo el `.update()` que escribe la columna restringida pasa al cliente admin — los `select` de validación se quedan en el cliente normal. Minimizar la superficie de bypass a exactamente lo que está roto.
- Las validaciones existentes tienen que terminar de correr, con resultado positivo, ANTES de que se ejecute el update con el cliente admin — con ese cliente no hay RLS de red, así que el orden importa y es la única barrera.
- No se agrega ninguna validación de negocio nueva más allá de la ya existente — se verifica que las que están sean completas, no se rediseña quién puede hacer qué.

---

## Contexto verificado antes de planificar

1. **Confirmé el diagnóstico contra la migración real**, `supabase/migrations/20260726_profiles_column_privileges.sql:8-14`:

   ```sql
   revoke update on public.profiles from authenticated;

   grant update (
     full_name, avatar_url, gender, date_of_birth, phone,
     weight_kg, height_cm, goal, medical_conditions, training_frequency,
     emergency_name, emergency_phone, onboarding_seen, notification_hour
   ) on public.profiles to authenticated;
   ```

   `trainer_id`, `membership_type` y `membership_expires_at` no están en esta lista — confirmado, no es una suposición. Tampoco están `role` ni `gym_id`, pero esos quedan afuera a propósito (es literalmente el motivo de la migración: evitar que un socio se escriba `role='admin'`) — no forman parte de este fix.

2. **Audité las otras dos funciones del mismo archivo contra la misma lista, ya que estaba revisando el grant completo**: `updateMemberPhysical` escribe `weight_kg, height_cm` (ambas están en la lista) y `updateMemberContact` escribe `date_of_birth, phone, gender, goal, training_frequency, emergency_name, emergency_phone` (las siete están). Ninguna de las dos tiene este problema — no se tocan.

3. **Las tres validaciones de `assignTrainer` (`app/actions/members.ts:177-211`) ya están completas y en el orden correcto** — las leí línea por línea: (a) `me.role !== "admin"` en la línea 185, admin-only, coincide con "asignar entrenador es administrativo"; (b) `target.gym_id !== me.gym_id` en la línea 190-192; (c) cuando `trainerId` no es null, `trainer.gym_id !== me.gym_id || trainer.role !== "trainer"` en la línea 197-199. Las tres corren y devuelven `{error}` antes de llegar al `.update()` de la línea 202. No falta nada — el único cambio real es el cliente del update.

4. **`updateMemberMembership` no tiene una validación "faltante" análoga a la del trainer**: `membershipType` es un literal cerrado (`"basic" | "premium" | "vip"`), no una referencia a otra fila como `trainerId` — no hay un "pertenece al gym correcto" que validar ahí. Sus dos validaciones existentes (admin/trainer + mismo gym) alcanzan.

5. **Aprovecho para agregar a `assignTrainer` la misma guarda de "0 filas afectadas" que ya tienen `updateMemberMembership` y `recalculateNutritionPlanTargets`** (`app/actions/nutrition.ts`) — hoy `assignTrainer` no la tiene. No es lo que pediste explícitamente, pero es la misma razón que ya diste vos mismo para todo este fix: sin RLS de red, la única defensa es lo que hay en la server action, y las otras dos funciones del codebase que ya usan el cliente admin para un update puntual tienen esta guarda por el mismo motivo. La sumo por consistencia, marcada aparte en el Paso 2 de la Task 1 para que se pueda revisar como algo separado del fix pedido.

6. **El comentario de `updateMemberMembership` sobre la guarda de filas queda desactualizado con este cambio** — hoy dice "Si RLS bloqueó el update, Supabase no tira error pero tampoco devuelve filas." Con el cliente admin, RLS ya no puede bloquear nada ahí — el comentario pasa a ser directamente falso si lo dejo como está. Lo reescribo para que diga lo que la guarda protege ahora (que la fila exista), no lo que protegía antes.

---

## Task 1 — `app/actions/members.ts`: cliente admin para los dos updates

**Files:**

- Modify: `app/actions/members.ts`

**Interfaces:** Sin cambios de firma — `assignTrainer(memberId, trainerId)` y `updateMemberMembership(input)` devuelven exactamente los mismos tipos que hoy (`{error: string} | {success: true}`).

- [ ] **Paso 0: confirmar el estado real de la base antes de tocar código**

Correr en el SQL editor de Supabase:

```sql
select column_name
from information_schema.column_privileges
where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
```

Esperado: la lista de 14 columnas del Paso 1 de Contexto verificado, sin `trainer_id`, `membership_type` ni `membership_expires_at`. Si la migración `20260726_profiles_column_privileges.sql` todavía no se corrió contra esta base, este query lo va a mostrar (la lista incluiría esas columnas, o el `revoke` ni siquiera habría corrido) — en ese caso el bug reportado tiene otra causa y hay que parar antes de aplicar este fix.

- [ ] **Paso 1: import del cliente admin**

Agregar al inicio de `app/actions/members.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Paso 2: `assignTrainer` — cliente admin para el update, con guarda de filas**

Reemplazar (líneas 202-207):

```ts
const { error } = await supabase
  .from("profiles")
  .update({ trainer_id: trainerId } as never)
  .eq("id", memberId);

if (error) return { error: error.message };
```

por:

```ts
// profiles.trainer_id no está en los privilegios de columna de authenticated
// (20260726_profiles_column_privileges.sql) — cliente admin para este update.
// Las tres validaciones de arriba ya corrieron: son la única barrera, el
// cliente admin no tiene RLS que actúe de red.
const admin = createAdminClient();
const { data: updated, error } = await admin
  .from("profiles")
  .update({ trainer_id: trainerId } as never)
  .eq("id", memberId)
  .select("id");

if (error) return { error: error.message };

if (!updated || updated.length === 0) {
  return { error: "No se pudo asignar el trainer (el socio no existe)" };
}
```

- [ ] **Paso 3: `updateMemberMembership` — cliente admin para el update, comentario actualizado**

Reemplazar (líneas 137-152):

```ts
const { data: updated, error } = await supabase
  .from("profiles")
  .update({
    membership_type: input.membershipType,
    membership_expires_at: input.membershipExpiresAt,
  } as never)
  .eq("id", input.memberId)
  .select("id");

if (error) return { error: error.message };

// Si RLS bloqueó el update, Supabase no tira error pero tampoco devuelve filas.
// Sin esta guarda, se podía registrar el pago sin haber extendido la membresía.
if (!updated || updated.length === 0) {
  return {
    error:
      "No se pudo actualizar la membresía (sin permiso o el socio no existe)",
  };
}
```

por:

```ts
// profiles.membership_type y profiles.membership_expires_at tampoco están en
// los privilegios de columna de authenticated — mismo problema que trainer_id
// en assignTrainer. Cliente admin para este update; las dos validaciones de
// arriba (admin/trainer + mismo gym) son la única barrera.
const admin = createAdminClient();
const { data: updated, error } = await admin
  .from("profiles")
  .update({
    membership_type: input.membershipType,
    membership_expires_at: input.membershipExpiresAt,
  } as never)
  .eq("id", input.memberId)
  .select("id");

if (error) return { error: error.message };

// Guarda por si el socio dejó de existir entre el chequeo de gym y este
// update — ya no es un chequeo de RLS: el cliente admin no tiene policies
// que lo bloqueen, así que "0 filas" acá solo puede ser esto.
if (!updated || updated.length === 0) {
  return { error: "No se pudo actualizar la membresía (el socio no existe)" };
}
```

El resto de la función (el `select` de `membership_plans` y el `insert` en `payments`, líneas 154-171) no cambia — son otra tabla, con sus propias policies de RLS, ajenas a este privilegio de columna.

- [ ] **Paso 4: verificación de tipos y lint**

```bash
npx tsc --noEmit
npm run lint
```

Esperado: sin errores nuevos en `app/actions/members.ts` (este archivo no tenía errores de lint antes del cambio).

---

## Task 2 — `updateMemberMembership` pasa a admin-only

**Files:**
- Modify: `app/actions/members.ts`
- Modify: `app/(dashboard)/members/[id]/page.tsx`

**Motivo:** extender una membresía es dar acceso gratis al gimnasio, y la función además inserta en `payments` — un trainer podría registrar un pago en efectivo que nunca ocurrió. Es una operación de plata, no de entrenamiento — mismo criterio que ya se aplicó a `assignTrainer` ("asignar entrenador es administrativo").

- [ ] **Paso 1: server action — admin-only**

Reemplazar (dentro de `updateMemberMembership`):

```ts
  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }
```

por:

```ts
  if (!me || (me as any).role !== "admin") {
    return { error: "Sin permiso" }
  }
```

- [ ] **Paso 2: ocultar el componente para trainers**

`MemberMembershipEdit` (`components/members/MemberMembershipEdit.tsx`) no tiene ningún gate de rol adentro — hoy se renderiza igual para admin y trainer, con un botón "Editar" que funciona para ambos. Después del Paso 1, un trainer que lo use va a ver el error crudo del servidor ("Sin permiso") en vez de no ver el control. Único call site: `app/(dashboard)/members/[id]/page.tsx:201-206`. Mismo patrón que ya usa `MemberTrainerEdit` un poco más abajo en el mismo archivo (línea 216, `{role === "admin" && (...)}`).

Reemplazar (líneas 199-213):

```tsx
      {/* Membership + Physical */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MemberMembershipEdit
          memberId={params.id}
          initialType={member.membership_type as "basic" | "premium" | "vip" | null}
          initialExpiresAt={member.membership_expires_at}
          plans={membershipPlans ?? []}
        />
        <MemberPhysicalEdit
          memberId={params.id}
          initialWeight={member.weight_kg}
          initialHeight={member.height_cm}
          hasActiveNutritionPlan={(activeNutritionPlanCount ?? 0) > 0}
        />
      </div>
```

por:

```tsx
      {/* Membership (solo admin) + Physical */}
      <div className={`grid gap-4 ${role === "admin" ? "sm:grid-cols-2" : ""}`}>
        {role === "admin" && (
          <MemberMembershipEdit
            memberId={params.id}
            initialType={member.membership_type as "basic" | "premium" | "vip" | null}
            initialExpiresAt={member.membership_expires_at}
            plans={membershipPlans ?? []}
          />
        )}
        <MemberPhysicalEdit
          memberId={params.id}
          initialWeight={member.weight_kg}
          initialHeight={member.height_cm}
          hasActiveNutritionPlan={(activeNutritionPlanCount ?? 0) > 0}
        />
      </div>
```

El `sm:grid-cols-2` también pasa a ser condicional: si no está `MemberMembershipEdit`, forzar dos columnas dejaría a `MemberPhysicalEdit` ocupando solo la mitad de la fila con un hueco vacío al lado. Sin la clase, `MemberPhysicalEdit` ocupa el ancho completo — no hace falta tocar ese componente.

- [ ] **Paso 3: verificación de tipos y lint**

```bash
npx tsc --noEmit
npm run lint
```

## Verificación manual (`npm run dev`)

Sin tests automatizados en el proyecto — se verifica a mano. Iniciar sesión como **admin** de un gym con al menos un socio y un trainer.

1. **`assignTrainer`, caso feliz:** desde la ficha de un socio, asignarle un trainer del mismo gym. Antes del fix esto tiraba "permission denied for table profiles" — confirmar que ahora guarda sin error y que `MemberTrainerEdit` refleja el trainer asignado después del refresh.
2. **`assignTrainer`, desasignar:** volver a poner el trainer en "ninguno" (`trainerId = null`). Confirmar que guarda.
3. **`assignTrainer`, validaciones no se pueden probar por UI y eso es esperado:** el control de asignar trainer solo se renderiza para admins (`app/(dashboard)/members/[id]/page.tsx:216`, `{role === "admin" && <MemberTrainerEdit .../>}`), y el `<select>` de trainers solo lista trainers del propio gym — así que "un trainer intenta asignar" o "asignar un trainer de otro gym" no tienen un camino de UI para forzarlos. Esto no es un hueco del fix: es que la única forma de ejercitar esas dos ramas es una llamada directa a la server action con datos manipulados, que es exactamente el escenario para el que el Paso 3 (Contexto verificado) ya confirmó que las validaciones están completas por lectura de código.
4. **`updateMemberMembership`:** desde la ficha de un socio, cambiar el tipo de membresía y/o la fecha de vencimiento (usando el flujo de pago en efectivo si el plan tiene precio > 0). Confirmar que guarda sin "permission denied", que la membresía se actualiza, y que si el plan tiene precio se registra el pago en `payments`.
5. **Regresión rápida de las dos funciones no afectadas:** `updateMemberPhysical` (peso/altura) y `updateMemberContact` (fecha de nacimiento, teléfono, etc.) siguen guardando normalmente — no deberían haber cambiado, pero es la comprobación más barata de que el diagnóstico del Paso 2 (Contexto verificado) fue correcto.
6. **`updateMemberMembership` admin-only:** entrar como **trainer** a la ficha de un socio de su gym. Confirmar que la tarjeta "Membresía" no aparece (solo se ve "Datos físicos", ocupando el ancho completo, sin hueco al lado). Entrar como **admin** a la misma ficha y confirmar que la tarjeta de membresía sigue ahí y sigue guardando.

---

## Fuera de alcance

- No se revisan privilegios de columna de otras tablas (`payments`, `nutrition_plans`, etc.) — el pedido fue puntual sobre `profiles`, y `payments` ya usa una policy de RLS de tabla, no privilegios de columna.
