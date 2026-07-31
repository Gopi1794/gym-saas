# Notificar al trainer cuando el peso desactualiza el plan nutricional — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un socio registra su propio peso y eso deja el objetivo de su plan nutricional activo desactualizado (mismo umbral que el aviso del editor), insertar una notificación para su trainer asignado (o todos los admins del gym si no tiene trainer), sin que un fallo de notificación pueda romper el registro de peso.

**Architecture:** Toda la lógica de decisión (umbral, recálculo) vive en TypeScript dentro de `logWeight` (`app/actions/nutrition-tracking.ts`), reusando `getMemberProfileForPlan` + `calcNutritionTargets` (los mismos que ya usa `createNutritionPlan`/`recalculateNutritionPlanTargets`). El insert a `notifications` se hace con el cliente admin (`lib/supabase/admin.ts`), porque la tabla no tiene policy de INSERT para `authenticated` — no se agrega ninguna función SQL nueva.

**Tech Stack:** Sin librerías nuevas. Una migración SQL (solo `ALTER TABLE ... CHECK`, sin lógica de negocio).

## Global Constraints

- No reimplementar Mifflin-St Jeor ni los factores de actividad en SQL — la comparación de umbral se hace en TypeScript con `calcNutritionTargets`, igual que el resto de la feature de nutrición.
- Si la notificación falla (red, permisos, lo que sea), `logWeight` igual debe completar el registro de peso y devolver éxito al socio.
- No notificar si la desviación no cruza `CALORIE_MISMATCH_THRESHOLD`.
- `dedup_key` no debe contener fecha ni timestamp — solo `plan_id` y `target_calories`, para que una notificación repetida el mismo día por el mismo drift se deduplique, y solo un recálculo del objetivo (que cambia `target_calories`) habilite una notificación nueva.
- Cuando el drift se resuelve — recálculo del objetivo, o el peso vuelve a un valor que ya no cruza el umbral — las notificaciones `weight_drift` correspondientes al objetivo viejo no deben quedar visibles diciendo algo que ya no es cierto.

---

## Contexto verificado antes de planificar

1. **`logWeight`** (`app/actions/nutrition-tracking.ts:197-209`) escribe en dos lugares: un upsert en `weight_logs` y un `update` de `profiles.weight_kg` (el "snapshot" que usa todo el resto de la feature de nutrición). Devuelve `Promise<void>` — no hay contrato de retorno que romper. El hook para la notificación va después de esas dos escrituras, envuelto en su propio `try/catch` para que nunca se propague al caller.

2. **El `CHECK` de `notifications.type` ya fue alterado una vez después de la migración original** — la lista de 5 valores de `20260517_notifications.sql` ya no es la vigente. La versión actual (confirmada contra el dump vivo de la base, `supabase/bd_full.sql:208`) es la de `20260523_notify_churn.sql`, que agregó `'churn_alert'`:
   ```sql
   check (type in ('new_member', 'check_in', 'achievement', 'plan_assigned', 'membership_expiring', 'churn_alert'))
   ```
   La migración nueva tiene que partir de esta lista de 6, no de la original de 5.

3. **No hay policy de INSERT en `notifications` para nadie** (`authenticated`, `anon`, ni siquiera hay una genérica) — confirmado en las tres migraciones que tocan RLS de esta tabla. Todos los inserts existentes son funciones SQL `SECURITY DEFINER` (triggers o funciones on-demand por cron). Elegí el cliente admin en vez de agregar una función `SECURITY DEFINER` nueva: la restricción de "no reimplementar la fórmula en SQL" ya descarta que la decisión viva en Postgres, y una función cuyo único trabajo sería un insert genérico parametrizado no aporta nada sobre usar `createAdminClient()` directamente desde el server action — que además es un patrón ya establecido en `app/actions/create-gym.ts`, `app/actions/machines.ts` y `app/actions/saas-admin.ts`. Cero funciones SQL nuevas más allá del `ALTER TABLE` del punto 2.

