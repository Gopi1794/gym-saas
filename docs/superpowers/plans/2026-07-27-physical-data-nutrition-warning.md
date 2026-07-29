# Aviso de desalineación nutricional por datos físicos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar a admin/trainer, sin bloquear ni recalcular nada solo, cuando (1) están por cambiar peso/altura de un socio con plan nutricional activo, y (2) el plan de comidas cargado se desvía más de un 10% del objetivo calórico calculado a partir de los datos actuales del socio.

**Architecture:** Dos cambios independientes, cada uno de solo-lectura/UI — ningún cambio de escritura ni de `calcNutritionTargets`/`calcPlanMacros`. CHANGE 1 agrega un query mínimo de existencia + un texto condicional en `MemberPhysicalEdit`. CHANGE 2 agrega una comparación derivada (no persistida) en `NutritionPlanEditor`, alimentada por el perfil del socio que ya se puede obtener con una función existente (`getMemberProfileForPlan`).

**Tech Stack:** Next.js 14 App Router, Server Components para fetch, Client Components para la UI condicional. Sin test runner en el repo — verificación manual en navegador (`npm run dev`).

## Global Constraints

- No modificar `calcNutritionTargets` ni `calcPlanMacros` (`lib/nutrition.ts`).
- No agregar recálculo automático del plan de comidas: solo detectar y avisar.
- CHANGE 1: texto fijo, sin diálogo ni modal de confirmación.
- CHANGE 2: umbral como constante nombrada, no un `0.10` suelto.
- CHANGE 2: números concretos en el mensaje, no un texto genérico.

---

## Contexto verificado antes de planificar

Cosas que confirmé leyendo el código antes de armar esto, porque cambian el plan si están mal:

1. **`updateMemberPhysical` (`app/actions/members.ts:12-45`) no toca `nutrition_plans` en absoluto** — solo hace `update({ weight_kg, height_cm })` sobre `profiles`. Los `target_calories/protein/carbs/fat` de un plan se escriben una sola vez, al crearlo (`createNutritionPlan`, `app/actions/nutrition.ts:176-205`), y nunca se vuelven a tocar. La redacción original de CHANGE 1 ("se recalculan los objetivos nutricionales") prometía un recálculo que no existe — corregido: el texto final no afirma que nada se recalcule solo, y apunta directamente a dónde el trainer va a ver la consecuencia (el aviso de CHANGE 2 en el editor del plan). Ver texto final en Task 1, Paso 3.

2. **`calcNutritionTargets(profile, goal)` recibe el `goal` aparte, no de `profile.goal`** (`lib/nutrition.ts:52-57` destructura `weight_kg, height_cm, date_of_birth, gender, training_frequency` — `profile.goal` ni se lee). Para NutritionPlanEditor eso significa pasar `plan.goal` como segundo argumento, no depender de que el perfil traiga `goal`.

3. **Ya existe `getMemberProfileForPlan(memberId)` en `app/actions/nutrition.ts:160-174`**, devuelve exactamente `{ weight_kg, height_cm, date_of_birth, gender, training_frequency }` — la forma que pide `calcNutritionTargets` (el tipo `MemberProfile` interno de `lib/nutrition.ts` no está exportado, pero `goal` es opcional ahí, así que esta forma matchea igual por estructura). No hace falta exportar nada de `lib/nutrition.ts`.

4. **Bug que evité, no que agregué:** `NutritionPlanEditor` mantiene dos fuentes de comidas — `meals` (estado inicial, `nutrition_meal_items` embebido) y `mealItems` (`Record<mealId, MealItem[]>`, la que se actualiza en vivo con cada alta/baja/edición de alimento — ver `handleAddFoodToMeal`, `handleUpdateGrams`, etc., todas llaman `setMealItems`, ninguna toca `setMeals`). Si llamo `calcPlanMacros(meals)` literal, uso datos desactualizados apenas el usuario edita algo en la sesión actual. La comparación tiene que alimentarse de `mealItems` (vía un `meals` reconstruido con los items en vivo), no del `meals` crudo. Task 2 lo resuelve armando un `liveMeals` antes de llamar a `calcPlanMacros`, en vez de pasarle el estado stale.

