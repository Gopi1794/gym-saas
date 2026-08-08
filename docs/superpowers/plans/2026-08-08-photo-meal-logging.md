# Registro de comidas por foto vinculado al plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un miembro registra una comida por foto en el chat, vincularla automáticamente a la comida programada del plan más cercana en horario, sumarla siempre al total del día, guardar la foto de forma permanente, y avisar (in-app + chat) si el total del día cruza el objetivo de calorías del plan.

**Architecture:** Se extiende la tabla existente `quick_log_entries` (no se crea una tabla nueva) con `meal_id` y `photo_url`. El matcheo de horario es una función pura testeable. La foto se sube server-side (base64 → Storage) al confirmar, a un bucket nuevo `food-photos` (privado, RLS por dueño + lectura admin/trainer del mismo gym). Las alertas se calculan con una función compartida invocada desde los dos puntos de escritura existentes (foto y checkbox de comida planificada), y se deduplican vía el mecanismo `dedup_key` que la tabla `notifications` ya tiene.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage + RLS), Anthropic SDK (`@anthropic-ai/sdk`), Vitest para tests de funciones puras.

## Global Constraints

- No modificar el comportamiento de `nutrition_logs`/`nutrition_log_items` (comidas planificadas tildadas a mano) salvo agregar la llamada a la verificación de umbral al final de `logMealWithItems` — sin tocar su guardado.
- Todo cálculo de "hoy" o de hora del día usa `todayAR()`/`hourAR()` de `lib/date-ar.ts` — nunca `new Date().toISOString()` ni equivalentes en UTC.
- El bucket `food-photos` es privado — `photo_url` en `quick_log_entries` guarda un **path de Storage** (`{user_id}/{uuid}.jpg`), no una URL pública. Se resuelve a URL firmada recién al mostrarse.
- Ventana de matcheo horario: ≤ 3 horas de diferencia con `time_label` de la comida más cercana.
- Umbrales de alerta: se pasó si el total > 100% de `target_calories`; se quedó corto si, desde las 21:00 (`hourAR() >= 21`), el total < 70% de `target_calories`. Una sola notificación por umbral cruzado por día (vía `dedup_key`).
- Toda escritura nueva a Supabase debe llevar el filtro de `gym_id`/dueño correspondiente — no hay excepciones nuevas a esa regla del proyecto.

---

### Task 1: Migración — schema, bucket, tipo de notificación

**Files:**
- Create: `supabase/migrations/20260808_quick_log_meal_photo.sql`

**Interfaces:**
- Produces: columnas `quick_log_entries.meal_id` (uuid, nullable, FK a `nutrition_meals(id)` con `on delete set null`), `quick_log_entries.photo_url` (text, nullable); bucket `food-photos`; valor `'calorie_alert'` habilitado en `notifications_type_check`.

- [ ] **Step 1: Escribir la migración completa**

```sql
-- supabase/migrations/20260808_quick_log_meal_photo.sql

-- 1. quick_log_entries: vínculo opcional a la comida del plan + foto persistida
alter table quick_log_entries
  add column meal_id uuid references nutrition_meals(id) on delete set null,
  add column photo_url text;

-- 2. Bucket food-photos — privado (a diferencia de avatar/exercise-images).
-- Path: {user_id}/{uuid}.jpg
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Members manage their own food photos" on storage.objects;
create policy "Members manage their own food photos"
on storage.objects
for all
using (
  bucket_id = 'food-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'food-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Staff read food photos of their own gym" on storage.objects;
create policy "Staff read food photos of their own gym"
on storage.objects
for select
using (
  bucket_id = 'food-photos'
  and exists (
    select 1 from profiles caller
    join profiles owner on owner.gym_id = caller.gym_id
    where caller.id = auth.uid()
      and caller.role in ('admin', 'trainer')
      and owner.id::text = (storage.foldername(name))[1]
  )
);

-- 3. Nuevo tipo de notificación — mismo patron que 20260730_notifications_weight_drift_type.sql
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member',
  'check_in',
  'achievement',
  'plan_assigned',
  'membership_expiring',
  'churn_alert',
  'weight_drift',
  'calorie_alert'
));
```

- [ ] **Step 2: Avisar al usuario que hay que correr esta migración**

Este proyecto no corre migraciones automáticamente (ver CLAUDE.md del repo) — al terminar la implementación, avisar al usuario para que la corra en Supabase (SQL Editor o `supabase db push`, está linkeado).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260808_quick_log_meal_photo.sql
git commit -m "feat(nutricion): schema para fotos de comida vinculadas al plan"
```

---

### Task 2: Arreglar los 2 bugs de timezone UTC ya encontrados

**Files:**
- Modify: `app/actions/nutrition-tracking.ts:413`
- Modify: `app/api/chat/member/route.ts:86`

**Interfaces:**
- Consumes: `todayAR()` de `lib/date-ar.ts` (ya existe, ya probado en `app/(dashboard)/nutricion/page.tsx:34`).

- [ ] **Step 1: Arreglar `saveQuickLogEntry`**

En `app/actions/nutrition-tracking.ts`, agregar el import y cambiar la línea 413:

```ts
import { todayAR } from "@/lib/date-ar"
```

```ts
// antes: const today = new Date().toISOString().split("T")[0]
const today = todayAR()
```

- [ ] **Step 2: Arreglar el contexto nutricional del chat**

En `app/api/chat/member/route.ts`, agregar el import y cambiar la línea 86:

```ts
import { todayAR } from "@/lib/date-ar"
```

```ts
// antes: const today = new Date().toISOString().split("T")[0]
const today = todayAR()
```

- [ ] **Step 3: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/actions/nutrition-tracking.ts app/api/chat/member/route.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/nutrition-tracking.ts app/api/chat/member/route.ts
git commit -m "fix(nutricion): usar todayAR() en vez de UTC para registrar comidas por foto"
```