4. **Un insert por lote (`insert` con un array de filas) no sirve para el fan-out a admins.** Si dos o más admins reciben la misma notificación y UNO ya la tiene (por un weight-drift anterior con el mismo `dedup_key`), un `INSERT` batch de Postgres es atómico: la violación de constraint de una sola fila aborta el `INSERT` completo, y ningún admin nuevo recibe nada — literalmente el mismo tipo de trampa que la nota sobre `notify_churn_members` advierte, aplicada a "todos o ninguno" en vez de a duplicados por fecha. La solución es `upsert(..., { onConflict: "user_id,dedup_key", ignoreDuplicates: true })`: Postgres resuelve el `ON CONFLICT DO NOTHING` fila por fila, así que los admins nuevos se insertan y los que ya estaban notificados simplemente no generan ni fila ni error. Esto además cumple la instrucción de "manejar la violación de constraint como caso normal" de la forma más directa posible: con `ignoreDuplicates`, no hay error que manejar — Postgres no lo reporta.

5. **`trainer_id` vive en la propia fila de `profiles` del socio** (lo escribe `assignTrainer`, `app/actions/members.ts:177-211`, sobre el perfil del socio siendo asignado) — no hace falta leer el perfil de otro usuario para resolver el destinatario cuando hay trainer. Solo el fallback a "todos los admins del gym" es una lectura cross-user real, y es la única parte de esta feature (además del insert) que necesita el cliente admin — el resto (perfil propio del socio, plan activo propio) se lee con el cliente normal, exactamente como hace `getMemberProfileForPlan`/`getMemberNutritionPlan` hoy.

6. **Ningún trainer recibió nunca una notificación** (684 filas existentes: 656 a admins, 28 a socios) — confirmado también en el componente: `NotificationBell.tsx` no tiene ninguna lógica específica de rol, así que va a renderizar una notificación de un trainer sin cambios, pero es un camino nunca ejercitado en producción. Por eso el paso 3 de la verificación manual entra específicamente como trainer.

7. **`CALORIE_MISMATCH_THRESHOLD` hoy es un `const` privado de `NutritionPlanEditor.tsx:35`** (`0.10`, no exportado). El pedido es explícito: "el mismo umbral que usa el aviso del editor, importado, no duplicado" — se mueve a `lib/nutrition.ts` (que ya no tiene dependencias de React, es el lugar natural) y el editor pasa a importarlo.

9. **Corrección señalada en review: la notificación no se limpiaba cuando el drift se resolvía.** El ciclo original tenía el mismo mecanismo que ya generó 656 notificaciones de churn: cada drift nuevo crea una fila nueva (dedup_key distinto porque `target_calories` cambió), pero nada borra la fila vieja cuando el trainer aprieta "Actualizar objetivo" — la notificación queda en el panel afirmando que el objetivo está desactualizado cuando ya se corrigió. Peor todavía: si el socio baja de peso y vuelve al valor original sin que nadie recalcule nada, el objetivo guardado vuelve a ser válido solo, y la notificación queda mintiendo sin que haya un evento que la dispare a limpiarse. El cierre del ciclo va en `recalculateNutritionPlanTargets` (`app/actions/nutrition.ts`): después del `update` exitoso, borrar las notificaciones `weight_drift` cuyo `dedup_key` corresponde al `target_calories` viejo (el de antes del recálculo, no el nuevo). Elijo borrar en vez de marcar como leída: este código no tiene una vista de "historial" separada del panel — el bell solo muestra lo que sigue vivo, así que una notificación marcada como leída seguiría mostrando el mismo título y cuerpo falsos, solo que sin el punto de "no leído". Marcar como leída resuelve el ruido visual, no el reclamo real (que el contenido ya no es cierto). El borrado sí lo resuelve. Este delete necesita el cliente admin: la policy de DELETE existente en `notifications` (`20260520_notifications_delete_policy.sql`) es `using (user_id = auth.uid())` — solo permite borrar notificaciones propias, y quien recalcula (un admin, o un trainer distinto al que fue notificado en el fallback-a-admins) no siempre es el dueño de la fila a borrar.