5. **"Plan sin comidas cargadas"** lo interpreto como "no hay nada que sumar" — cubre tanto `meals.length === 0` como comidas creadas pero vacías de alimentos (0 kcal sumadas). Un plan con una comida vacía comparado contra un objetivo real daría un falso "-100%", que es ruido, no señal. La condición de guarda es `totals.calories > 0`, no `meals.length > 0`.

6. **`calcNutritionTargets` devuelve `null` por dos motivos, no uno**: faltan `weight_kg`/`height_cm`/`date_of_birth` (línea 57), **o** la edad calculada da `< 10` o `> 100` (línea 60) aunque los tres campos estén presentes. Vos solo pediste el mensaje para el primer caso. Para el segundo (raro, pero real: fecha de nacimiento cargada mal) uso un mensaje genérico de fallback en vez de inventar una lectura de edad fuera de la función — evita duplicar la lógica de `ageFromDob` (que tampoco está exportada) solo para un caso límite.

---

## Task 1 — CHANGE 1: aviso en "Datos físicos"

**Files:**
- Modify: `app/(dashboard)/members/[id]/page.tsx:99-135` (agregar query), `:216-220` (pasar prop)
- Modify: `components/members/MemberPhysicalEdit.tsx:9-13` (prop nueva), `:96-129` (texto en modo edición)

**Interfaces:**
- Produces: `MemberPhysicalEdit` gana la prop `hasActiveNutritionPlan: boolean`.

- [ ] **Paso 1: agregar el query de existencia al `Promise.all` de la page**

En `app/(dashboard)/members/[id]/page.tsx`, dentro del array del `Promise.all` (línea ~99-135), agregar una entrada más siguiendo el mismo patrón que `totalCheckIns` (que ya usa `count`, `head: true`):

```ts
supabase.from("nutrition_plans" as never).select("id", { count: "exact", head: true })
  .eq("member_id", params.id).eq("is_active", true),
```

Y en la desestructuración de resultados, agregar `{ count: activeNutritionPlanCount }` en la posición correspondiente.

- [ ] **Paso 2: pasar la prop al componente**

En el JSX (línea ~216-220), cambiar:

```tsx
<MemberPhysicalEdit
  memberId={params.id}
  initialWeight={member.weight_kg}
  initialHeight={member.height_cm}
/>
```

por:

```tsx
<MemberPhysicalEdit
  memberId={params.id}
  initialWeight={member.weight_kg}
  initialHeight={member.height_cm}
  hasActiveNutritionPlan={(activeNutritionPlanCount ?? 0) > 0}
/>
```

- [ ] **Paso 3: recibir la prop y mostrar el texto en modo edición**

En `components/members/MemberPhysicalEdit.tsx`, la interfaz `Props` (línea 9-13) pasa a:

```tsx
interface Props {
  memberId: string
  initialWeight: number | null
  initialHeight: number | null
  hasActiveNutritionPlan: boolean
}
```

Y la firma del componente (línea 15):

```tsx
export default function MemberPhysicalEdit({ memberId, initialWeight, initialHeight, hasActiveNutritionPlan }: Props) {
```

Dentro del bloque `key="edit"` (línea 88-148), justo antes del botón "Guardar cambios" (antes de la línea 140), agregar — sin diálogo, sin condición de `editing` distinta a la que ya envuelve todo este bloque:

```tsx
{hasActiveNutritionPlan && (
  <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
    El objetivo nutricional del plan se calculó con el peso y la altura actuales.
    Si los cambiás, el objetivo del plan queda desactualizado — te lo vamos a
    avisar en el editor del plan.
  </p>
)}
```