---

### Task 3: Función pura de matcheo de horario + tests

**Files:**
- Create: `lib/nutrition-photo-match.ts`
- Create: `lib/nutrition-photo-match.test.ts`

**Interfaces:**
- Consumes: nada externo (función pura).
- Produces: `matchMealByTime(photoDate: Date, meals: { id: string; name: string; time_label: string | null }[]): { id: string; name: string } | null` — usado por Task 8.

- [ ] **Step 1: Escribir los tests primero**

```ts
// lib/nutrition-photo-match.test.ts
import { describe, it, expect } from "vitest"
import { matchMealByTime } from "./nutrition-photo-match"

const meals = [
  { id: "1", name: "Desayuno", time_label: "08:00" },
  { id: "2", name: "Almuerzo", time_label: "13:00" },
  { id: "3", name: "Merienda", time_label: "17:00" },
  { id: "4", name: "Cena", time_label: "21:00" },
]

function atHour(h: number, m = 0) {
  const d = new Date(2026, 0, 1, h, m)
  return d
}

describe("matchMealByTime", () => {
  it("matchea la comida exacta cuando la hora coincide", () => {
    expect(matchMealByTime(atHour(13, 0), meals)?.id).toBe("2")
  })

  it("matchea la comida más cercana dentro de la ventana de 3 horas", () => {
    // 15:30 está a 2.5h de almuerzo (13:00) y 1.5h de merienda (17:00) -> merienda
    expect(matchMealByTime(atHour(15, 30), meals)?.id).toBe("3")
  })

  it("devuelve null si no hay ninguna comida dentro de 3 horas", () => {
    // 03:00 no está a menos de 3h de ninguna comida (la más cercana, desayuno 08:00, está a 5h)
    expect(matchMealByTime(atHour(3, 0), meals)).toBeNull()
  })

  it("devuelve null si la lista de comidas está vacía", () => {
    expect(matchMealByTime(atHour(13, 0), [])).toBeNull()
  })

  it("ignora comidas con time_label inválido o vacío sin romper el resto", () => {
    const withBad = [
      ...meals,
      { id: "5", name: "Sin horario", time_label: "" },
      { id: "6", name: "Horario roto", time_label: "no-es-una-hora" },
    ]
    expect(matchMealByTime(atHour(13, 0), withBad)?.id).toBe("2")
  })

  it("matchea justo en el límite de 3 horas (inclusive)", () => {
    // 10:00 está a exactamente 2h de desayuno (08:00) y 3h de almuerzo (13:00)
    expect(matchMealByTime(atHour(10, 0), meals)?.id).toBe("1")
  })

  it("devuelve null justo pasado el límite de 3 horas", () => {
    // 04:01 está a 3h59 de desayuno (08:00, la comida más cercana) — pasa el límite de 180 min por 59 min
    expect(matchMealByTime(atHour(4, 1), meals)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run lib/nutrition-photo-match.test.ts`
Expected: FAIL — `Cannot find module './nutrition-photo-match'`

- [ ] **Step 3: Implementar la función**

```ts
// lib/nutrition-photo-match.ts

const MAX_DIFFERENCE_MINUTES = 3 * 60

function parseTimeLabelToMinutes(timeLabel: string | null): number | null {
  if (!timeLabel) return null
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Encuentra la comida del plan cuyo time_label está más cerca de la hora del
 * timestamp dado, dentro de una ventana de 3 horas. Fuera de esa ventana (o
 * sin comidas, o time_label inválido en todas), devuelve null — el registro
 * queda como "extra" en vez de forzar un match lejano.
 *
 * Limitación conocida y aceptada: no hay wraparound de medianoche. Una foto
 * a las 00:15 se compara contra time_label en minutos-del-día (0-1439), no
 * contra la cena de las 21:00 del día anterior — para ese caso puntual
 * (comida tarde en la noche, ya pasada la medianoche) el registro queda
 * como "extra" en vez de matchear con la cena. Aceptable para esta versión.
 */
export function matchMealByTime<T extends { id: string; name: string; time_label: string | null }>(
  photoDate: Date,
  meals: T[]
): T | null {
  const photoMinutes = photoDate.getHours() * 60 + photoDate.getMinutes()

  let closest: T | null = null
  let closestDiff = Infinity

  for (const meal of meals) {
    const mealMinutes = parseTimeLabelToMinutes(meal.time_label)
    if (mealMinutes === null) continue

    const diff = Math.abs(mealMinutes - photoMinutes)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = meal
    }
  }

  if (closest === null || closestDiff > MAX_DIFFERENCE_MINUTES) return null
  return closest
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run lib/nutrition-photo-match.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/nutrition-photo-match.ts lib/nutrition-photo-match.test.ts
git commit -m "feat(nutricion): funcion de matcheo de foto por horario contra el plan"
```