10. **Corrección señalada en review: orden de las lecturas en `logWeight`.** El diseño original llamaba a `getMemberProfileForPlan` en cada registro de peso, incluso para socios sin plan activo — un viaje a la base de más en el camino más frecuente (la mayoría de los registros de peso no van a tener un plan activo esperando ese chequeo). Se invierte el orden: primero se busca el plan activo (select liviano, ya necesario para la comparación), y solo si existe y tiene `target_calories` se hace el fetch del perfil. Esto además elimina una consulta duplicada: antes `notifyTrainerOfWeightDrift` volvía a buscar el plan por su cuenta — ahora `logWeight` lo busca una sola vez y se lo pasa como parámetro.

11. **Encontré dos cosas fuera de alcance de este pedido, las dejo anotadas y no las toco:**
   - `NotificationType` en `NotificationBell.tsx:13` no incluye `'churn_alert'` (que sí es válido en la base desde `20260523_notify_churn.sql`) — el color de ese chip cae a `undefined` en runtime (`TYPE_COLOR[n.type]` sin fallback, línea 214). No es un crash, es un ícono sin fondo/color. No lo pediste y es un bug preexistente ajeno al peso — lo señalo por si lo querés como tarea aparte.
   - `weight_logs` no tiene un `UNIQUE (member_id, log_date)` explícito en ninguna migración, a pesar de que `logWeight` hace `.upsert(..., { onConflict: "member_id,log_date" })` — a diferencia de `nutrition_logs` y `water_logs`, que sí tienen su unique constraint. No afecta a esta feature (el "peso viejo" se lee de `profiles.weight_kg`, no de `weight_logs`), pero es una inconsistencia real que vale la pena mirar aparte.

---

## Task 1 — Migración: habilitar `'weight_drift'` en `notifications.type`

**Files:**
- Create: `supabase/migrations/20260730_notifications_weight_drift_type.sql`

- [ ] **Paso 1: escribir la migración**

```sql
-- supabase/migrations/20260730_notifications_weight_drift_type.sql
-- Habilita el tipo 'weight_drift': un socio actualiza su peso y eso deja
-- desactualizado el objetivo de su plan nutricional activo.
-- Parte de la lista vigente (20260523_notify_churn.sql agregó 'churn_alert'
-- sobre la original de 5 valores), no de la lista original.

alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member',
  'check_in',
  'achievement',
  'plan_assigned',
  'membership_expiring',
  'churn_alert',
  'weight_drift'
));
```

- [ ] **Paso 2: correrla en Supabase y verificar la constraint vigente**

Correr el archivo en el SQL editor de Supabase (o vía CLI, según cómo se apliquen normalmente las migraciones de este proyecto). Verificar:

```sql
select pg_get_constraintdef(oid)
from pg_constraint
where conname = 'notifications_type_check';
```

Esperado: la lista de 7 valores del Paso 1, con `'weight_drift'` incluido.

---

## Task 2 — Compartir `CALORIE_MISMATCH_THRESHOLD`

**Files:**
- Modify: `lib/nutrition.ts`
- Modify: `components/nutrition/NutritionPlanEditor.tsx`

**Interfaces:**
- Produces: `CALORIE_MISMATCH_THRESHOLD: number` exportado desde `lib/nutrition.ts`.

- [ ] **Paso 1: agregar el export en `lib/nutrition.ts`**, junto a `calcNutritionTargets`:

```ts
export const CALORIE_MISMATCH_THRESHOLD = 0.10
```

- [ ] **Paso 2: `NutritionPlanEditor.tsx` deja de declararla y pasa a importarla**

Reemplazar (línea 35):
```ts
const CALORIE_MISMATCH_THRESHOLD = 0.10
```
por: eliminar la línea.

Y actualizar el import de `lib/nutrition` (línea 17) para incluirla:
```ts
import { calcMacros, calcPlanMacros, calcNutritionTargets, missingTargetFields, CALORIE_MISMATCH_THRESHOLD, NUTRITION_GOAL_LABELS as GOAL_LABELS } from "@/lib/nutrition"
```

- [ ] **Paso 3: verificación**

`npx tsc --noEmit` — sin errores. El comportamiento del editor no cambia (mismo valor, mismo import numérico).

---

## Task 3 — Detectar el drift y notificar desde `logWeight`