**Decisión de ubicación:** lo pongo en el modo edición (donde ya están los inputs de peso/talla), no en el modo vista — es el momento en que el aviso es accionable, y en modo vista sería ruido permanente sin ningún input al lado. Si lo querés también visible en modo vista, es mover el bloque fuera del `motion.div key="edit"`.

- [ ] **Paso 4: verificación manual**

`npm run dev` → abrir la ficha de un socio con plan nutricional activo (`is_active = true` en `nutrition_plans`) → click "Editar" en Datos físicos → confirmar que aparece el texto arriba del botón "Guardar cambios", sin ningún modal. Repetir con un socio sin plan nutricional (o con plan `is_active = false`) → confirmar que el texto no aparece.

- [ ] **Paso 5: commit**

```bash
git add app/\(dashboard\)/members/\[id\]/page.tsx components/members/MemberPhysicalEdit.tsx
git commit -m "feat: avisar en Datos físicos si el socio tiene plan nutricional activo"
```

---

## Task 2 — CHANGE 2: detección de desalineación en NutritionPlanEditor

**Files:**
- Modify: `app/(dashboard)/nutricion/[id]/page.tsx:5-6` (import), `:24-30` (fetch), `:44` (prop nueva)
- Modify: `components/nutrition/NutritionPlanEditor.tsx:1-23` (imports/tipos/Props), `:600-699` (cálculo), `:793-813` (render del aviso)

**Interfaces:**
- Consumes: `getMemberProfileForPlan(memberId: string)` de `app/actions/nutrition.ts:160-174`, ya existente. `calcNutritionTargets(profile, goal)` y `calcPlanMacros(meals)` de `lib/nutrition.ts`, sin modificar.
- Produces: `NutritionPlanEditor` gana la prop `memberProfile: MemberProfileForTargets | null`.

- [ ] **Paso 1: traer el perfil del socio en la page**

En `app/(dashboard)/nutricion/[id]/page.tsx`, agregar el import:

```ts
import { getNutritionPlan, getFoods, getFoodFavorites, getMemberProfileForPlan } from "@/app/actions/nutrition"
```

Después de `if (!plan) notFound()` (línea 30), agregar:

```ts
const memberProfile = await getMemberProfileForPlan(plan.member_id)
```

(Va después porque depende de `plan.member_id`, así que no puede entrar al `Promise.all` de arriba sin reordenar esa promesa — no vale la pena la complejidad extra por un fetch de una sola fila.)

Y pasar la prop nueva en el JSX (línea 44):

```tsx
<NutritionPlanEditor plan={plan} foods={foods} userId={user!.id} initialFavorites={favoriteIds} memberProfile={memberProfile} />
```

- [ ] **Paso 2: tipo local + import + Props en NutritionPlanEditor**

En `components/nutrition/NutritionPlanEditor.tsx`, cambiar el import de `lib/nutrition` (línea 17):

```ts
import { calcMacros, calcPlanMacros, calcNutritionTargets } from "@/lib/nutrition"
```

Agregar, cerca de `GOAL_LABELS` (línea 25-30), el tipo local (convención del proyecto: tipos locales por componente, no un archivo global) y la constante del umbral:

```ts
type MemberProfileForTargets = {
  weight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  gender: "male" | "female" | "other" | null
  training_frequency: "never" | "1-2" | "3-4" | "5+" | null
}

const CALORIE_MISMATCH_THRESHOLD = 0.10
```

Cambiar `Props` (línea 23):

```ts
interface Props { plan: NutritionPlan; foods: Food[]; userId: string; initialFavorites: string[]; memberProfile: MemberProfileForTargets | null }
```

Y la firma del componente (línea 600):

```ts
export default function NutritionPlanEditor({ plan, foods, userId, initialFavorites, memberProfile }: Props) {
```

- [ ] **Paso 3: calcular los avisos, con datos en vivo**