---

### Task 4: Función compartida de totales del día + tests

**Files:**
- Create: `lib/nutrition-totals.ts`
- Create: `lib/nutrition-totals.test.ts`
- Modify: `app/api/chat/member/route.ts` (reemplazar el cálculo inline por esta función)

**Interfaces:**
- Consumes: los tipos `MealLog` (de `app/actions/nutrition-tracking.ts`) y `NutritionPlan`/`Meal` (de `app/actions/nutrition.ts`) — no se importan tipos nuevos, se reutilizan.
- Produces: `computeDailyTotals(plan: { nutrition_meals?: { id: string; nutrition_meal_items: { food_id: string; foods: { calories: number; protein: number; carbs: number; fat: number } }[] }[] } | null, mealLogs: { meal_id: string; items: { food_id: string; actual_grams: number }[] }[], quickTotals: { calories: number; protein: number; carbs: number; fat: number }): { calories: number; protein: number; carbs: number; fat: number }` — usado por Task 5 y por el chat route existente.

- [ ] **Step 1: Escribir los tests primero**

```ts
// lib/nutrition-totals.test.ts
import { describe, it, expect } from "vitest"
import { computeDailyTotals } from "./nutrition-totals"

const chicken = { calories: 165, protein: 31, carbs: 0, fat: 3.6 } // por 100g

const plan = {
  nutrition_meals: [
    {
      id: "meal-1",
      nutrition_meal_items: [
        { food_id: "food-1", foods: chicken },
      ],
    },
  ],
}

describe("computeDailyTotals", () => {
  it("suma las comidas planificadas tildadas según los gramos reales", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-1", actual_grams: 200 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(330) // 165 * 2
    expect(result.protein).toBe(62)   // 31 * 2
  })

  it("suma los quick logs (fotos) sobre las comidas planificadas", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-1", actual_grams: 100 }] }]
    const quickTotals = { calories: 300, protein: 20, carbs: 40, fat: 10 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(465) // 165 + 300
    expect(result.protein).toBe(51)   // 31 + 20
  })

  it("ignora logs de comidas que no existen en el plan actual", () => {
    const mealLogs = [{ meal_id: "meal-inexistente", items: [{ food_id: "food-1", actual_grams: 100 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(0)
  })

  it("ignora items que no existen en la comida del plan", () => {
    const mealLogs = [{ meal_id: "meal-1", items: [{ food_id: "food-inexistente", actual_grams: 100 }] }]
    const quickTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const result = computeDailyTotals(plan, mealLogs, quickTotals)
    expect(result.calories).toBe(0)
  })

  it("funciona sin plan activo — solo suma quick logs", () => {
    const quickTotals = { calories: 500, protein: 30, carbs: 50, fat: 15 }
    const result = computeDailyTotals(null, [], quickTotals)
    expect(result).toEqual(quickTotals)
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run lib/nutrition-totals.test.ts`
Expected: FAIL — `Cannot find module './nutrition-totals'`

- [ ] **Step 3: Implementar la función**

Extraída tal cual del cálculo que hoy vive inline en `app/api/chat/member/route.ts:97-113`, sin cambiar la lógica — solo movida a un módulo propio y testeable.

```ts
// lib/nutrition-totals.ts

type FoodMacros = { calories: number; protein: number; carbs: number; fat: number }
type MealItemRow = { food_id: string; foods: FoodMacros }
type PlanMeal = { id: string; nutrition_meal_items: MealItemRow[] }
type PlanForTotals = { nutrition_meals?: PlanMeal[] } | null

type MealLogRow = { meal_id: string; items: { food_id: string; actual_grams: number }[] }

/**
 * Total del día = comidas planificadas tildadas (gramos reales * macros por
 * 100g) + quick logs (fotos, ya vienen en valores absolutos). Usado tanto
 * para el contexto que se le pasa a Claude en el chat como para la
 * verificación de umbral de calorías.
 */
export function computeDailyTotals(
  plan: PlanForTotals,
  mealLogs: MealLogRow[],
  quickTotals: FoodMacros
): FoodMacros {
  let totalCal = quickTotals.calories
  let totalProt = quickTotals.protein
  let totalCarbs = quickTotals.carbs
  let totalFat = quickTotals.fat

  for (const log of mealLogs) {
    const meal = plan?.nutrition_meals?.find(m => m.id === log.meal_id)
    if (!meal) continue
    for (const logItem of log.items) {
      const mealItem = meal.nutrition_meal_items?.find(i => i.food_id === logItem.food_id)
      if (!mealItem?.foods) continue
      const f = mealItem.foods
      const r = logItem.actual_grams / 100
      totalCal += (f.calories ?? 0) * r
      totalProt += (f.protein ?? 0) * r
      totalCarbs += (f.carbs ?? 0) * r
      totalFat += (f.fat ?? 0) * r
    }
  }

  return { calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run lib/nutrition-totals.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Reemplazar el cálculo inline en el chat route por esta función**

En `app/api/chat/member/route.ts`, agregar el import:

```ts
import { computeDailyTotals } from "@/lib/nutrition-totals"
```

Reemplazar (dentro del bloque `if (agentId === "nutrition")`, donde hoy está el `for (const log of mealLogs) { ... }` de las líneas ~97-113) por:

```ts
      const { calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat } =
        computeDailyTotals(plan, mealLogs, quickTotals)