**Files:**
- Modify: `app/actions/nutrition-tracking.ts`

**Interfaces:**
- Consumes: `getMemberProfileForPlan(memberId): Promise<{weight_kg, height_cm, date_of_birth, gender, training_frequency, goal} | null>` y `NutritionPlan` (de `@/app/actions/nutrition`); `calcNutritionTargets(profile, goal)` y `CALORIE_MISMATCH_THRESHOLD` (de `@/lib/nutrition`); `createAdminClient()` (de `@/lib/supabase/admin`).
- Produces: ningún export nuevo — `logWeight` mantiene exactamente su firma actual (`Promise<void>`).

- [ ] **Paso 1: imports nuevos**

Agregar al inicio de `app/actions/nutrition-tracking.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin"
import { calcNutritionTargets, CALORIE_MISMATCH_THRESHOLD } from "@/lib/nutrition"
import { getMemberProfileForPlan } from "@/app/actions/nutrition"
import type { NutritionPlan } from "@/app/actions/nutrition"
```

- [ ] **Paso 2: función privada `notifyTrainerOfWeightDrift`**

Agregar antes de `logWeight` (no se exporta — no es una server action pública, solo la llama `logWeight`). Ya no busca el plan por su cuenta — lo recibe como parámetro, porque `logWeight` lo necesita buscar primero de todas formas (Paso 3):

```ts
async function notifyTrainerOfWeightDrift(
  memberId: string,
  plan: { id: string; gym_id: string; target_calories: number; goal: NutritionPlan["goal"] },
  newProfile: {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
  },
  oldWeight: number | null,
  newWeight: number
): Promise<void> {
  const newTargets = calcNutritionTargets(newProfile, plan.goal)
  if (!newTargets) return

  const diff = Math.abs((plan.target_calories - newTargets.calories) / newTargets.calories)
  if (diff <= CALORIE_MISMATCH_THRESHOLD) return

  const supabase = createClient()
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("trainer_id, full_name")
    .eq("id", memberId)
    .single()

  const admin = createAdminClient()
  let recipientIds: string[]

  if (memberProfile?.trainer_id) {
    recipientIds = [memberProfile.trainer_id]
  } else {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("gym_id", plan.gym_id)
      .eq("role", "admin")
    recipientIds = (admins ?? []).map((a: { id: string }) => a.id)
  }

  if (recipientIds.length === 0) return

  const dedupKey = `weight_drift:${plan.id}:${plan.target_calories}`
  const memberName = memberProfile?.full_name ?? "un socio"

  const { error } = await admin
    .from("notifications" as never)
    .upsert(
      recipientIds.map(userId => ({
        user_id: userId,
        type: "weight_drift",
        title: `Peso actualizado: ${memberName}`,
        body: oldWeight != null
          ? `Pasó de ${oldWeight} a ${newWeight} kg. El objetivo de su plan quedó desactualizado.`
          : `Registró ${newWeight} kg. El objetivo de su plan quedó desactualizado.`,
        metadata: {
          plan_id: plan.id,
          member_id: memberId,
          old_weight: oldWeight,
          new_weight: newWeight,
          old_target: plan.target_calories,
          new_target: newTargets.calories,
        },
        dedup_key: dedupKey,
      })) as never,
      { onConflict: "user_id,dedup_key", ignoreDuplicates: true }
    )

  if (error) {
    console.error("No se pudo notificar el drift de peso:", error.message)
  }
}
```

- [ ] **Paso 3: enganchar en `logWeight`, plan primero**

Reemplazar (líneas 197-209):

```ts
export async function logWeight(weightKg: number, notes?: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const today = new Date().toISOString().split("T")[0]
  await supabase
    .from("weight_logs" as never)
    .upsert({ member_id: user.id, log_date: today, weight_kg: weightKg, notes: notes ?? null } as never, { onConflict: "member_id,log_date" })
  // Also update the profile snapshot
  await supabase.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id)
  revalidatePath("/nutricion")
  revalidatePath("/progress")
}
```

por:

