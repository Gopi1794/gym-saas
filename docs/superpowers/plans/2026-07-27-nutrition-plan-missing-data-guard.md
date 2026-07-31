# Bloquear creación de plan nutricional sin datos del socio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que no se pueda crear un plan nutricional con `target_calories/protein/carbs/fat` inservibles (null) porque al socio le falta peso, altura o fecha de nacimiento — bloqueado en el server action (barrera real) y explicado con el campo exacto en la UI (barrera de UX).

**Architecture:** `createNutritionPlan` deja de recibir `targets` como parámetro confiado del cliente y pasa a calcularlos él mismo, server-side, con los mismos `getMemberProfileForPlan` + `calcNutritionTargets` que ya existen — si da `null`, **devuelve** `{ error: string }` (no tira excepción — Next.js redacta los mensajes de `throw` en Server Actions en producción, solo se ven completos en `next dev`) y no inserta nada. El cliente (`NutritionPlansPanel.tsx`) sigue usando esas mismas dos funciones para la preview y para decidir qué campo nombrar en el aviso, pero ya no controla lo que se guarda, y ahora también tiene que manejar el nuevo tipo de retorno `{ id } | { error }`.

**Tech Stack:** Next.js Server Actions, sin cambios de schema.

## Global Constraints

- Reusar la condición de `calcNutritionTargets` (`lib/nutrition.ts:57` y `:60`) tal cual — no reimplementar el chequeo de campos faltantes ni el de edad.
- El server action es la barrera real: no debe insertar nada si faltan datos, sin importar qué mande el caller.
- La UI debe nombrar el campo puntual que falta, no un mensaje genérico.
- El server action **devuelve** errores (`{ error: string }`), no los tira — un `throw` desde una Server Action se redacta en producción (Next.js oculta el mensaje real y muestra un digest genérico; solo en `next dev` se ve completo). Mismo patrón que ya usa `updateMemberPhysical` en `app/actions/members.ts`.

---

## Contexto verificado antes de planificar

1. **Confirmé el bug leyendo el código, no solo lo que describiste**: `createNutritionPlan` (`app/actions/nutrition.ts:176-205`) inserta `target_calories: targets?.calories ?? null` — si el caller manda `targets: null` (que es exactamente lo que pasa hoy cuando `calcNutritionTargets` devuelve `null` en el cliente), los cuatro campos se insertan en `null`, sin ningún chequeo server-side. Confirmado también que hoy **nada bloquea la inserción** — el único filtro es un mensaje informativo en la UI que ni siquiera deshabilita el botón "Crear plan" (`components/nutrition/NutritionPlansPanel.tsx:288`, el `disabled` no incluye `suggestedTargets`).

2. **`calcNutritionTargets` (`lib/nutrition.ts:52-115`) devuelve `null` por dos motivos, no uno** (ya lo había mapeado para el aviso de `NutritionPlanEditor`, mismo caso acá): faltan `weight_kg`/`height_cm`/`date_of_birth` (línea 57), o la edad calculada da `<10` o `>100` años (línea 60) aunque los tres campos estén cargados. Para el primer caso puedo nombrar el campo exacto comparando contra el `profile` que ya tengo. Para el segundo, no — nombrarlo requeriría duplicar `ageFromDob` (no exportada) solo para ese caso límite, así que usa el mismo mensaje genérico de fallback que ya usé en `NutritionPlanEditor` ("No se pudo calcular el objetivo nutricional a partir de los datos del socio."), por consistencia de copy en la app.

3. **`createNutritionPlan` hoy recibe `targets` como parámetro que el cliente calculó y le pasa de confianza** (`NutritionPlansPanel.tsx:84`). Esto es exactamente lo que señalaste: la acción es llamable directo (server action expuesta), así que alguien podría llamarla con cualquier `targets` inventado sin que el servidor verifique nada contra los datos reales del socio. La solución no es "confiar más" en el parámetro — es sacarlo del todo y que el servidor calcule los targets él mismo, con su propio fetch a `profiles`.

4. **`createNutritionPlan` tiene un solo caller en todo el repo** (grep confirmado: `NutritionPlansPanel.tsx`, la definición, y una mención en un doc de planificación — nada más). Sacar el parámetro `targets` de la firma es seguro, no rompe otro código.

5. **`getMemberProfileForPlan` ya existe en el mismo archivo** (`app/actions/nutrition.ts:160-174`) y devuelve exactamente la forma que pide `calcNutritionTargets` — se llama directo desde `createNutritionPlan`, sin duplicar el query.