Justo después de la línea existente `const totals = calcMacros(allItems)` (línea 699), agregar. Son **dos chequeos independientes**, no uno: uno compara el objetivo *guardado* del plan (`plan.target_calories`, escrito una sola vez al crear el plan) contra lo que la fórmula daría *hoy* con los datos actuales del socio — detecta objetivo desactualizado. El otro compara lo que suman las comidas cargadas contra ese mismo objetivo guardado — detecta que el plan de comidas no llega (o se pasa) del objetivo, sin importar si ese objetivo está o no desactualizado. Pueden dispararse los dos a la vez, por causas distintas, así que ninguno tapa al otro.

```ts
const liveMeals: Meal[] = meals.map(m => ({ ...m, nutrition_meal_items: mealItems[m.id] ?? [] }))
const planTotals = calcPlanMacros(liveMeals)
const nutritionTargets = memberProfile ? calcNutritionTargets(memberProfile, plan.goal) : null

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

Nota sobre `planTotals` vs el `totals` que ya existe en el archivo: usan exactamente los mismos datos en vivo (`mealItems`), así que dan el mismo número — la diferencia es que `planTotals` pasa explícitamente por `calcPlanMacros(liveMeals)`, como pediste, en vez de reusar `totals` (que llega al mismo resultado por `calcMacros(allItems)` directo). Dejo los dos porque `totals` ya se usa en el resto del render (CalorieRing, MacroRing, MacroBar) y tocar esas líneas está fuera de este cambio.

- [ ] **Paso 4: mostrar los avisos**

En el JSX, dentro de `return (<div className="flex flex-col gap-4">` (línea 793-794), justo antes del bloque `{/* ── Active badge + stats bar ───... */}` (línea 796), agregar:

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

- [ ] **Paso 5: verificación manual — seis casos**

`npm run dev` → abrir `/nutricion/[id]` de un plan activo:

1. Socio con peso/altura/fecha de nacimiento sin cambios desde que se creó el plan, y comidas cargadas dentro del 10% del objetivo del plan → sin avisos.
2. Cambiar el peso del socio en su ficha (Task 1) lo suficiente para que la fórmula de hoy se desvíe más de 10% del `target_calories` guardado → volver al editor del plan → aparece "El objetivo del plan (...) se calculó con datos anteriores...", sin tocar ninguna comida.
3. Con el peso sin cambios, editar las comidas del plan (agregar/sacar alimentos) hasta desviarse más de 10% del `target_calories` guardado → aparece "Las comidas suman (...) contra el objetivo de (...) del plan", **sin recargar la página** (confirma que usa `mealItems` en vivo, no el `meals` inicial).
4. Combinar 2 y 3 a la vez → confirmar que aparecen **los dos** avisos juntos, no que uno tapa al otro.
5. Abrir el plan de un socio al que le falta el peso (o la altura, o la fecha de nacimiento) → aparece "Faltan datos del socio para calcular el objetivo: peso." (o el campo que corresponda) en vez del aviso de objetivo desactualizado; el aviso de comidas-vs-objetivo puede seguir apareciendo si corresponde, ya que no depende del perfil.
6. Abrir un plan recién creado sin ninguna comida cargada → sin aviso de "comidas suman", aunque el objetivo esté calculado y desactualizado (ahí sí puede aparecer el aviso 1 si corresponde).

- [ ] **Paso 6: commit**

```bash
git add app/\(dashboard\)/nutricion/\[id\]/page.tsx components/nutrition/NutritionPlanEditor.tsx
git commit -m "feat: detectar desalineación entre plan de comidas y objetivo nutricional"
```

---

## Fuera de alcance

- No se toca `calcNutritionTargets` ni `calcPlanMacros`.
- No se persiste ningún recálculo — todo el Task 2 es derivado en cada render, no se escribe a `nutrition_plans`.
- No se agrega una acción de "recalcular objetivo" ni de "ajustar plan automáticamente".