```ts
export async function logWeight(weightKg: number, notes?: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Plan primero: es el chequeo más barato, y la mayoría de los registros de
  // peso no tienen un plan activo esperando este aviso. Evita un fetch de
  // perfil de más en el camino más frecuente.
  const { data: activePlan } = await supabase
    .from("nutrition_plans" as never)
    .select("id, gym_id, target_calories, goal")
    .eq("member_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as {
      data: { id: string; gym_id: string; target_calories: number | null; goal: NutritionPlan["goal"] } | null
    }
  const needsDriftCheck = !!activePlan?.target_calories

  const profileBefore = needsDriftCheck ? await getMemberProfileForPlan(user.id) : null
  const oldWeight = profileBefore?.weight_kg ?? null

  const today = new Date().toISOString().split("T")[0]
  await supabase
    .from("weight_logs" as never)
    .upsert({ member_id: user.id, log_date: today, weight_kg: weightKg, notes: notes ?? null } as never, { onConflict: "member_id,log_date" })
  // Also update the profile snapshot
  await supabase.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id)
  revalidatePath("/nutricion")
  revalidatePath("/progress")

  if (activePlan && profileBefore) {
    try {
      await notifyTrainerOfWeightDrift(
        user.id,
        activePlan as { id: string; gym_id: string; target_calories: number; goal: NutritionPlan["goal"] },
        { ...profileBefore, weight_kg: weightKg },
        oldWeight,
        weightKg
      )
    } catch (err) {
      console.error("No se pudo notificar el drift de peso nutricional:", err)
    }
  }
}
```

El `try/catch` alrededor de `notifyTrainerOfWeightDrift` es la garantía dura del pedido: nada de lo que pase adentro (falta de conexión, un `createAdminClient()` mal configurado, lo que sea) puede hacer que `logWeight` falle — ya escribió `weight_logs` y `profiles.weight_kg` antes de llegar acá.

- [ ] **Paso 4: verificación**

`npx tsc --noEmit` y `npm run lint` — sin errores nuevos en `app/actions/nutrition-tracking.ts`.

---

## Task 4 — Limpiar la notificación cuando el drift se resuelve

**Files:**
- Modify: `app/actions/nutrition.ts`

- [ ] **Paso 1: import de `createAdminClient`**

Agregar al inicio de `app/actions/nutrition.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin"
```

- [ ] **Paso 2: capturar el `target_calories` viejo antes del update, y borrar sus notificaciones después**

`recalculateNutritionPlanTargets` ya hace un `select` del plan (línea 246-250) — solo hace falta sumar `target_calories` a esa lista de columnas para tener la clave vieja disponible.

Reemplazar:

```ts
  const { data: plan } = await supabase
    .from("nutrition_plans" as never)
    .select("gym_id, member_id, goal")
    .eq("id", planId)
    .single() as unknown as { data: { gym_id: string; member_id: string; goal: NutritionPlan["goal"] } | null }
```

por:

```ts
  const { data: plan } = await supabase
    .from("nutrition_plans" as never)
    .select("gym_id, member_id, goal, target_calories")
    .eq("id", planId)
    .single() as unknown as { data: { gym_id: string; member_id: string; goal: NutritionPlan["goal"]; target_calories: number | null } | null }
```

Y reemplazar el final de la función:

```ts
  revalidatePath(`/nutricion/${planId}`)
  revalidatePath("/nutricion")
  return { success: true, targets }
}
```

por:

```ts
  // El drift quedó resuelto: las notificaciones sobre el objetivo viejo ya no
  // aplican. Cliente admin porque la policy de DELETE de notifications es
  // "solo tus propias filas" (user_id = auth.uid()) — quien recalcula no
  // siempre es quien fue notificado (puede ser un admin distinto, o el drift
  // pudo haber avisado a varios admins a la vez).
  if (plan.target_calories != null) {
    const admin = createAdminClient()
    await admin
      .from("notifications" as never)
      .delete()
      .eq("type", "weight_drift")
      .eq("dedup_key", `weight_drift:${planId}:${plan.target_calories}`)
  }

  revalidatePath(`/nutricion/${planId}`)
  revalidatePath("/nutricion")
  return { success: true, targets }
}
```