```

(Elimina el `let totalCal = ...` y el `for` que le seguía — el resto del bloque, desde `const round = ...` en adelante, queda exactamente igual, ya usa esas cuatro variables.)

- [ ] **Step 6: Verificar tsc/eslint y correr toda la suite**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd lib/nutrition-totals.ts app/api/chat/member/route.ts
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add lib/nutrition-totals.ts lib/nutrition-totals.test.ts app/api/chat/member/route.ts
git commit -m "refactor(nutricion): extraer calculo de totales del dia a funcion compartida y testeada"
```

---

### Task 5: `checkDailyCalorieThreshold` — verificación de umbral + notificación

**Files:**
- Modify: `app/actions/nutrition-tracking.ts`

**Interfaces:**
- Consumes: `getMemberNutritionPlan` (de `app/actions/nutrition.ts`), `getMealLogsForDate`, `getQuickLogTotalsForDate` (mismo archivo), `computeDailyTotals` (Task 4), `todayAR`/`hourAR` (`lib/date-ar.ts`), `createAdminClient` (`lib/supabase/admin`).
- Produces: `checkDailyCalorieThreshold(memberId: string, gymId: string | null): Promise<{ alertMessage: string | null }>` — usado por Task 6 y Task 7. El `alertMessage` es el texto a mostrar (Task 7/9 lo usan para el canal de chat; Task 6 lo ignora, no hay chat abierto en ese flujo).

**Nota de autorevisión**: el spec pide alerta por doble canal — notificación in-app Y mensaje del asistente en el chat. La notificación in-app se dispara acá adentro (insert en `notifications`), pero el "mensaje del asistente" no puede armarse acá: esta función corre en una server action, no en una respuesta de Claude. Por eso devuelve el texto en vez de solo `void` — quien la llama desde el flujo de chat (Task 7 → Task 9) es responsable de mostrarlo como si fuera un mensaje del asistente, sin volver a llamar a la IA.

- [ ] **Step 1: Implementar la función**

Agregar al final de `app/actions/nutrition-tracking.ts`:

```ts
import { hourAR } from "@/lib/date-ar"
import { computeDailyTotals } from "@/lib/nutrition-totals"
import { getMemberNutritionPlan } from "@/app/actions/nutrition"

const CALORIE_OVER_RATIO = 1.0
const CALORIE_UNDER_RATIO = 0.7
const CALORIE_UNDER_HOUR = 21

/**
 * Recalcula el total de calorías del día de un miembro y, si cruza el
 * objetivo de su plan activo, dispara una notificación (una sola vez por
 * umbral por día — dedup vía notifications.dedup_key). Se llama después de
 * CUALQUIER escritura que pueda cambiar el total del día: un quick log por
 * foto (Task 7) o una comida planificada tildada (Task 6).
 */
export async function checkDailyCalorieThreshold(
  memberId: string,
  gymId: string | null
): Promise<{ alertMessage: string | null }> {
  const plan = await getMemberNutritionPlan(memberId)
  if (!plan?.target_calories) return { alertMessage: null }

  const today = todayAR()
  const [mealLogs, quickTotals] = await Promise.all([
    getMealLogsForDate(memberId, today),
    getQuickLogTotalsForDate(memberId, today),
  ])
  const totals = computeDailyTotals(plan, mealLogs, quickTotals)
  const target = plan.target_calories

  let notif: { type: "over" | "under"; title: string; body: string } | null = null

  if (totals.calories > target * CALORIE_OVER_RATIO) {
    notif = {
      type: "over",
      title: "Te pasaste de tu objetivo de hoy",
      body: `Llevás ${Math.round(totals.calories)} kcal, ${Math.round(totals.calories - target)} kcal arriba de tu objetivo de ${target} kcal.`,
    }
  } else if (hourAR() >= CALORIE_UNDER_HOUR && totals.calories < target * CALORIE_UNDER_RATIO) {
    notif = {
      type: "under",
      title: "Te quedaste corto con las calorías de hoy",
      body: `Llevás ${Math.round(totals.calories)} kcal de tu objetivo de ${target} kcal — todavía estás a tiempo de sumar algo más.`,
    }
  }

  if (!notif) return { alertMessage: null }

  const admin = createAdminClient()
  const { error } = await admin.from("notifications" as never).insert({
    user_id: memberId,
    gym_id: gymId,
    type: "calorie_alert",
    title: notif.title,
    body: notif.body,
    metadata: { calorie_type: notif.type, total: Math.round(totals.calories), target },
    dedup_key: `calorie_alert:${notif.type}:${memberId}:${today}`,
  } as never)

  // 23505 = unique_violation en notifications_dedup_idx: ya se avisó hoy para
  // este umbral — no es un error real, pero tampoco hay que repetir el
  // mensaje en el chat (ya se mostró la primera vez que se cruzó).
  if (error) {
    if ((error as { code?: string }).code !== "23505") {
      console.error("[checkDailyCalorieThreshold] notification insert:", error)
    }
    return { alertMessage: null }
  }

  return { alertMessage: notif.body }
}
```

