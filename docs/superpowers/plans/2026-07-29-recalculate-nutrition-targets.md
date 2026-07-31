# Recalcular objetivo de un plan nutricional — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el trainer pueda actualizar `target_calories/protein/carbs/fat` de un plan existente desde el aviso de "objetivo desactualizado", sin borrar el plan ni tocar las comidas cargadas.

**Architecture:** Server action nueva que reusa `getMemberProfileForPlan` + `calcNutritionTargets` (mismo par que ya usa `createNutritionPlan`), con el mismo esqueleto de auth+gym-check que el resto de `app/actions/nutrition.ts` y `app/actions/members.ts`. En la UI, el aviso de "objetivo desactualizado" (Chequeo 1, rama de objetivo obsoleto) deja de ser un string suelto en el array de warnings y pasa a cargar el número recalculado, para poder mostrarlo en el botón y en la confirmación.

**Tech Stack:** Sin cambios de schema.

## Global Constraints

- No reimplementar la fórmula — reusar `calcNutritionTargets` tal cual, sin tocarla.
- No tocar `nutrition_meals`/`nutrition_meal_items` — solo los 4 campos de target en `nutrition_plans`.
- El botón solo en el aviso de objetivo desactualizado (Chequeo 1, rama "stale"), no en el de datos faltantes.
- El server action nunca tira excepción — siempre `{ error }` o `{ success: true, targets }`.

---

## Contexto verificado antes de planificar

1. **El patrón de auth+gym-check ya está establecido en 4 funciones distintas** (`updateMemberPhysical`, `updateMemberContact`, `updateMemberMembership`, `assignTrainer` en `app/actions/members.ts`) — mismo esqueleto: auth → rol admin/trainer → gym del target coincide → update → `{ error } | { success }`. Lo sigo para consistencia.

2. **Encontré un guard que ya existe en `updateMemberMembership` y que este action también necesita**: el comentario en esa función dice literalmente *"Si RLS bloqueó el update, Supabase no tira error pero tampoco devuelve filas. Sin esta guarda, se podía registrar el pago sin haber extendido la membresía."* — un `.update()` bloqueado por RLS no es un `error`, es cero filas afectadas en silencio. Sin chequear `updated.length === 0` después del update, un fallo de permisos que mi check de gym no haya cubierto (o una policy RLS más estricta del lado de la base) haría que la action devuelva éxito sin haber cambiado nada. Lo agrego, mismo patrón.

3. **`NutritionPlanEditor.tsx` no importa `useRouter` hoy.** Sin `router.refresh()` después de recalcular, el componente sigue mostrando `plan.target_calories` viejo (viene de props del Server Component padre) hasta un reload manual — literalmente el mismo bug que ya encontramos y arreglamos en `MemberPhysicalEdit.tsx`/`MemberContactEdit.tsx` esta sesión. Lo agrego de entrada, no hace falta que lo señales de nuevo.

4. **Corrección señalada en review**: la lógica de "qué campo falta" (`peso`/`altura`/`fecha de nacimiento`) ya estaba duplicada en `createNutritionPlan` y en `NutritionPlansPanel.tsx` — agregar `recalculateNutritionPlanTargets` la hubiera llevado a tres copias idénticas. Mismo riesgo que los `GOAL_LABELS` duplicados que se unificaron antes: si `calcNutritionTargets` empieza a exigir otro campo, hay que acordarse de actualizar los tres lugares a mano. Se extrae `missingTargetFields(profile)` a `lib/nutrition.ts`, al lado de `calcNutritionTargets` — los tres call sites (los dos existentes más el nuevo) pasan a usarla en vez de repetir el chequeo.

5. **`nutritionWarnings` hoy es `string[]` plano** (líneas 708-740) — no distingue qué chequeo generó cada mensaje. Para que el botón "sepa" el número a mostrar y solo aparezca en el aviso correcto, separo la rama "objetivo desactualizado" del Chequeo 1 en su propia variable (`staleObjectiveWarning: { message, recalculatedCalories } | null`), y dejo el resto (datos faltantes + Chequeo 2) en un array de strings como está ahora. El cálculo en sí no cambia, solo cómo se guarda el resultado.

6. **Ya existe el patrón de modal de confirmación en este mismo archivo** (`deletingMealId`/`clearingPlan`, con `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` ya importados) — lo sigo para el nuevo modal, mismo estilo visual.

---

## Task 1 — Helper compartido + server action

**Files:**
- Modify: `lib/nutrition.ts`
- Modify: `app/actions/nutrition.ts`