No se envuelve en `try/catch`: si este delete falla, la actualización del plan ya se confirmó antes (el `updated.length === 0` de arriba ya devolvió el error correspondiente si algo salió mal ahí) — un fallo acá es "la notificación vieja quedó pisada", no "el recálculo falló", así que no debe cambiar el `{ success: true, targets }` que ya se va a devolver. Igualmente, al no arrojar bajo operación normal (mismo patrón que el resto del archivo: `supabase-js` devuelve `{ error }`, no tira excepción), no hace falta el `try/catch` explícito.

- [ ] **Paso 3: verificación**

`npx tsc --noEmit` — sin errores. Verificación funcional junto con el resto en la sección manual, más abajo.

---

## Task 5 — `NotificationBell.tsx`: reconocer `'weight_drift'`

**Files:**
- Modify: `components/notifications/NotificationBell.tsx`

- [ ] **Paso 1: agregar el tipo, ícono y color**

Reemplazar (líneas 4, 13, 25-31, 33-39):

```ts
import { Bell, Users, QrCode, Trophy, Dumbbell, Clock, X } from "lucide-react"
```
```ts
type NotificationType = "new_member" | "check_in" | "achievement" | "plan_assigned" | "membership_expiring"
```
```ts
const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  new_member:          Users,
  check_in:            QrCode,
  achievement:         Trophy,
  plan_assigned:       Dumbbell,
  membership_expiring: Clock,
}
```
```ts
const TYPE_COLOR: Record<NotificationType, string> = {
  new_member:          "bg-brand-700/20 text-brand-400",
  check_in:            "bg-zinc-700/40 text-zinc-400",
  achievement:         "bg-amber-500/15 text-amber-400",
  plan_assigned:       "bg-blue-500/15 text-blue-400",
  membership_expiring: "bg-red-500/15 text-red-400",
}
```

por:

```ts
import { Bell, Users, QrCode, Trophy, Dumbbell, Clock, Scale, X } from "lucide-react"
```
```ts
type NotificationType = "new_member" | "check_in" | "achievement" | "plan_assigned" | "membership_expiring" | "weight_drift"
```
```ts
const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  new_member:          Users,
  check_in:            QrCode,
  achievement:         Trophy,
  plan_assigned:       Dumbbell,
  membership_expiring: Clock,
  weight_drift:        Scale,
}
```
```ts
const TYPE_COLOR: Record<NotificationType, string> = {
  new_member:          "bg-brand-700/20 text-brand-400",
  check_in:            "bg-zinc-700/40 text-zinc-400",
  achievement:         "bg-amber-500/15 text-amber-400",
  plan_assigned:       "bg-blue-500/15 text-blue-400",
  membership_expiring: "bg-red-500/15 text-red-400",
  weight_drift:        "bg-amber-500/15 text-amber-400",
}
```

`Scale` ya se usa en el resto de la app para el concepto de peso (`WeightReminderBanner.tsx`, `WeightProgressCard.tsx`) — mismo ícono, mismo lenguaje visual. El color ámbar es el mismo que usa el aviso de "objetivo desactualizado" en el editor — mismo significado ("esto necesita atención"), no un color nuevo.

No se toca el resto del componente: no soporta navegación por click en ningún tipo hoy (confirmado — no hay `onClick` en la fila más allá de "descartar"), así que el pedido de "si el panel soporta navegación, llevar a `/nutricion/{plan_id}`" no aplica todavía. El `metadata.plan_id` ya queda guardado en la fila para cuando se agregue.

- [ ] **Paso 2: verificación**

`npx tsc --noEmit` — sin errores.

---

## Verificación manual (`npm run dev`)

Este flujo no tiene tests automatizados en el proyecto — se verifica a mano, incluyendo consultas SQL directas donde no hay UI para observar el resultado.