- [ ] **Step 2: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/actions/nutrition-tracking.ts
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/nutrition-tracking.ts
git commit -m "feat(nutricion): verificacion de umbral de calorias con notificacion deduplicada"
```

---

### Task 6: Enganchar la verificación en el tildado manual de comidas

**Files:**
- Modify: `app/actions/nutrition-tracking.ts` (funciones `logMealWithItems` líneas 63-94 y `removeMealLog` líneas 96-109)

**Interfaces:**
- Consumes: `checkDailyCalorieThreshold` (Task 5).

**Nota de autorevisión**: `nutrition_logs` tiene DOS puntos de escritura, no uno — `logMealWithItems` (tildar) y `removeMealLog` (destildar), función separada. La primera versión de esta tarea solo enganchaba la primera. Si alguien destilda una comida grande, eso puede llevarlo de "se pasó" a "normal" o de "normal" a "se quedó corto" — sin enganchar `removeMealLog` ese cambio nunca se verifica. Se enganchan las dos.

- [ ] **Step 1: Agregar la llamada al final de `logMealWithItems`, sin tocar el resto**

```ts
export async function logMealWithItems(
  mealId: string,
  date: string,
  items: { food_id: string; actual_grams: number }[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: log, error: logError } = await supabase
    .from("nutrition_logs" as never)
    .upsert(
      { member_id: user.id, meal_id: mealId, log_date: date } as never,
      { onConflict: "member_id,meal_id,log_date" }
    )
    .select("id")
    .single()

  if (logError || !log) throw new Error("Failed to save log")

  const logId = (log as { id: string }).id

  await supabase.from("nutrition_log_items" as never).delete().eq("log_id", logId)

  if (items.length > 0) {
    await supabase.from("nutrition_log_items" as never).insert(
      items.map(item => ({ log_id: logId, food_id: item.food_id, actual_grams: item.actual_grams } as never))
    )
  }

  // Nuevo: verificar umbral de calorías tras el cambio. No bloquea el
  // guardado si falla — es una notificación best-effort, no parte de la
  // transacción de logging. Se ignora el alertMessage de retorno a propósito:
  // este flujo es el checkbox de /nutricion, no hay chat abierto para
  // mostrarlo — acá el único canal es la notificación in-app que la función
  // ya dispara internamente.
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single()
  checkDailyCalorieThreshold(user.id, (profile as { gym_id: string | null } | null)?.gym_id ?? null)
    .catch(err => console.error("[logMealWithItems] threshold check:", err))

  revalidatePath("/nutricion")
}
```

Nota: la llamada NO se espera con `await` bloqueante antes del `revalidatePath` — es fire-and-forget con su propio `.catch`, igual que el patrón de `logChat` ya usado en `app/api/chat/trainer/route.ts`. Si la notificación falla, el tildado de la comida ya se guardó igual.

- [ ] **Step 2: Agregar la misma llamada al final de `removeMealLog`**

```ts
export async function removeMealLog(mealId: string, date: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("nutrition_logs" as never)
    .delete()
    .eq("member_id", user.id)
    .eq("meal_id", mealId)
    .eq("log_date", date)

  // Mismo motivo que en logMealWithItems: destildar una comida puede cambiar
  // si el día sigue "pasado" o pasa a estar "corto" — hay que reverificar.
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single()
  checkDailyCalorieThreshold(user.id, (profile as { gym_id: string | null } | null)?.gym_id ?? null)
    .catch(err => console.error("[removeMealLog] threshold check:", err))

  revalidatePath("/nutricion")
}
```

- [ ] **Step 3: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/actions/nutrition-tracking.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/nutrition-tracking.ts
git commit -m "feat(nutricion): verificar umbral de calorias al tildar y destildar comida planificada"
```

---

### Task 7: Extender `saveQuickLogEntry` — meal_id, foto, verificación de umbral

**Files:**
- Modify: `app/actions/nutrition-tracking.ts` (tipo `QuickLogEntry` y función `saveQuickLogEntry`, líneas 396-427)

**Interfaces:**
- Consumes: `checkDailyCalorieThreshold` (Task 5).
- Produces: `saveQuickLogEntry(entry: QuickLogEntry): Promise<{ alertMessage: string | null }>` — cambia de `Promise<void>` a devolver el resultado de la verificación de umbral, para que Task 9 pueda mostrarlo en el chat. Único caller existente es `MemberChat.tsx:handleSaveFoodLog` (Task 9) — no rompe otros consumidores.

- [ ] **Step 1: Extender el tipo y la función**