---

## Task 1 — Server action: validar antes de insertar

**Files:**
- Modify: `app/actions/nutrition.ts` (import nuevo, firma y cuerpo de `createNutritionPlan`, líneas 176-205)

**Interfaces:**
- `createNutritionPlan(gymId, memberId, name, goal, notes?)` — pierde el parámetro `targets`. Pasa de devolver `Promise<string>` a `Promise<{ id: string } | { error: string }>` — sin excepciones, ni por datos faltantes ni por error de la DB.

- [ ] **Paso 1: importar `calcNutritionTargets`**

En `app/actions/nutrition.ts`, agregar al inicio:

```ts
import { calcNutritionTargets } from "@/lib/nutrition"
```

- [ ] **Paso 2: reescribir `createNutritionPlan` — sin throw, en ningún error path**

Reemplazar la función completa (líneas 176-205) por:

```ts
export async function createNutritionPlan(
  gymId: string,
  memberId: string,
  name: string,
  goal: NutritionPlan["goal"],
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient()

  const profile = await getMemberProfileForPlan(memberId)
  const targets = profile ? calcNutritionTargets(profile, goal) : null

  if (!targets) {
    const missing: string[] = []
    if (!profile?.weight_kg) missing.push("peso")
    if (!profile?.height_cm) missing.push("altura")
    if (!profile?.date_of_birth) missing.push("fecha de nacimiento")
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("nutrition_plans" as never)
    .insert({
      gym_id: gymId,
      member_id: memberId,
      created_by: user?.id,
      name,
      goal,
      notes: notes ?? null,
      target_calories: targets.calories,
      target_protein:  targets.protein,
      target_carbs:    targets.carbs,
      target_fat:      targets.fat,
    } as never)
    .select("id")
    .single()
  if (error) return { error: error.message }
  revalidatePath("/nutricion")
  return { id: (data as unknown as { id: string }).id }
}
```

Nota: `getMemberProfileForPlan` está definida más arriba en el mismo archivo (línea 160) — no hace falta importarla, es una llamada directa dentro del módulo. El `if (error) return { error: error.message }` reemplaza al `throw new Error(error.message)` que ya estaba ahí antes de este cambio — mismo problema de redacción en producción, no solo en la validación nueva.

- [ ] **Paso 3: verificación manual**

Se verifica junto con Task 2 (Paso 6) — sin la UI actualizada no hay forma de ejercitar el nuevo tipo de retorno de punta a punta.

---

## Task 2 — UI: deshabilitar el botón y explicar el campo puntual

**Files:**
- Modify: `components/nutrition/NutritionPlansPanel.tsx`

**Interfaces:**
- Consumes: `createNutritionPlan` con la nueva firma (sin `targets`) de Task 1.

- [ ] **Paso 1: nuevo estado para los campos faltantes**

Junto a `suggestedTargets`/`loadingTargets` (línea 60-61), agregar:

```ts
const [missingFields, setMissingFields] = useState<string[]>([])
```

- [ ] **Paso 2: calcular los campos faltantes junto con `suggestedTargets`**

Reemplazar `handleMemberOrGoalChange` (líneas 65-78) por:

```ts
async function handleMemberOrGoalChange(memberId: string, goal: NutritionPlan["goal"]) {
    if (!memberId) { setSuggestedTargets(null); setMissingFields([]); return }
    setLoadingTargets(true)
    try {
      const profile = await getMemberProfileForPlan(memberId)
      const targets = profile ? calcNutritionTargets(profile, goal) : null
      setSuggestedTargets(targets)
      if (!targets) {
        const missing: string[] = []
        if (!profile?.weight_kg) missing.push("peso")
        if (!profile?.height_cm) missing.push("altura")
        if (!profile?.date_of_birth) missing.push("fecha de nacimiento")
        setMissingFields(missing)
      } else {
        setMissingFields([])
      }
    } finally {
      setLoadingTargets(false)
    }
  }
```

- [ ] **Paso 3: `handleCreate` maneja `{ id } | { error }` en vez de try/catch**

`createNutritionPlan` ya no tira excepciones **por errores conocidos** (Task 1) — pero la llamada igual puede rechazar la promesa por algo que la action nunca llegó a controlar: red caída, timeout, un 500 antes de que corra el código. `return` cubre lo primero, `try/catch` cubre lo segundo — hacen falta los dos, uno no reemplaza al otro. Reemplazar `handleCreate` completo (líneas 80-93) por:

```ts
function handleCreate() {
    if (!form.memberId || !form.name.trim()) return
    startTransition(async () => {
      try {
        const result = await createNutritionPlan(gymId, form.memberId, form.name, form.goal, form.notes || undefined)
        if ("error" in result) {
          sileo.error({ title: "No se pudo crear el plan", description: result.error, duration: 4000 })
          return
        }
        sileo.success({ title: "Plan nutricional creado", description: "Ya podés cargarle las comidas desde el editor.", duration: 3000 })
        setShowCreate(false)
        router.push(`/nutricion/${result.id}`)
        router.refresh()
      } catch {
        sileo.error({ title: "No se pudo crear el plan", description: "Revisá tu conexión e intentá de nuevo.", duration: 4000 })
      }
    })
  }
```

Sin el `try/catch`, un rechazo de la promesa (red, timeout, 500) deja `isPending` sin forma de volver a `false` — el botón queda en "Creando…" para siempre, sin ningún aviso. Mismo patrón que `MemberPhysicalEdit.tsx` usa para el camino conocido (`if (result.error) {...} else {...}`), con el catch agregado encima para el camino desconocido — y de paso, el toast de error conocido ahora muestra el mensaje real (`result.error`) en vez de un texto fijo genérico, porque ya lo tenemos disponible.

- [ ] **Paso 4: reemplazar el mensaje genérico por uno con el campo puntual + link a la ficha del socio**

Reemplazar el bloque (líneas 266-268):

```tsx
{form.memberId && !suggestedTargets && !loadingTargets && (
  <p className="text-xs text-zinc-500">No se pudieron calcular targets — el socio no tiene datos de peso/altura/edad/género completos.</p>
)}
```

por:

```tsx
{form.memberId && !suggestedTargets && !loadingTargets && (
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
    <p>
      {missingFields.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missingFields.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."}
    </p>
    <Link
      href={`/members/${form.memberId}`}
      className="mt-1.5 inline-block font-semibold underline hover:text-amber-300 transition-colors"
    >
      Completar datos del socio →
    </Link>
  </div>
)}
```

`Link` ya está importado en este archivo (línea 4) — no hace falta agregarlo.

- [ ] **Paso 5: deshabilitar "Crear plan" cuando falten datos**

En el botón (línea 288), cambiar:

```tsx
disabled={isPending || !form.memberId || !form.name.trim()}
```

por:

```tsx
disabled={isPending || !form.memberId || !form.name.trim() || !suggestedTargets || loadingTargets}
```

`loadingTargets` se agrega para que el botón no quede habilitado un instante antes de que la verificación async termine.

- [ ] **Paso 6: verificación manual — tres casos**

`npm run dev` → `/nutricion` → "Nuevo plan":

1. Elegir un socio **sin** peso, altura o fecha de nacimiento completos → el botón "Crear plan" tiene que quedar deshabilitado y aparecer el aviso nombrando el campo exacto que falta, con el link "Completar datos del socio →" apuntando a `/members/[id]` de ese socio.
2. Ir a esa ficha, completar el dato faltante, volver a `/nutricion` → "Nuevo plan" → elegir el mismo socio de nuevo → ahora sí tiene que aparecer la preview de targets calculados y el botón habilitarse.
3. Intentar crear el plan (con los datos completos) → confirmar que se crea con `target_calories` real (no null) — se puede ver en la lista de planes, al lado del nombre del socio (`· {target_calories} kcal/día`, línea 156-158 del mismo archivo).
4. Con un socio con datos completos, cortar la red (devtools → Network → Offline) antes de tocar "Crear plan", y confirmar: el botón no queda trabado en "Creando…" para siempre, vuelve a "Crear plan" habilitado y aparece el toast "Revisá tu conexión e intentá de nuevo." — regresión puntual que motivó el `try/catch`.

- [ ] **Paso 7: commit**

```bash
git add app/actions/nutrition.ts components/nutrition/NutritionPlansPanel.tsx
git commit -m "fix: bloquear creación de plan nutricional sin datos completos del socio"
```

---

## Fuera de alcance

- No se toca `calcNutritionTargets` ni `calcPlanMacros`.
- No se hace nada con los planes que ya existen en la base con `target_calories` null — este fix previene casos nuevos, no corrige los viejos. Si hace falta un backfill, es una tarea aparte (habría que decidir si recalcular con los datos actuales del socio o dejarlos como están).