1. **Caso base (con trainer asignado, cruza el umbral):** iniciar sesión como un socio con plan nutricional activo, `trainer_id` asignado, y peso/altura/fecha de nacimiento cargados. Anotar `target_calories` actual del plan. Registrar un peso lo bastante distinto (subir o bajar ~15kg si hace falta para forzar más del 10% de diferencia) desde la pantalla de progreso. Confirmar que el registro de peso se guarda normalmente (sin error visible al socio).
2. **Entrar como el trainer asignado** (primera vez que este camino se ejercita en la app) y confirmar que la campanita muestra la notificación nueva: ícono de balanza, color ámbar, título "Peso actualizado: {nombre}", cuerpo con el peso viejo y el nuevo.
3. **Dedup:** volver a registrar el mismo peso nuevo (sin cambiarlo) como el socio. Confirmar que el trainer NO recibe una segunda notificación.
4. **Recalcular limpia la notificación vieja y habilita una nueva:** con la notificación del paso 2 todavía en la campanita del trainer, ir a `/nutricion/{plan_id}` y usar el botón "Actualizar objetivo" (feature ya existente) para recalcular el plan. Volver a la campanita del trainer **sin recargar la sesión del socio** — confirmar que la notificación del paso 2 desapareció (o, si la sesión del trainer ya estaba abierta, que se va sola por el realtime). Como socio, registrar otro peso que vuelva a cruzar el umbral. Confirmar que esta vez SÍ llega una notificación nueva (el `dedup_key` cambió porque `target_calories` cambió) — y que es la ÚNICA, no una segunda al lado de la vieja.
5. **Se resuelve solo, sin recálculo de por medio:** como socio, con una notificación de drift activa, volver el peso al valor original (el que tenía antes de todo este flujo) sin que nadie use el botón de recalcular. El objetivo del plan (nunca tocado) vuelve a ser válido para ese peso. Confirmar el comportamiento real acá: como nada dispara el cleanup salvo `recalculateNutritionPlanTargets`, la notificación vieja **va a seguir ahí** — es la limitación conocida y explícita del arreglo (ver Contexto verificado, punto 9): el cleanup solo ocurre en el momento del recálculo, no cada vez que la desviación deja de existir. No es un fallo de la implementación, es el alcance que se definió.
6. **Sin trainer, fallback a admins:** como admin, quitarle el trainer asignado al socio (`trainer_id = null`). Repetir un cambio de peso que cruce el umbral. Confirmar (por SQL si hace falta: `select user_id, title, dedup_key from notifications where type = 'weight_drift' order by created_at desc`) que hay una fila por cada admin del gym, todas con el mismo `dedup_key`. Recalcular el plan y confirmar que el delete de Task 4 borra las filas de TODOS los admins (no solo la del admin que ejecutó el recálculo) — es justamente el caso que obliga a usar el cliente admin para el delete.
7. **No notifica si no cruza el umbral:** registrar un cambio de peso chico (menos del 10% de diferencia en calorías). Confirmar que no aparece notificación nueva para nadie.
8. **Sin plan activo:** repetir con un socio sin plan nutricional activo. Confirmar que el registro de peso funciona y no se genera ninguna notificación (ni error).

---

## Fuera de alcance

- No se agrega navegación por click en `NotificationBell.tsx` — el componente no la soporta para ningún tipo hoy; se deja `metadata.plan_id` cargado para cuando se implemente.
- No se corrige que `'churn_alert'` falte en `NotificationType`/`TYPE_COLOR` de `NotificationBell.tsx` — bug preexistente, ajeno a este pedido (ver Contexto verificado, punto 11).
- No se agrega un `UNIQUE (member_id, log_date)` a `weight_logs` — inconsistencia preexistente ajena a este pedido (ver Contexto verificado, punto 11).
- **El cleanup de la notificación solo ocurre en `recalculateNutritionPlanTargets`, no cuando el peso vuelve solo a un valor sin drift** (ver Contexto verificado, punto 9, y verificación manual, caso 5). Cerrar ese caso requeriría comparar contra el objetivo actual en cada `logWeight`, no solo contra el `dedup_key` del recálculo — no lo pediste así, y el caso 2/3 del ciclo (drift → recálculo → limpieza) es el que reproducía el patrón de las 656 notificaciones de churn. Si con el tiempo este caso también genera acumulación, es una segunda vuelta de este mismo plan, no algo para resolver de apuro ahora.