```ts
export type QuickLogEntry = {
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_at?: string
  meal_id?: string | null
  image_base64?: string
  image_media_type?: string
}

export async function saveQuickLogEntry(entry: QuickLogEntry): Promise<{ alertMessage: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles").select("gym_id").eq("id", user.id).single()
  const gymId = (profile as { gym_id: string | null } | null)?.gym_id ?? null

  const today = todayAR()

  let photoUrl: string | null = null
  if (entry.image_base64 && entry.image_media_type) {
    const ext = entry.image_media_type.split("/")[1] ?? "jpg"
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const bytes = Buffer.from(entry.image_base64, "base64")
    const { error: uploadError } = await supabase.storage
      .from("food-photos")
      .upload(path, bytes, { contentType: entry.image_media_type })

    // Un fallo de storage no debe bloquear el registro nutricional — se
    // guarda igual, sin foto.
    if (uploadError) {
      console.error("[saveQuickLogEntry] photo upload:", uploadError)
    } else {
      photoUrl = path
    }
  }

  await supabase.from("quick_log_entries" as never).insert({
    user_id: user.id,
    gym_id: gymId,
    description: entry.description,
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    logged_at: entry.logged_at ?? today,
    meal_id: entry.meal_id ?? null,
    photo_url: photoUrl,
  } as never)

  revalidatePath("/nutricion")

  // A diferencia de logMealWithItems (Task 6), acá SÍ se espera el resultado:
  // este guardado viene del chat, y el texto de alerta (si hay) se muestra
  // como si fuera un mensaje nuevo del asistente (Task 9) — no puede quedar
  // fire-and-forget porque el cliente lo necesita para renderizarlo.
  try {
    return await checkDailyCalorieThreshold(user.id, gymId)
  } catch (err) {
    console.error("[saveQuickLogEntry] threshold check:", err)
    return { alertMessage: null }
  }
}
```