**Interfaces:**
- Produces: `missingTargetFields(profile): string[]` en `lib/nutrition.ts`.
- Produces: `recalculateNutritionPlanTargets(planId: string): Promise<{ error: string } | { success: true; targets: { calories: number; protein: number; carbs: number; fat: number } }>`

- [ ] **Paso 1: `missingTargetFields` en `lib/nutrition.ts`**, al lado de `calcNutritionTargets`:

```ts
export function missingTargetFields(
  profile: { weight_kg: number | null; height_cm: number | null; date_of_birth: string | null } | null
): string[] {
  return [
    !profile?.weight_kg && "peso",
    !profile?.height_cm && "altura",
    !profile?.date_of_birth && "fecha de nacimiento",
  ].filter(Boolean) as string[]
}
```

Tipo del parámetro laxo a propósito: los tres call sites (dos existentes + el nuevo) pasan el resultado de `getMemberProfileForPlan`, que trae más campos (`gender`, `training_frequency`, `goal`) — estructuralmente compatible sin casteos.

- [ ] **Paso 2: `createNutritionPlan` usa el helper**

Reemplazar (en `app/actions/nutrition.ts`):

```ts
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
```

por:

```ts
if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }
```

Actualizar el import de `lib/nutrition` en este archivo: `import { calcNutritionTargets, missingTargetFields } from "@/lib/nutrition"`.

- [ ] **Paso 3: agregar `recalculateNutritionPlanTargets`**, después de `updateNutritionPlan`:

```ts
export async function recalculateNutritionPlanTargets(
  planId: string
): Promise<{ error: string } | { success: true; targets: { calories: number; protein: number; carbs: number; fat: number } }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: plan } = await supabase
    .from("nutrition_plans" as never)
    .select("gym_id, member_id, goal")
    .eq("id", planId)
    .single() as unknown as { data: { gym_id: string; member_id: string; goal: NutritionPlan["goal"] } | null }

  if (!plan || plan.gym_id !== (me as any).gym_id) {
    return { error: "El plan no pertenece a tu gym" }
  }

  const profile = await getMemberProfileForPlan(plan.member_id)
  const targets = profile ? calcNutritionTargets(profile, plan.goal) : null

  if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const { data: updated, error } = await supabase
    .from("nutrition_plans" as never)
    .update({
      target_calories: targets.calories,
      target_protein:  targets.protein,
      target_carbs:    targets.carbs,
      target_fat:      targets.fat,
    } as never)
    .eq("id", planId)
    .select("id")

  if (error) return { error: error.message }

  // Mismo guard que updateMemberMembership: RLS bloqueado no tira error, devuelve 0 filas.
  if (!updated || updated.length === 0) {
    return { error: "No se pudo actualizar el plan (sin permiso o no existe)" }
  }

  revalidatePath(`/nutricion/${planId}`)
  revalidatePath("/nutricion")
  return { success: true, targets }
}
```

`revalidatePath("/nutricion")` además de la ruta del plan — la lista en `NutritionPlansPanel.tsx` muestra `· {target_calories} kcal/día` por plan; sin esto, el trainer recalcula, vuelve a `/nutricion` y sigue viendo el número viejo.

- [ ] **Paso 4: `NutritionPlansPanel.tsx` también usa el helper**

En `components/nutrition/NutritionPlansPanel.tsx`, reemplazar:

```ts
const missingFields = memberProfile
    ? ([
        !memberProfile.weight_kg && "peso",
        !memberProfile.height_cm && "altura",
        !memberProfile.date_of_birth && "fecha de nacimiento",
      ].filter(Boolean) as string[])
    : []
```

por:

```ts
const missingFields = missingTargetFields(memberProfile)
```

Actualizar el import: `import { calcNutritionTargets, missingTargetFields, NUTRITION_GOAL_OPTIONS, NUTRITION_GOAL_LABELS } from "@/lib/nutrition"`.

- [ ] **Paso 5: verificación**

Se verifica junto con Task 2 — no hay UI para el recálculo hasta entonces, pero este paso también cambia el comportamiento de `NutritionPlansPanel.tsx`: al abrir "Nuevo plan" y elegir un socio con datos incompletos, el mensaje de campos faltantes tiene que verse idéntico a antes.

---

## Task 2 — UI: botón en el aviso + confirmación

**Files:**
- Modify: `components/nutrition/NutritionPlanEditor.tsx`

- [ ] **Paso 1: imports y estado nuevo**

Agregar:

```ts
import { useRouter } from "next/navigation"
```

```ts
import {
  addMeal, updateMeal, deleteMeal,
  addMealItem, updateMealItem, deleteMealItem,
  updateNutritionPlan, createFood,
  addFoodFavorite, removeFoodFavorite,
  recalculateNutritionPlanTargets,
} from "@/app/actions/nutrition"
```