- [ ] **Step 2: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/actions/nutrition-tracking.ts
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/nutrition-tracking.ts
git commit -m "feat(nutricion): saveQuickLogEntry acepta meal_id y sube la foto a Storage"
```

---

### Task 8: Chat route — matchear horario y devolver la sugerencia al cliente

**Files:**
- Modify: `app/api/chat/member/route.ts`

**Interfaces:**
- Consumes: `matchMealByTime` (Task 3).
- Produces: bloque `[MEAL_MATCH]{...}[/MEAL_MATCH]` agregado al final del stream cuando la respuesta incluye un `[FOOD_LOG]` — consumido por Task 9.

- [ ] **Step 1: Hoistear `plan` fuera del bloque condicional**

Hoy `const plan = await getMemberNutritionPlan(user.id)` vive dentro de `if (agentId === "nutrition") { ... }` (línea 87) y no es visible después. Cambiar a:

```ts
  // ── 5b. Contexto nutricional (solo si agente = nutrition) ───────────────────
  let nutritionContext = ""
  let plan: Awaited<ReturnType<typeof getMemberNutritionPlan>> = null
  if (agentId === "nutrition") {
    const today = todayAR()
    plan = await getMemberNutritionPlan(user.id)

    if (!plan) {
      nutritionContext = "\n\nESTADO NUTRICIONAL: El miembro no tiene plan nutricional asignado. El trainer puede crearle uno."
    } else {
```

(El resto del bloque queda igual — solo se saca el `const` de `plan` y se declara afuera con `let`.)

- [ ] **Step 2: Agregar el bloque de matcheo al final del stream, cuando hay FOOD_LOG**

Importar la función:

```ts
import { matchMealByTime } from "@/lib/nutrition-photo-match"
```

En el bloque `start(controller)` (líneas ~207-238), donde hoy se cierra el stream y se loguea `assistantContent`, agregar el matcheo ANTES de `controller.close()`:

```ts
  const readable = new ReadableStream({
    async start(controller) {
      let assistantContent = ""
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            assistantContent += event.delta.text
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }

        // Si la respuesta incluye un FOOD_LOG (foto de comida), matchear
        // contra el horario de las comidas del plan y mandar la sugerencia
        // como un bloque aparte, mismo protocolo de tags que ya usa FOOD_LOG.
        if (image && assistantContent.includes("[FOOD_LOG]") && plan?.nutrition_meals) {
          const matched = matchMealByTime(new Date(), plan.nutrition_meals)
          const matchBlock = `\n[MEAL_MATCH]${JSON.stringify({
            mealId: matched?.id ?? null,
            mealName: matched?.name ?? null,
          })}[/MEAL_MATCH]`
          assistantContent += matchBlock
          controller.enqueue(new TextEncoder().encode(matchBlock))
        }

        controller.close()
```

(El resto del bloque — el log fire-and-forget de `assistantContent` a `chat_logs` — queda igual, ahora incluye el `[MEAL_MATCH]` en lo logueado, lo cual está bien: es información real de lo que se le mostró al usuario.)

- [ ] **Step 3: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/api/chat/member/route.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/member/route.ts
git commit -m "feat(nutricion): matchear foto de comida con el horario del plan en el chat"
```

---

### Task 9: MemberChat.tsx — mostrar la sugerencia, subir la foto al confirmar

**Files:**
- Modify: `components/chat/MemberChat.tsx`

**Interfaces:**
- Consumes: `saveQuickLogEntry` con la firma nueva (Task 7). Parsea el protocolo `[MEAL_MATCH]` (Task 8).

- [ ] **Step 1: Extender tipos y agregar el parser del nuevo bloque**

```ts
type FoodLog = {
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

type MealMatch = {
  mealId: string | null
  mealName: string | null
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string
  imageData?: { data: string; mediaType: string }
  foodLog?: FoodLog
  mealMatch?: MealMatch
  foodLogSaved?: boolean
  linkedMealId?: string | null // permite al usuario desvincular antes de confirmar
}
```

Agregar junto a `parseFoodLog`/`stripFoodLog`:

```ts
function parseMealMatch(text: string): MealMatch | null {
  const match = text.match(/\[MEAL_MATCH\]([\s\S]*?)\[\/MEAL_MATCH\]/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as MealMatch
  } catch {
    return null
  }
}

function stripMealMatch(text: string): string {
  return text.replace(/\[MEAL_MATCH\][\s\S]*?\[\/MEAL_MATCH\]/, "").trim()
}
```

- [ ] **Step 2: Guardar los datos de la imagen en el mensaje del usuario**

En `sendMessage`, la imagen hoy se descarta apenas se arma el payload (`setPendingImage(null)` en la línea 142, sin guardar `imageToSend` en ningún lado persistente). Guardarla en el `userMsg`:

```ts
  async function sendMessage(text = input.trim()) {
    if ((!text && !pendingImage) || streaming) return

    const imageUrl = pendingImage?.previewUrl
    const imageData = pendingImage ? { data: pendingImage.data, mediaType: pendingImage.mediaType } : undefined
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "📷 Foto de comida",
      imageUrl,
      imageData,
    }
```

(El resto de `sendMessage` sigue igual — `imageToSend` se sigue armando y enviando al fetch como hoy, `imageData` en el mensaje es una copia para uso posterior al confirmar, no reemplaza nada del envío.)

- [ ] **Step 3: Parsear `[MEAL_MATCH]` junto con `[FOOD_LOG]` mientras llega el stream**

```ts
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const foodLog = parseFoodLog(accumulated)
        const mealMatch = parseMealMatch(accumulated)
        const displayContent = stripMealMatch(stripFoodLog(accumulated))
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId
            ? { ...m, content: displayContent, foodLog: foodLog ?? undefined, mealMatch: mealMatch ?? undefined, linkedMealId: mealMatch?.mealId ?? m.linkedMealId }
            : m)
        )
      }
```

- [ ] **Step 4: Mostrar la sugerencia en la card de confirmación, con opción de desvincular**

En la card de confirmación (líneas 317-355), agregar la línea de vinculación antes de los botones:

```tsx
                            {m.foodLog && (
                              <div className="rounded-2xl rounded-bl-sm border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
                                  {m.foodLog.description}
                                </p>
                                <div className="flex gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                                  <span className="font-bold">{m.foodLog.calories} kcal</span>
                                  <span className="text-emerald-600 dark:text-emerald-500">·</span>
                                  <span>{m.foodLog.protein}g prot</span>
                                  <span className="text-emerald-600 dark:text-emerald-500">·</span>
                                  <span>{m.foodLog.carbs}g carbs</span>
                                  <span className="text-emerald-600 dark:text-emerald-500">·</span>
                                  <span>{m.foodLog.fat}g grasas</span>
                                </div>
                                {!m.foodLogSaved && m.mealMatch?.mealName && (
                                  <label className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                                    <input
                                      type="checkbox"
                                      checked={m.linkedMealId != null}
                                      onChange={(e) => setMessages(prev => prev.map(msg =>
                                        msg.id === m.id ? { ...msg, linkedMealId: e.target.checked ? (m.mealMatch?.mealId ?? null) : null } : msg
                                      ))}
                                    />
                                    Sumar a tu {m.mealMatch.mealName}
                                  </label>
                                )}
                                {!m.foodLogSaved && !m.mealMatch?.mealName && (
                                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500/70">
                                    No coincide con ninguna comida programada — se suma como extra igual.
                                  </p>
                                )}
                                {m.foodLogSaved ? (
```

(El resto de la card — el `CheckCircle2`/botones "Registrar"/"Ignorar" — sigue exactamente igual, solo se le agregó el bloque de arriba antes del `{m.foodLogSaved ? (`.)

- [ ] **Step 5: Pasar meal_id e imagen al guardar**

```ts
  async function handleSaveFoodLog(msgId: string, foodLog: FoodLog) {
    const assistantMsg = messages.find(m => m.id === msgId)
    const msgIndex = messages.findIndex(m => m.id === msgId)
    const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : undefined

    try {
      const { alertMessage } = await saveQuickLogEntry({
        description: foodLog.description,
        calories: foodLog.calories,
        protein_g: foodLog.protein,
        carbs_g: foodLog.carbs,
        fat_g: foodLog.fat,
        meal_id: assistantMsg?.linkedMealId ?? null,
        image_base64: userMsg?.imageData?.data,
        image_media_type: userMsg?.imageData?.mediaType,
      })
      setMessages((prev) => {
        const withSaved = prev.map((m) => m.id === msgId ? { ...m, foodLogSaved: true } : m)
        // Canal 2 de la alerta (el canal 1, in-app, ya lo disparó el server
        // action): un mensaje del asistente sintético, sin volver a llamar a
        // Claude — el texto ya viene armado de checkDailyCalorieThreshold.
        if (!alertMessage) return withSaved
        return [...withSaved, { id: crypto.randomUUID(), role: "assistant" as const, content: alertMessage }]
      })
    } catch {
      // silently ignore — user can retry from nutrición page
    }
  }
```

- [ ] **Step 6: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd components/chat/MemberChat.tsx
```

- [ ] **Step 7: Prueba manual (no hay infra de test de componentes React en este proyecto — ver convención existente)**

Con el servidor corriendo (`npm run dev`), como miembro con un plan nutricional activo con al menos 2 comidas con `time_label`: sacar una foto dentro de la ventana de una comida → confirmar que la card muestra el checkbox "Sumar a tu [Comida]" tildado por default. Sacar otra foto fuera de cualquier ventana → confirmar que muestra "no coincide, se suma como extra igual" y no hay checkbox. Confirmar ambas y verificar en `/nutricion` que las dos suman al total del día.

- [ ] **Step 8: Commit**

```bash
git add components/chat/MemberChat.tsx
git commit -m "feat(nutricion): mostrar comida sugerida y subir foto al confirmar registro"
```

---

### Task 10: Mostrar la foto y la comida vinculada en `/nutricion`

**Files:**
- Modify: `app/actions/nutrition-tracking.ts` (`getQuickLogsForDate`, `QuickLogEntry` ya extendido en Task 7)
- Modify: `app/(dashboard)/nutricion/page.tsx` (query de quick logs)
- Modify: `components/nutrition/MemberNutritionView.tsx` (sección "Registrado por foto")

**Interfaces:**
- Consumes: `QuickLogEntry` extendido (Task 7), storage privado `food-photos` (Task 1).

- [ ] **Step 1: Traer `meal_id`/`photo_url` en `getQuickLogsForDate`**

```ts
export async function getQuickLogsForDate(userId: string, date: string): Promise<QuickLogEntry[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("quick_log_entries" as never)
    .select("description, calories, protein_g, carbs_g, fat_g, logged_at, meal_id, photo_url")
    .eq("user_id", userId)
    .eq("logged_at", date)
    .order("created_at", { ascending: false })

  return (data ?? []) as unknown as QuickLogEntry[]
}
```

- [ ] **Step 2: Resolver nombre de comida + URL firmada en la página**

En `app/(dashboard)/nutricion/page.tsx`, donde hoy se llama `getQuickLogsForDate(user!.id, today)`, agregar la resolución de nombre de comida (contra `plan.nutrition_meals`, ya cargado en esa página) y de URL firmada:

```ts
  const quickLogsRaw = await getQuickLogsForDate(user!.id, today)
  const supabase = createClient()
  const quickLogs = await Promise.all(quickLogsRaw.map(async (q) => {
    const meal = plan?.nutrition_meals?.find(m => m.id === q.meal_id)
    let photoSignedUrl: string | null = null
    if (q.photo_url) {
      const { data } = await supabase.storage.from("food-photos").createSignedUrl(q.photo_url, 3600)
      photoSignedUrl = data?.signedUrl ?? null
    }
    return { ...q, meal_name: meal?.name ?? null, photo_signed_url: photoSignedUrl }
  }))
```

(`plan` y `supabase`/`user` ya existen en esa página antes de este punto — confirmar el nombre exacto de la variable del plan al implementar, es la misma que se le pasa a `MemberNutritionView`.)

- [ ] **Step 3: Extender el tipo `QuickLogEntry` con los campos resueltos, y pasarlos a la vista**

**Ojo**: esto AGREGA campos al `QuickLogEntry` de Task 7, no lo reemplaza — si se pisa la declaración entera se pierden `image_base64`/`image_media_type` y se rompe la llamada de Task 9. El tipo final, completo, queda así:

```ts
export type QuickLogEntry = {
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_at?: string
  meal_id?: string | null
  image_base64?: string
  image_media_type?: string
  photo_url?: string | null
  meal_name?: string | null
  photo_signed_url?: string | null
}
```

- [ ] **Step 4: Mostrar miniatura + comida vinculada en `MemberNutritionView.tsx`**

```tsx
      {/* Quick logs (photo registrations) */}
      {quickLogs.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Registrado por foto
          </p>
          <div className="space-y-2">
            {quickLogs.map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                {q.photo_signed_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.photo_signed_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 capitalize truncate">{q.description}</p>
                  {q.meal_name && (
                    <p className="text-xs text-zinc-500">→ {q.meal_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{q.calories} kcal</span>
                  <span>{Math.round(Number(q.protein_g))}g prot</span>
                  <span className="hidden sm:inline">{Math.round(Number(q.carbs_g))}g carb</span>
                  <span className="hidden sm:inline">{Math.round(Number(q.fat_g))}g gras</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verificar tsc/eslint**

```bash
npx tsc --noEmit
./node_modules/.bin/eslint.cmd app/actions/nutrition-tracking.ts "app/(dashboard)/nutricion/page.tsx" components/nutrition/MemberNutritionView.tsx
```

- [ ] **Step 6: Prueba manual**

En `/nutricion`, confirmar que las entradas registradas por foto en la Task 9 muestran la miniatura y, si estaban vinculadas, la flecha con el nombre de la comida.

- [ ] **Step 7: Commit**

```bash
git add app/actions/nutrition-tracking.ts "app/(dashboard)/nutricion/page.tsx" components/nutrition/MemberNutritionView.tsx
git commit -m "feat(nutricion): mostrar foto y comida vinculada en el historial de /nutricion"
```

---

## Al terminar

Avisar al usuario que corra la migración `20260808_quick_log_meal_photo.sql` en Supabase antes de probar en producción (no se corre sola, ver Task 1 Step 2).