Dentro del componente, junto a `const [, startTransition] = useTransition()`:

```ts
const router = useRouter()
const [confirmingRecalculate, setConfirmingRecalculate] = useState(false)
const [isRecalculating, setIsRecalculating] = useState(false)
```

Sumar `missingTargetFields` al import existente de `lib/nutrition` en este archivo (el que ya trae `NUTRITION_GOAL_OPTIONS`/`NUTRITION_GOAL_LABELS` de la feature anterior) — la rama "faltan datos" del Chequeo 1 (Paso 2, abajo) pasa a usarlo también: es la cuarta copia de la misma lógica, y ya que se está tocando este bloque no tiene sentido dejarla afuera del helper que se acaba de crear.

- [ ] **Paso 2: separar la rama "objetivo desactualizado" del resto de los warnings**

Reemplazar (líneas 708-740):

```ts
const nutritionWarnings: string[] = []

// Chequeo 1: ¿el objetivo guardado en el plan sigue siendo válido con los datos actuales del socio?
if (!nutritionTargets) {
  const missing: string[] = []
  if (memberProfile) {
    if (!memberProfile.weight_kg) missing.push("peso")
    if (!memberProfile.height_cm) missing.push("altura")
    if (!memberProfile.date_of_birth) missing.push("fecha de nacimiento")
  }
  nutritionWarnings.push(
    missing.length > 0
      ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
      : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
  )
} else if (plan.target_calories) {
  const staleDiff = (plan.target_calories - nutritionTargets.calories) / nutritionTargets.calories
  if (Math.abs(staleDiff) > CALORIE_MISMATCH_THRESHOLD) {
    nutritionWarnings.push(
      `El objetivo del plan (${plan.target_calories.toLocaleString("es-AR")} kcal) se calculó con datos anteriores. Con el peso actual del socio serían ${nutritionTargets.calories.toLocaleString("es-AR")} kcal.`
    )
  }
}

// Chequeo 2: ¿lo que suman las comidas cargadas llega al objetivo guardado del plan?
if (plan.target_calories && planTotals.calories > 0) {
  const mealsDiff = (planTotals.calories - plan.target_calories) / plan.target_calories
  if (Math.abs(mealsDiff) > CALORIE_MISMATCH_THRESHOLD) {
    nutritionWarnings.push(
      `Las comidas suman ${Math.round(planTotals.calories).toLocaleString("es-AR")} kcal contra el objetivo de ${plan.target_calories.toLocaleString("es-AR")} kcal del plan.`
    )
  }
}
```

por:

```ts
const nutritionWarnings: string[] = []
let staleObjectiveWarning: { message: string; recalculatedCalories: number } | null = null

// Chequeo 1: ¿el objetivo guardado en el plan sigue siendo válido con los datos actuales del socio?
if (!nutritionTargets) {
  const missing = missingTargetFields(memberProfile)
  nutritionWarnings.push(
    missing.length > 0
      ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
      : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
  )
} else if (plan.target_calories) {
  const staleDiff = (plan.target_calories - nutritionTargets.calories) / nutritionTargets.calories
  if (Math.abs(staleDiff) > CALORIE_MISMATCH_THRESHOLD) {
    staleObjectiveWarning = {
      message: `El objetivo del plan (${plan.target_calories.toLocaleString("es-AR")} kcal) se calculó con datos anteriores. Con el peso actual del socio serían ${nutritionTargets.calories.toLocaleString("es-AR")} kcal.`,
      recalculatedCalories: nutritionTargets.calories,
    }
  }
}

// Chequeo 2: ¿lo que suman las comidas cargadas llega al objetivo guardado del plan?
if (plan.target_calories && planTotals.calories > 0) {
  const mealsDiff = (planTotals.calories - plan.target_calories) / plan.target_calories
  if (Math.abs(mealsDiff) > CALORIE_MISMATCH_THRESHOLD) {
    nutritionWarnings.push(
      `Las comidas suman ${Math.round(planTotals.calories).toLocaleString("es-AR")} kcal contra el objetivo de ${plan.target_calories.toLocaleString("es-AR")} kcal del plan.`
    )
  }
}
```

El cálculo no cambia — solo dónde se guarda el resultado de la rama "stale".

- [ ] **Paso 3: handler de confirmación**

Junto a `handleToggleActive`:

```ts
async function handleConfirmRecalculate() {
    setIsRecalculating(true)
    try {
      const result = await recalculateNutritionPlanTargets(plan.id)
      if ("error" in result) {
        sileo.error({ title: "No se pudo actualizar el objetivo", description: result.error, duration: 4000 })
        return
      }
      sileo.success({
        title: "Objetivo actualizado",
        description: `Nuevo objetivo: ${result.targets.calories.toLocaleString("es-AR")} kcal.`,
        duration: 3000,
      })
      setConfirmingRecalculate(false)
      router.refresh()
    } catch {
      sileo.error({ title: "No se pudo actualizar el objetivo", description: "Revisá tu conexión e intentá de nuevo.", duration: 4000 })
    } finally {
      setIsRecalculating(false)
    }
  }
```

- [ ] **Paso 4: JSX — botón dentro del cartel + modal de confirmación**

Reemplazar el bloque de avisos (líneas 837-845):

```tsx
{nutritionWarnings.length > 0 && (
  <div className="space-y-2">
    {nutritionWarnings.map((msg, i) => (
      <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
        {msg}
      </div>
    ))}
  </div>
)}
```

por:

```tsx
{staleObjectiveWarning && (
  <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
    <p>{staleObjectiveWarning.message}</p>
    <button
      onClick={() => setConfirmingRecalculate(true)}
      className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
    >
      Actualizar objetivo a {staleObjectiveWarning.recalculatedCalories.toLocaleString("es-AR")} kcal
    </button>
  </div>
)}

{nutritionWarnings.length > 0 && (
  <div className="space-y-2">
    {nutritionWarnings.map((msg, i) => (
      <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
        {msg}
      </div>
    ))}
  </div>
)}
```

Y agregar el modal, junto a los otros `<Dialog>` de este archivo (después del de "Clear plan modal"):

```tsx
{/* Recalculate targets modal */}
<Dialog open={confirmingRecalculate} onOpenChange={open => { if (!open && !isRecalculating) setConfirmingRecalculate(false) }}>
  <DialogContent className="sm:max-w-sm border-zinc-800 bg-zinc-900">
    <DialogHeader>
      <DialogTitle className="text-zinc-50">¿Actualizar el objetivo del plan?</DialogTitle>
      <DialogDescription className="text-zinc-400">
        {staleObjectiveWarning && (
          <>El objetivo va a pasar a {staleObjectiveWarning.recalculatedCalories.toLocaleString("es-AR")} kcal (proteínas, carbohidratos y grasas se recalculan con él). Las comidas cargadas no se tocan.</>
        )}
      </DialogDescription>
    </DialogHeader>
    <div className="flex gap-3 pt-2">
      <button
        onClick={() => setConfirmingRecalculate(false)}
        disabled={isRecalculating}
        className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40 transition-colors"
      >
        Cancelar
      </button>
      <button
        onClick={handleConfirmRecalculate}
        disabled={isRecalculating}
        className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
      >
        {isRecalculating ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Paso 5: verificación manual**

`npm run dev` → abrir un plan con objetivo desactualizado (cambiar el peso del socio en su ficha primero, si hace falta, para provocar el aviso):

1. El cartel de "objetivo desactualizado" muestra el botón "Actualizar objetivo a X kcal" con el número correcto. El cartel de "faltan datos" (probar con otro socio sin peso/altura/fecha de nacimiento) **no** tiene botón.
2. Click en el botón → aparece el modal de confirmación con el mismo número y la aclaración de que las comidas no se tocan.
3. Cancelar → el modal cierra, nada cambió.
4. Confirmar → estado "Actualizando…" en el botón, toast de éxito, el modal cierra, y **sin recargar la página** el objetivo nuevo se ve reflejado (CalorieRing, MacroBar, Totales del día, Resumen del plan) — confirma que `router.refresh()` funciona.
5. Si después de recalcular las comidas cargadas no llegan al nuevo objetivo, confirmar que aparece el aviso de Chequeo 2 ("Las comidas suman…") — es el comportamiento esperado, no un bug.
6. Cortar la red (devtools → Offline) antes de confirmar → el botón no queda trabado en "Actualizando…", vuelve a habilitarse y aparece el toast de error de conexión.
7. Con un socio al que le falten datos, forzar (si es posible) llegar al estado de recalcular → confirmar que el server action devuelve el error de datos faltantes y no actualiza nada.

- [ ] **Paso 6: commit**

```bash
git add app/actions/nutrition.ts components/nutrition/NutritionPlanEditor.tsx
git commit -m "feat: permitir recalcular el objetivo de un plan nutricional desactualizado"
```

---

## Fuera de alcance

- No se toca el aviso de Chequeo 2 (comidas vs objetivo) — sigue sin acción asociada, es información para que el trainer ajuste las comidas a mano.
- No se agrega recálculo automático ni programado — siempre es una acción explícita del trainer, con confirmación.
