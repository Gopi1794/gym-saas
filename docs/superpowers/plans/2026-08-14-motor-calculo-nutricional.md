# Motor de cálculo nutricional (Frente A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los supuestos rígidos/no verificados del motor de cálculo nutricional (`lib/nutrition.ts`) por un motor que usa actividad diaria real, nunca inventa un intercepto promedio para género "otro", deja proteína/déficit configurables por gym y por plan, y marca resultados fuera de rango para revisión del trainer — sin bloquear nunca el guardado.

**Architecture:** Cambios en capas: `lib/nutrition.ts` (funciones puras, testeadas con vitest) → migraciones SQL (columnas nuevas + tabla `gym_nutrition_defaults` + RPC `complete_workout_session` extendida) → `app/actions/nutrition.ts`/`app/actions/members.ts` (Server Actions que usan las funciones puras y persisten) → componentes UI que consumen esas Server Actions. Cada tarea es una capa o un grupo de archivos que cambian juntos.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-motor-calculo-nutricional-design.md`

## Global Constraints

- No bloquear nunca el guardado de un plan por límites de seguridad — `needs_review` se marca, pero el insert/update sigue.
- Todo cambio de esquema va en una migración versionada en `supabase/migrations/` con prefijo de fecha `20260814_...`.
- RLS: toda tabla nueva tiene RLS activo, policies con `TO authenticated` explícito y `(select auth.uid())` envuelto en subconsulta (nunca `auth.uid()` pelado).
- Funciones `SECURITY DEFINER` nuevas o modificadas: `SET search_path = ''` (o `= public`, según el patrón ya usado en la función que se toca) y grants explícitos — nunca dejar `EXECUTE` en `PUBLIC`.
- Un parámetro nuevo en una función Postgres existente (aunque tenga `DEFAULT`) cambia su firma — siempre `DROP FUNCTION` + `CREATE FUNCTION` + regrant, nunca solo `CREATE OR REPLACE` cuando se agrega un parámetro.
- Fuera de alcance (no crear tareas para esto): distinción crudo/cocido en alimentos, identidad de género completa y terapia hormonal, motor de seguimiento de tendencias (Frente B), bug de timezone en `getAdherenceStatus`/`relativeLogDate`.
- No usar `new Date().toISOString().split("T")[0]` en ningún código nuevo — no aplica en este plan porque no se toca ninguna fecha "de hoy" en el server (el único punto sensible, el bug ya existente de `lib/nutrition.ts`, está explícitamente fuera de alcance).

---

### Task 1: Motor de cálculo — migración de esquema + `lib/nutrition.ts`

**Files:**
- Create: `supabase/migrations/20260814_nutrition_calc_engine.sql`
- Modify: `lib/nutrition.ts`
- Modify: `lib/nutrition.test.ts`

**Interfaces:**
- Produces (usado por Task 2, 4, 5, 6, 7):
  - `type MemberProfile` (exportado desde `lib/nutrition.ts` — antes no lo estaba; se exporta para que `app/actions/nutrition.ts` y los componentes lo reusen en vez de redeclararlo).
  - `calcTmb(profile: Pick<MemberProfile, "weight_kg"|"height_cm"|"date_of_birth"|"gender"|"metabolic_reference">): number | null`
  - `calcNutritionTargets(profile: MemberProfile, goal: NutritionPlan["goal"], overrides?: { calorieAdjustmentPct?: number; proteinPerKg?: number }): { calories: number; protein: number; carbs: number; fat: number } | null`
  - `missingTargetFields(profile: { weight_kg: number | null; height_cm: number | null; date_of_birth: string | null; gender?: "male"|"female"|"other"|null; metabolic_reference?: "male"|"female"|null } | null): string[]`
  - `validateNutritionSafety(targets: { calories: number; protein: number }, tmb: number, calorieAdjustmentPct: number, proteinPerKg: number): { needsReview: boolean; reason: string | null }`
  - `defaultNutritionSettingsForGoal(goal: NutritionPlan["goal"]): { calorieAdjustmentPct: number; proteinPerKg: number; fatPerKg: number }`
  - `gymDefaultsForGoal(defaults: GymNutritionDefaults, goal: NutritionPlan["goal"]): { pct: number; protein: number }`
- Consumes: `type GymNutritionDefaults` (nuevo, se define en Task 4 dentro de `app/actions/nutrition.ts` — este task lo importa con `import type`, que no dispara la restricción de "use server". Hasta que Task 4 exista, este task deja `gymDefaultsForGoal` escrito contra un tipo que aún no existe en el árbol; el paso 6 de abajo lo resuelve declarando el tipo inline en este mismo archivo como solución temporal — ver nota en el Paso 6).

- [ ] **Paso 1: Migración de esquema**

```sql
-- supabase/migrations/20260814_nutrition_calc_engine.sql

-- profiles: actividad diaria (además de frecuencia) + referencia metabólica
-- explícita para cuando gender no es 'male'/'female' — nunca se infiere ni
-- se promedia, la elige el trainer (ver lib/nutrition.ts calcTmb).
alter table profiles
  add column if not exists daily_activity     text check (daily_activity in ('sedentary', 'moderate', 'active')),
  add column if not exists metabolic_reference text check (metabolic_reference in ('male', 'female'));

-- workout_sessions: duración real medida (no confundir con
-- workout_session_sets.duration_seconds, que es la duración de un set de
-- cardio individual — esta es la duración total de la sesión).
alter table workout_sessions
  add column if not exists duration_seconds integer;

-- nutrition_plans: valores realmente usados para calcular el plan (no una
-- referencia a gym_nutrition_defaults, que puede cambiar después) + estado
-- de revisión de seguridad.
alter table nutrition_plans
  add column if not exists calorie_adjustment_pct numeric(5,2),
  add column if not exists protein_per_kg          numeric(4,2),
  add column if not exists fat_per_kg              numeric(4,2),
  add column if not exists needs_review            boolean not null default false,
  add column if not exists needs_review_reason     text;

-- Defaults de proteína/ajuste calórico por objetivo, configurables por gym.
-- Una fila por gym, creada perezosamente (insert on conflict) la primera vez
-- que se pide — ver getGymNutritionDefaults en app/actions/nutrition.ts.
create table if not exists gym_nutrition_defaults (
  gym_id                    uuid primary key references gyms(id) on delete cascade,
  volumen_pct               numeric(5,2) not null default 12,
  volumen_protein           numeric(4,2) not null default 1.8,
  rendimiento_pct           numeric(5,2) not null default 8,
  rendimiento_protein       numeric(4,2) not null default 1.8,
  mantenimiento_protein     numeric(4,2) not null default 1.7,
  recomposicion_protein     numeric(4,2) not null default 2.0,
  perdida_moderada_pct      numeric(5,2) not null default -10,
  perdida_moderada_protein  numeric(4,2) not null default 2.0,
  definicion_pct            numeric(5,2) not null default -18,
  definicion_protein        numeric(4,2) not null default 2.2,
  updated_at                timestamptz not null default now()
);

alter table gym_nutrition_defaults enable row level security;

create policy "gym_nutrition_defaults_read" on gym_nutrition_defaults for select
  to authenticated
  using (gym_id in (select gym_id from profiles where id = (select auth.uid())));

create policy "gym_nutrition_defaults_write" on gym_nutrition_defaults for all
  to authenticated
  using (
    gym_id in (select gym_id from profiles where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    gym_id in (select gym_id from profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Nuevo tipo de notificación: "ya hay duración real suficiente para refinar
-- el plan nutricional de este socio" (se dispara desde complete_workout_session
-- en Task 2).
alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check check (type in (
    'new_member', 'check_in', 'achievement', 'plan_assigned',
    'membership_expiring', 'churn_alert', 'weight_drift', 'calorie_alert',
    'nutrition_duration_ready'
  ));
```

- [ ] **Paso 2: Correr la migración**

Run: aplicar la migración en el proyecto de Supabase (vía `mcp__supabase__apply_migration` o el dashboard — este proyecto no corre migraciones automáticamente en CI).
Expected: las 3 `alter table` y el `create table` corren sin error; `select * from gym_nutrition_defaults limit 1` devuelve 0 filas (tabla vacía, se puebla perezosamente).

- [ ] **Paso 3: Leer el archivo actual completo antes de editarlo**

`lib/nutrition.ts` tiene 176 líneas hoy. Leerlo entero antes de aplicar los cambios de abajo — los pasos siguientes dan el archivo resultante completo para las secciones que cambian, pero no repiten `calcMacros`, `calcPlanMacros`, `CALORIE_MISMATCH_THRESHOLD`, `NUTRITION_GOALS`, `NUTRITION_GOAL_OPTIONS`, `NUTRITION_GOAL_LABELS`, `getAdherenceStatus` ni `relativeLogDate`, que no cambian en este task.

- [ ] **Paso 4: Reemplazar el bloque de tipos e intercepto/actividad**

Reemplazar desde `type MemberProfile = {` hasta el cierre de `ACTIVITY_FACTOR` (líneas 27-41 del archivo actual) por:

```typescript
import type { MealItem, Meal, NutritionPlan, GymNutritionDefaults } from "@/app/actions/nutrition"

export type MemberProfile = {
  weight_kg:           number | null
  height_cm:           number | null
  date_of_birth:       string | null       // ISO date "YYYY-MM-DD"
  gender:              "male" | "female" | "other" | null
  training_frequency:  "never" | "1-2" | "3-4" | "5+" | null
  daily_activity:      "sedentary" | "moderate" | "active" | null
  metabolic_reference: "male" | "female" | null
  goal?:               string | null
}

// Actividad × frecuencia. La fila "moderate" es idéntica, valor por valor, a
// la tabla 1D que existía antes de este cambio — así un perfil sin
// daily_activity (cae a "moderate" más abajo) calcula exactamente lo mismo
// que calculaba antes.
const ACTIVITY_FACTOR: Record<string, Record<string, number>> = {
  sedentary: { never: 1.2, "1-2": 1.3,   "3-4": 1.45,  "5+": 1.6   },
  moderate:  { never: 1.2, "1-2": 1.375, "3-4": 1.55,  "5+": 1.725 },
  active:    { never: 1.3, "1-2": 1.45,  "3-4": 1.65,  "5+": 1.8   },
}
```

(La línea `import type { MealItem, Meal, NutritionPlan } from "@/app/actions/nutrition"` que ya existe en la línea 1 del archivo se reemplaza por esta — se le suma `GymNutritionDefaults` al import.)

- [ ] **Paso 5: Reemplazar `calcNutritionTargets` y agregar `calcTmb`**

Reemplazar desde `function ageFromDob` hasta el cierre de `calcNutritionTargets` (hasta la línea `}` que cierra la función, justo antes de `export const CALORIE_MISMATCH_THRESHOLD`) por:

```typescript
function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Metabolismo basal (Mifflin-St Jeor). Separado de calcNutritionTargets
// porque validateNutritionSafety necesita el TMB de forma independiente del
// resto del cálculo (para chequear que el objetivo final no quede por
// debajo de él).
export function calcTmb(
  profile: Pick<MemberProfile, "weight_kg" | "height_cm" | "date_of_birth" | "gender" | "metabolic_reference">
): number | null {
  const { weight_kg, height_cm, date_of_birth, gender, metabolic_reference } = profile
  if (!weight_kg || !height_cm || !date_of_birth) return null

  const age = ageFromDob(date_of_birth)
  if (age < 10 || age > 100) return null

  // gender 'male'/'female' manda siempre. Si no, hace falta que el trainer
  // haya elegido una referencia metabólica explícita — nunca se promedia
  // un intercepto (antes esto hacía "-78" para 'other', un promedio sin
  // base fisiológica).
  let intercept: number
  if (gender === "male") intercept = 5
  else if (gender === "female") intercept = -161
  else if (metabolic_reference === "male") intercept = 5
  else if (metabolic_reference === "female") intercept = -161
  else return null

  return 10 * weight_kg + 6.25 * height_cm - 5 * age + intercept
}

// Defaults de proteína/ajuste calórico/grasa por objetivo. Punto de partida
// configurable — gym_nutrition_defaults (por gym) y calcNutritionTargets's
// `overrides` (por plan) pueden reemplazar calorieAdjustmentPct/proteinPerKg;
// fatPerKg siempre sale de acá (no se expone como input, ver spec sección 4).
export function defaultNutritionSettingsForGoal(goal: NutritionPlan["goal"]): {
  calorieAdjustmentPct: number
  proteinPerKg: number
  fatPerKg: number
} {
  switch (goal) {
    case "volumen":          return { calorieAdjustmentPct: 12,  proteinPerKg: 1.8, fatPerKg: 1.0 }
    case "definicion":       return { calorieAdjustmentPct: -18, proteinPerKg: 2.2, fatPerKg: 0.8 }
    case "recomposicion":    return { calorieAdjustmentPct: 0,   proteinPerKg: 2.0, fatPerKg: 0.8 }
    case "rendimiento":      return { calorieAdjustmentPct: 8,   proteinPerKg: 1.8, fatPerKg: 1.0 }
    case "perdida_moderada": return { calorieAdjustmentPct: -10, proteinPerKg: 2.0, fatPerKg: 0.9 }
    case "mantenimiento":
    default:                 return { calorieAdjustmentPct: 0,   proteinPerKg: 1.7, fatPerKg: 0.9 }
  }
}

// Misma tabla que defaultNutritionSettingsForGoal, pero leída desde la
// configuración del gym (editable por el admin) en vez de los hardcodeados
// de arriba. Usada por la UI para precargar los inputs editables al crear
// un plan — ver NutritionPlansPanel.tsx (Task 6).
export function gymDefaultsForGoal(
  defaults: GymNutritionDefaults,
  goal: NutritionPlan["goal"]
): { pct: number; protein: number } {
  switch (goal) {
    case "volumen":          return { pct: defaults.volumen_pct,          protein: defaults.volumen_protein }
    case "rendimiento":      return { pct: defaults.rendimiento_pct,      protein: defaults.rendimiento_protein }
    case "recomposicion":    return { pct: 0,                             protein: defaults.recomposicion_protein }
    case "perdida_moderada": return { pct: defaults.perdida_moderada_pct, protein: defaults.perdida_moderada_protein }
    case "definicion":       return { pct: defaults.definicion_pct,       protein: defaults.definicion_protein }
    case "mantenimiento":
    default:                 return { pct: 0,                             protein: defaults.mantenimiento_protein }
  }
}

export function calcNutritionTargets(
  profile: MemberProfile,
  goal: NutritionPlan["goal"],
  overrides?: { calorieAdjustmentPct?: number; proteinPerKg?: number }
): { calories: number; protein: number; carbs: number; fat: number } | null {
  const tmb = calcTmb(profile)
  if (tmb == null) return null

  const activityRow = ACTIVITY_FACTOR[profile.daily_activity ?? "moderate"] ?? ACTIVITY_FACTOR.moderate
  const factor = activityRow[profile.training_frequency ?? "3-4"] ?? activityRow["3-4"]
  const tdee = Math.round(tmb * factor)

  const defaults = defaultNutritionSettingsForGoal(goal)
  const calorieAdjustmentPct = overrides?.calorieAdjustmentPct ?? defaults.calorieAdjustmentPct
  const proteinPerKg = overrides?.proteinPerKg ?? defaults.proteinPerKg
  const fatPerKg = defaults.fatPerKg

  const targetCalories = Math.round(tdee * (1 + calorieAdjustmentPct / 100))
  const weightKg = profile.weight_kg as number // calcTmb ya validó que no es null/0
  const protein = Math.round(proteinPerKg * weightKg)
  const fat     = Math.round(fatPerKg * weightKg)
  // Remaining calories go to carbs (1g protein = 4 kcal, 1g fat = 9 kcal, 1g carbs = 4 kcal)
  const carbsKcal = targetCalories - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(carbsKcal / 4))

  return { calories: targetCalories, protein, carbs, fat }
}

// Límites de seguridad no bloqueantes — ver spec sección 5. No impide
// guardar el plan; solo marca needs_review para que el trainer lo revise.
export function validateNutritionSafety(
  targets: { calories: number; protein: number },
  tmb: number,
  calorieAdjustmentPct: number,
  proteinPerKg: number
): { needsReview: boolean; reason: string | null } {
  const reasons: string[] = []
  if (targets.calories < tmb) reasons.push("El objetivo calórico queda por debajo del metabolismo basal (TMB).")
  if (targets.calories < 1200) reasons.push("El objetivo calórico queda por debajo de 1200 kcal.")
  if (calorieAdjustmentPct < -25) reasons.push("El déficit supera el 25%.")
  if (calorieAdjustmentPct > 20) reasons.push("El superávit supera el 20%.")
  if (proteinPerKg < 1.2) reasons.push("La proteína queda por debajo de 1.2 g/kg.")
  if (proteinPerKg > 3.0) reasons.push("La proteína supera 3.0 g/kg.")
  return { needsReview: reasons.length > 0, reason: reasons.length > 0 ? reasons.join(" ") : null }
}
```

- [ ] **Paso 6: Nota sobre `GymNutritionDefaults` (dependencia circular con Task 4)**

El `import type { ..., GymNutritionDefaults } from "@/app/actions/nutrition"` del Paso 4 apunta a un tipo que Task 4 todavía no creó. TypeScript no falla en tiempo de escritura de este archivo por un tipo inexistente en otro módulo del mismo proyecto — falla recién al compilar/typecheck el proyecto completo. Como este plan se ejecuta task por task y cada task corre sus propios tests (no un typecheck de proyecto completo), esto no bloquea el Paso 7 de abajo (los tests de este archivo no importan `GymNutritionDefaults` ni ejercitan `gymDefaultsForGoal`). Task 4 crea el tipo `GymNutritionDefaults` en `app/actions/nutrition.ts` como su primer paso, cerrando la dependencia. Si se corre `npm run build` o `tsc` entre Task 1 y Task 4, va a fallar por este tipo faltante — es esperado, no un bug de este task.

- [ ] **Paso 7: Reemplazar `missingTargetFields`**

Reemplazar la función completa por:

```typescript
export function missingTargetFields(
  profile: {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender?: "male" | "female" | "other" | null
    metabolic_reference?: "male" | "female" | null
  } | null
): string[] {
  const needsMetabolicReference =
    profile != null &&
    profile.gender !== "male" &&
    profile.gender !== "female" &&
    !profile.metabolic_reference

  return [
    !profile?.weight_kg && "peso",
    !profile?.height_cm && "altura",
    !profile?.date_of_birth && "fecha de nacimiento",
    needsMetabolicReference && "referencia metabólica",
  ].filter(Boolean) as string[]
}
```

- [ ] **Paso 8: Correr los tests existentes para confirmar que rompió lo esperado**

Run: `npx vitest run lib/nutrition.test.ts`
Expected: FAIL — un solo test roto: `missingTargetFields > con el perfil completo, no falta nada` (esperaba `[]`, ahora devuelve `["referencia metabólica"]` porque el fixture de ese test no incluye `gender`). El resto de los tests existentes (`calcMacros`, otros casos de `missingTargetFields`, todo `calcNutritionTargets`) siguen en PASS — confirmá que ninguno de esos rompió antes de seguir.

- [ ] **Paso 9: Arreglar el test roto y agregar los tests nuevos**

En `lib/nutrition.test.ts`, reemplazar el import (línea 3) por:

```typescript
import { calcMacros, calcNutritionTargets, missingTargetFields, validateNutritionSafety } from "./nutrition"
```

Reemplazar el test `"con el perfil completo, no falta nada"` (dentro de `describe("missingTargetFields", ...)`) por:

```typescript
  it("con el perfil completo, no falta nada", () => {
    // gender: "male" es necesario acá — sin él, la nueva regla de
    // referencia metabólica (ver abajo) lo marcaría como faltante.
    expect(missingTargetFields({ weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01", gender: "male" })).toEqual([])
  })
```

Reemplazar el test `"con un solo campo faltante, devuelve solo ese campo"` por:

```typescript
  it("con un solo campo faltante, devuelve solo ese campo", () => {
    expect(missingTargetFields({ weight_kg: null, height_cm: 180, date_of_birth: "1990-01-01", gender: "male" })).toEqual(["peso"])
  })
```

Agregar, dentro del mismo `describe("missingTargetFields", ...)`, después del último `it` existente:

```typescript
  it("con género 'other' y sin referencia metabólica elegida, falta la referencia", () => {
    expect(missingTargetFields({
      weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01", gender: "other", metabolic_reference: null,
    })).toEqual(["referencia metabólica"])
  })

  it("con género 'other' pero con referencia metabólica ya elegida, no falta nada", () => {
    expect(missingTargetFields({
      weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01", gender: "other", metabolic_reference: "female",
    })).toEqual([])
  })

  it("sin género (null) y sin referencia metabólica, falta la referencia", () => {
    expect(missingTargetFields({
      weight_kg: 80, height_cm: 180, date_of_birth: "1990-01-01", gender: null, metabolic_reference: null,
    })).toEqual(["referencia metabólica"])
  })
```

Agregar, dentro de `describe("calcNutritionTargets", ...)` (después del último `it`/`it.each` existente, todavía bajo el mismo `beforeEach`/`afterEach` de reloj congelado y el mismo `baseProfile`):

```typescript
  it("con género 'other' y sin referencia metabólica, devuelve null", () => {
    expect(calcNutritionTargets({ ...baseProfile, gender: "other", metabolic_reference: null }, "mantenimiento")).toBeNull()
  })

  it("con género 'other' y referencia metabólica 'male', usa el mismo intercepto que género 'male'", () => {
    const conOther = calcNutritionTargets({ ...baseProfile, gender: "other", metabolic_reference: "male" }, "mantenimiento")
    const conMale  = calcNutritionTargets({ ...baseProfile, gender: "male" }, "mantenimiento")
    expect(conOther).toEqual(conMale)
  })

  it("con género null y referencia metabólica 'female', usa el intercepto femenino", () => {
    const conNullFemale = calcNutritionTargets({ ...baseProfile, gender: null, metabolic_reference: "female" }, "mantenimiento")
    const conFemale     = calcNutritionTargets({ ...baseProfile, gender: "female" }, "mantenimiento")
    expect(conNullFemale).toEqual(conFemale)
  })

  it("actividad diaria 'sedentary' da menos calorías que 'active' para la misma frecuencia de entreno", () => {
    const sedentary = calcNutritionTargets({ ...baseProfile, daily_activity: "sedentary" }, "mantenimiento")
    const active    = calcNutritionTargets({ ...baseProfile, daily_activity: "active" }, "mantenimiento")
    expect(sedentary!.calories).toBeLessThan(active!.calories)
  })

  it("sin daily_activity, cae a 'moderate' — mismo resultado que con daily_activity explícito en 'moderate'", () => {
    const sinDato = calcNutritionTargets(baseProfile, "mantenimiento")
    const conModerate = calcNutritionTargets({ ...baseProfile, daily_activity: "moderate" }, "mantenimiento")
    expect(sinDato).toEqual(conModerate)
  })

  it("overrides.calorieAdjustmentPct y proteinPerKg reemplazan los defaults del objetivo", () => {
    const conDefaults = calcNutritionTargets(baseProfile, "definicion")
    const conOverride = calcNutritionTargets(baseProfile, "definicion", { calorieAdjustmentPct: -5, proteinPerKg: 1.5 })
    expect(conOverride!.calories).toBeGreaterThan(conDefaults!.calories) // -5% es menos agresivo que -18%
    expect(conOverride!.protein).toBeLessThan(conDefaults!.protein)     // 1.5 g/kg < 2.2 g/kg
  })
```

Agregar un nuevo `describe` al final del archivo (después del `describe("calcNutritionTargets", ...)`, fuera de él):

```typescript
describe("validateNutritionSafety", () => {
  it("con valores dentro de rango, no marca revisión", () => {
    expect(validateNutritionSafety({ calories: 2200, protein: 140 }, 1700, -10, 2.0))
      .toEqual({ needsReview: false, reason: null })
  })

  it("calorías por debajo del TMB, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 1600, protein: 140 }, 1700, -10, 2.0)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("metabolismo basal")
  })

  it("calorías por debajo de 1200, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 1100, protein: 100 }, 900, -10, 2.0)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("1200 kcal")
  })

  it("déficit más agresivo que -25%, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 2000, protein: 140 }, 1500, -30, 2.0)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("25%")
  })

  it("superávit mayor a +20%, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 3000, protein: 140 }, 2000, 25, 2.0)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("20%")
  })

  it("proteína por debajo de 1.2 g/kg, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 2200, protein: 80 }, 1700, -10, 1.0)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("1.2 g/kg")
  })

  it("proteína por encima de 3.0 g/kg, marca revisión", () => {
    const result = validateNutritionSafety({ calories: 2200, protein: 250 }, 1700, -10, 3.5)
    expect(result.needsReview).toBe(true)
    expect(result.reason).toContain("3.0 g/kg")
  })
})
```

- [ ] **Paso 10: Correr los tests de nuevo**

Run: `npx vitest run lib/nutrition.test.ts`
Expected: PASS — todos los tests, incluidos los nuevos.

- [ ] **Paso 11: Commit**

```bash
git add supabase/migrations/20260814_nutrition_calc_engine.sql lib/nutrition.ts lib/nutrition.test.ts
git commit -m "feat(nutricion): motor de calculo con actividad diaria, referencia metabolica y limites de seguridad"
```

---

### Task 2: RPC `complete_workout_session` — captura de duración real + alerta

**Files:**
- Create: `supabase/migrations/20260814_workout_session_duration.sql`

**Interfaces:**
- Consumes: columna `workout_sessions.duration_seconds` (Task 1), constraint `notifications_type_check` con `'nutrition_duration_ready'` (Task 1).
- Produces: RPC `complete_workout_session` acepta un 7º parámetro `p_duration_seconds integer default null` — Task 3 lo consume desde `app/actions/workout-sessions.ts`.

- [ ] **Paso 1: Migración — drop + recreate de la RPC con el parámetro nuevo**

```sql
-- supabase/migrations/20260814_workout_session_duration.sql
-- Un parametro nuevo cambia la firma de la funcion (aunque tenga default) --
-- hay que dropear la version vieja antes de recrearla, o Postgres deja las
-- dos como overloads separados. Se reaplican los grants porque DROP
-- FUNCTION los borra junto con la funcion.

drop function if exists public.complete_workout_session(uuid, integer, text, integer, integer, jsonb);

create or replace function public.complete_workout_session(
  p_plan_id uuid,
  p_day_of_week integer,
  p_day_name text,
  p_exercises_count integer,
  p_rest_skips integer,
  p_sets jsonb default '[]'::jsonb,
  p_duration_seconds integer default null
)
 returns table(session_id uuid, xp_earned integer, new_total_xp integer, earned_achievements jsonb)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id    uuid    := auth.uid();
  v_gym_id     uuid;
  v_session_id uuid;
  v_quality    numeric;
  v_xp         integer;
  v_total_xp   integer;
  v_rest_skips integer := greatest(coalesce(p_rest_skips, 0), 0);
  v_earned     jsonb;
  v_duration_count integer;
begin
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.profiles WHERE id = v_user_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'user has no gym_id';
  END IF;

  -- El plan tiene que estar asignado al usuario que llama. Esto además bloquea
  -- templates (assigned_to null) y planes de otros socios.
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE id = p_plan_id AND assigned_to = v_user_id
  ) THEN
    RAISE EXCEPTION 'plan does not belong to the authenticated user';
  END IF;

  -- No permitir completar el mismo plan/día más de una vez el mismo día calendario.
  IF EXISTS (
    SELECT 1 FROM public.workout_sessions
    WHERE user_id = v_user_id
      AND plan_id = p_plan_id
      AND day_of_week = p_day_of_week
      AND (completed_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
  ) THEN
    RAISE EXCEPTION 'workout already completed today for this plan/day';
  END IF;

  v_quality := greatest(0.5, 1.0 - v_rest_skips * 0.15);
  v_xp      := round(100 * v_quality);

  INSERT INTO public.workout_sessions (
    user_id, gym_id, plan_id, day_of_week, day_name,
    exercises_count, rest_skips, xp_earned, duration_seconds
  ) VALUES (
    v_user_id, v_gym_id, p_plan_id, p_day_of_week, p_day_name,
    coalesce(p_exercises_count, 0), v_rest_skips, v_xp, p_duration_seconds
  )
  RETURNING id INTO v_session_id;

  IF jsonb_array_length(coalesce(p_sets, '[]')) > 0 THEN
    INSERT INTO public.workout_session_sets (
      session_id, exercise_id, exercise_name, category,
      set_number, reps, actual_reps, planned_reps, weight_kg, duration_seconds,
      distance_meters, speed_kmh, resistance_level, calories_burned
    )
    SELECT
      v_session_id,
      nullif((s->>'exercise_id'), '')::uuid,
      s->>'exercise_name',
      s->>'category',
      (s->>'set_number')::integer,
      -- reps = actual (used for volume calc)
      nullif(s->>'actual_reps', '')::integer,
      nullif(s->>'actual_reps', '')::integer,
      nullif(s->>'planned_reps', '')::integer,
      nullif(s->>'weight_kg', '')::numeric,
      nullif(s->>'duration_seconds', '')::integer,
      nullif(s->>'distance_meters', '')::integer,
      nullif(s->>'speed_kmh', '')::numeric,
      nullif(s->>'resistance_level', '')::smallint,
      nullif(s->>'calories_burned', '')::smallint
    FROM jsonb_array_elements(p_sets) AS s;
  END IF;

  -- Duración real: si esta sesión llega a la octava con duration_seconds
  -- registrado en las últimas 4 semanas, avisar a quien corresponda que ya
  -- hay dato suficiente para refinar el cálculo nutricional de este socio.
  -- No dispara ningún recálculo — solo deja la alerta (ver spec sección 2).
  IF p_duration_seconds IS NOT NULL THEN
    SELECT count(*) INTO v_duration_count
    FROM public.workout_sessions
    WHERE user_id = v_user_id
      AND duration_seconds IS NOT NULL
      AND completed_at >= (now() AT TIME ZONE 'UTC') - INTERVAL '28 days';

    IF v_duration_count = 8 THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata, dedup_key, gym_id)
      SELECT
        recipient.id,
        'nutrition_duration_ready',
        'Duración real de entrenamiento disponible',
        coalesce(m.full_name, 'Un socio') || ' ya completó suficientes entrenamientos con duración registrada para refinar su plan nutricional',
        jsonb_build_object('member_id', v_user_id, 'sessions_count', v_duration_count),
        'nutrition-duration-ready:' || recipient.id::text || ':member:' || v_user_id::text,
        v_gym_id
      FROM public.profiles m
      JOIN public.profiles recipient
        ON recipient.gym_id = m.gym_id
       AND (
         (m.trainer_id IS NOT NULL AND recipient.id = m.trainer_id)
         OR (m.trainer_id IS NULL AND recipient.role = 'admin')
       )
      WHERE m.id = v_user_id
      ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  UPDATE public.profiles
    SET total_xp = total_xp + v_xp
    WHERE id = v_user_id
    RETURNING total_xp INTO v_total_xp;

  WITH
    metrics AS (
      SELECT
        (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = v_user_id) AS total_sessions,
        v_total_xp AS total_xp,
        (SELECT count(*)::int FROM public.workout_sessions
          WHERE user_id = v_user_id
            AND date_trunc('week', completed_at AT TIME ZONE 'UTC')
                = date_trunc('week', now() AT TIME ZONE 'UTC')) AS sessions_week,
        (SELECT count(*)::int FROM (
          SELECT d, row_number() OVER (ORDER BY d DESC) - 1 AS expected_offset
          FROM (
            SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
            FROM public.workout_sessions
            WHERE user_id = v_user_id
              AND completed_at >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '365 days'
          ) all_dates
        ) ranked
        WHERE d = (now() AT TIME ZONE 'UTC')::date - (expected_offset * INTERVAL '1 day')) AS streak_days,
        (SELECT coalesce(sum(wss.weight_kg * wss.reps), 0)
          FROM public.workout_session_sets wss
          JOIN public.workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.weight_kg IS NOT NULL
            AND wss.reps IS NOT NULL) AS total_volume_kg,
        (SELECT coalesce(sum(wss.duration_seconds), 0) / 60.0
          FROM public.workout_session_sets wss
          JOIN public.workout_sessions ws ON ws.id = wss.session_id
          WHERE ws.user_id = v_user_id
            AND wss.category = 'cardio'
            AND wss.duration_seconds IS NOT NULL) AS total_cardio_minutes
    ),
    candidates AS (
      SELECT a.*
        FROM public.achievements a
        CROSS JOIN metrics m
        WHERE a.gym_id = v_gym_id
          AND (
            (a.condition_type = 'total_sessions'       AND m.total_sessions      >= a.condition_value) OR
            (a.condition_type = 'total_xp'             AND m.total_xp            >= a.condition_value) OR
            (a.condition_type = 'sessions_week'        AND m.sessions_week       >= a.condition_value) OR
            (a.condition_type = 'streak_days'          AND m.streak_days         >= a.condition_value) OR
            (a.condition_type = 'total_volume_kg'      AND m.total_volume_kg     >= a.condition_value) OR
            (a.condition_type = 'total_cardio_minutes' AND m.total_cardio_minutes >= a.condition_value) OR
            (a.condition_type = 'sessions_category'    AND a.condition_target IS NOT NULL AND (
              SELECT count(DISTINCT ws2.id)::int
              FROM public.workout_sessions ws2
              JOIN public.workout_session_sets wss2 ON wss2.session_id = ws2.id
              WHERE ws2.user_id = v_user_id
                AND wss2.category = a.condition_target
            ) >= a.condition_value)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.user_achievements ua
            WHERE ua.user_id = v_user_id AND ua.achievement_id = a.id
          )
    ),
    inserted AS (
      INSERT INTO public.user_achievements (user_id, achievement_id)
      SELECT v_user_id, c.id FROM candidates c
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id, earned_at
    )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          a.id,
        'name',        a.name,
        'description', a.description,
        'icon',        a.icon,
        'xp_reward',   a.xp_reward,
        'earned_at',   i.earned_at
      ) ORDER BY a.name
    ),
    '[]'::jsonb
  )
  INTO v_earned
  FROM inserted i
  JOIN public.achievements a ON a.id = i.achievement_id;

  RETURN QUERY SELECT v_session_id, v_xp, v_total_xp, v_earned;
END;
$function$;

revoke execute on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb, integer) from public, anon;
grant execute on function public.complete_workout_session(uuid, integer, text, integer, integer, jsonb, integer) to authenticated, service_role;
```

- [ ] **Paso 2: Aplicar la migración**

Run: aplicar en el proyecto de Supabase.
Expected: sin error. Confirmar que el 6º parámetro (`p_sets`) y el 7º (`p_duration_seconds`) tienen `DEFAULT` — una llamada existente que solo mande los primeros 5 args (o los 6 de siempre, sin `p_duration_seconds`) sigue funcionando sin cambios hasta que Task 3 la actualice.

- [ ] **Paso 3: Verificación manual**

No hay infraestructura de test de funciones SQL en este proyecto — se verifica a mano con `mcp__supabase__execute_sql` (o el SQL editor del dashboard):

1. Confirmar que la función tiene 7 parámetros: `select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'complete_workout_session';` — debe listar `p_duration_seconds integer` al final.
2. Confirmar los grants: `select proacl from pg_proc where proname = 'complete_workout_session';` — debe incluir `authenticated=X` y `service_role=X`, sin `anon` ni `PUBLIC`.
3. Confirmar el constraint: `select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_type_check';` — debe incluir `'nutrition_duration_ready'`.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/20260814_workout_session_duration.sql
git commit -m "feat(entrenamiento): RPC complete_workout_session captura duracion real y avisa cuando hay dato suficiente"
```

---

### Task 3: Captura de duración real en el cliente

**Files:**
- Modify: `app/actions/workout-sessions.ts`
- Modify: `components/planes/WorkoutSession.tsx`

**Interfaces:**
- Consumes: RPC `complete_workout_session` con 7º parámetro `p_duration_seconds` (Task 2).
- Produces: ninguna otra tarea depende de esto.

- [ ] **Paso 1: Extender `CompleteSessionInput` y la llamada a la RPC**

En `app/actions/workout-sessions.ts`, reemplazar el tipo `CompleteSessionInput` (líneas 7-16) por:

```typescript
export type CompleteSessionInput = {
  plan_id: string
  /** ISO day index: 0 = Monday … 6 = Sunday */
  day_of_week: number
  day_name: string
  exercises_count: number
  /** Must be >= 0. The server coerces NULL to 0 in the RPC, but we validate here too. */
  rest_skips: number
  sets?: SessionSet[]
  /** Segundos reales transcurridos desde que se abrió la sesión hasta completarla. */
  duration_seconds?: number
}
```

Reemplazar el bloque de la llamada a la RPC (líneas 47-56) por:

```typescript
  // RPC call — note: user_id is intentionally absent; auth comes from cookies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("complete_workout_session", {
    p_plan_id: input.plan_id,
    p_day_of_week: input.day_of_week,
    p_day_name: input.day_name,
    p_exercises_count: input.exercises_count,
    p_rest_skips: input.rest_skips,
    p_sets: input.sets ?? [],
    p_duration_seconds: input.duration_seconds ?? null,
  })
```

- [ ] **Paso 2: Capturar el timestamp de inicio en `WorkoutSession.tsx`**

En `components/planes/WorkoutSession.tsx`, agregar un ref junto a los que ya existen (línea 213-214, `savedRef`/`submittingSetRef`):

```typescript
  const savedRef = useRef(false);
  const submittingSetRef = useRef(false);
  // Se inicializa una sola vez, al primer render — Date.now() en el
  // inicializador de useRef no se vuelve a evaluar en renders posteriores.
  const sessionStartedAtRef = useRef(Date.now());
```

- [ ] **Paso 3: Mandar la duración real al completar**

Reemplazar el bloque `finish()` (líneas 294-306) por:

```typescript
    async function finish() {
      setCompleting(true);
      const durationSeconds = Math.round((Date.now() - sessionStartedAtRef.current) / 1000);
      const result = await completeWorkoutSession({
        plan_id: planId,
        day_of_week: dayOfWeek,
        day_name: dayName,
        exercises_count: sortedExercises.length,
        rest_skips: restSkips,
        sets: collectedSets,
        duration_seconds: durationSeconds,
      });
      setSessionResult(result);
      setCompleting(false);
    }
```

- [ ] **Paso 4: Verificación manual**

No hay tests automatizados de `WorkoutSession.tsx` en este proyecto — se verifica a mano:

1. Levantar el server local (`npm run dev`), loguearse como un socio con un plan asignado.
2. Completar un entrenamiento entero (todos los ejercicios/sets).
3. Correr `select id, completed_at, duration_seconds from workout_sessions order by completed_at desc limit 1;` (vía `mcp__supabase__execute_sql`) y confirmar que `duration_seconds` no es null y es un número razonable (coincide aproximadamente con el tiempo real que tomó completar el entrenamiento de prueba).

- [ ] **Paso 5: Commit**

```bash
git add app/actions/workout-sessions.ts components/planes/WorkoutSession.tsx
git commit -m "feat(entrenamiento): capturar duracion real de sesion y mandarla al completar"
```

---

### Task 4: Server Actions — persistir configuración y valores usados

**Files:**
- Modify: `app/actions/nutrition.ts`
- Modify: `app/actions/members.ts`

**Interfaces:**
- Consumes: `calcTmb`, `calcNutritionTargets`, `missingTargetFields`, `validateNutritionSafety`, `defaultNutritionSettingsForGoal`, `type MemberProfile` (Task 1, todos desde `@/lib/nutrition`).
- Produces (usado por Task 6, 7):
  - `type GymNutritionDefaults` (exportado desde `app/actions/nutrition.ts` — cierra la dependencia que Task 1 dejó abierta en su Paso 6).
  - `getGymNutritionDefaults(gymId: string): Promise<GymNutritionDefaults>`
  - `saveGymNutritionDefaults(gymId: string, updates: Omit<GymNutritionDefaults, "gym_id">): Promise<{ error: string } | { success: true }>`
  - `setMemberMetabolicReference(memberId: string, reference: "male" | "female"): Promise<{ error: string } | { success: true }>`
  - `createNutritionPlan(gymId, memberId, name, goal, calorieAdjustmentPct, proteinPerKg, notes?)` — firma cambiada, agrega dos parámetros nuevos antes de `notes`.
  - `recalculateNutritionPlanTargets(planId: string, overrides?: { calorieAdjustmentPct: number; proteinPerKg: number })` — firma extendida, el 2º parámetro es opcional.
  - `getMemberProfileForPlan` devuelve también `daily_activity`/`metabolic_reference`.
  - `updateMemberContact` acepta `dailyActivity` en su input.

- [ ] **Paso 1: Extender el tipo `NutritionPlan` con las columnas nuevas**

`getNutritionPlan`/`getNutritionPlans` ya hacen `.select("*")`, así que el dato de las 5 columnas nuevas de Task 1 (`calorie_adjustment_pct`, `protein_per_kg`, `fat_per_kg`, `needs_review`, `needs_review_reason`) ya llega en runtime — pero el tipo `NutritionPlan` no las declara, y Task 6 las lee desde `NutritionPlanEditor.tsx` (`plan.needs_review`, etc.). Sin este paso, el build de TypeScript falla.

Reemplazar el tipo `NutritionPlan` completo (líneas 49-65) por:

```typescript
export type NutritionPlan = {
  id: string
  gym_id: string
  member_id: string
  created_by: string | null
  name: string
  goal: "volumen" | "definicion" | "mantenimiento" | "recomposicion" | "rendimiento" | "perdida_moderada" | "otro"
  notes: string | null
  is_active: boolean
  created_at: string
  target_calories: number | null
  target_protein:  number | null
  target_carbs:    number | null
  target_fat:      number | null
  calorie_adjustment_pct: number | null
  protein_per_kg:         number | null
  fat_per_kg:              number | null
  needs_review:            boolean
  needs_review_reason:     string | null
  profiles?: { full_name: string | null; avatar_url: string | null }
  nutrition_meals?: Meal[]
}
```

- [ ] **Paso 2: Agregar el tipo `GymNutritionDefaults` y sus defaults**

En `app/actions/nutrition.ts`, agregar después del tipo `NutritionPlan` (antes de `// ── Food library`):

```typescript
export type GymNutritionDefaults = {
  gym_id: string
  volumen_pct: number; volumen_protein: number
  rendimiento_pct: number; rendimiento_protein: number
  mantenimiento_protein: number
  recomposicion_protein: number
  perdida_moderada_pct: number; perdida_moderada_protein: number
  definicion_pct: number; definicion_protein: number
}

const DEFAULT_GYM_NUTRITION_DEFAULTS: Omit<GymNutritionDefaults, "gym_id"> = {
  volumen_pct: 12, volumen_protein: 1.8,
  rendimiento_pct: 8, rendimiento_protein: 1.8,
  mantenimiento_protein: 1.7,
  recomposicion_protein: 2.0,
  perdida_moderada_pct: -10, perdida_moderada_protein: 2.0,
  definicion_pct: -18, definicion_protein: 2.2,
}
```

- [ ] **Paso 3: Actualizar el import de `lib/nutrition`**

Reemplazar la línea 6 (`import { calcNutritionTargets, missingTargetFields } from "@/lib/nutrition"`) por:

```typescript
import { calcTmb, calcNutritionTargets, missingTargetFields, validateNutritionSafety } from "@/lib/nutrition"
```

- [ ] **Paso 4: Extender `getMemberProfileForPlan`**

Reemplazar la función completa (líneas 162-177) por:

```typescript
export async function getMemberProfileForPlan(memberId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("profiles")
    .select("weight_kg, height_cm, date_of_birth, gender, training_frequency, daily_activity, metabolic_reference, goal")
    .eq("id", memberId)
    .single()
  return data as {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
    daily_activity: "sedentary" | "moderate" | "active" | null
    metabolic_reference: "male" | "female" | null
    goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  } | null
}
```

- [ ] **Paso 5: Reemplazar `createNutritionPlan`**

Reemplazar la función completa (líneas 179-220) por:

```typescript
export async function createNutritionPlan(
  gymId: string,
  memberId: string,
  name: string,
  goal: NutritionPlan["goal"],
  calorieAdjustmentPct: number,
  proteinPerKg: number,
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient()

  const profile = await getMemberProfileForPlan(memberId)
  const targets = profile ? calcNutritionTargets(profile, goal, { calorieAdjustmentPct, proteinPerKg }) : null

  if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const tmb = profile ? calcTmb(profile) : null
  const safety = tmb != null
    ? validateNutritionSafety(targets, tmb, calorieAdjustmentPct, proteinPerKg)
    : { needsReview: false, reason: null }
  const fatPerKg = targets.fat / (profile!.weight_kg as number)

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
      calorie_adjustment_pct: calorieAdjustmentPct,
      protein_per_kg: proteinPerKg,
      fat_per_kg: fatPerKg,
      needs_review: safety.needsReview,
      needs_review_reason: safety.reason,
    } as never)
    .select("id")
    .single()
  if (error) return { error: error.message }
  revalidatePath("/nutricion")
  return { id: (data as unknown as { id: string }).id }
}
```

- [ ] **Paso 6: Reemplazar `recalculateNutritionPlanTargets`**

Reemplazar la función completa (líneas 230-304) por:

```typescript
export async function recalculateNutritionPlanTargets(
  planId: string,
  overrides?: { calorieAdjustmentPct: number; proteinPerKg: number }
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
    .select("gym_id, member_id, goal, target_calories, calorie_adjustment_pct, protein_per_kg")
    .eq("id", planId)
    .single() as unknown as {
      data: {
        gym_id: string; member_id: string; goal: NutritionPlan["goal"]; target_calories: number | null
        calorie_adjustment_pct: number | null; protein_per_kg: number | null
      } | null
    }

  if (!plan || plan.gym_id !== (me as any).gym_id) {
    return { error: "El plan no pertenece a tu gym" }
  }

  const profile = await getMemberProfileForPlan(plan.member_id)

  // Sin overrides explícitos (botón "Actualizar" de siempre): reusa los
  // valores YA guardados en el plan, no vuelve a los defaults del objetivo.
  // Un plan viejo (de antes de esta migración) tiene estas columnas en
  // null — calcNutritionTargets cae a defaultNutritionSettingsForGoal en
  // ese caso, igual que se comportaba antes de este cambio.
  const calorieAdjustmentPct = overrides?.calorieAdjustmentPct ?? plan.calorie_adjustment_pct ?? undefined
  const proteinPerKg = overrides?.proteinPerKg ?? plan.protein_per_kg ?? undefined
  const resolvedOverrides = calorieAdjustmentPct != null && proteinPerKg != null
    ? { calorieAdjustmentPct, proteinPerKg }
    : undefined

  const targets = profile ? calcNutritionTargets(profile, plan.goal, resolvedOverrides) : null

  if (!targets) {
    const missing = missingTargetFields(profile)
    return {
      error: missing.length > 0
        ? `Faltan datos del socio para calcular el objetivo: ${missing.join(", ")}.`
        : "No se pudo calcular el objetivo nutricional a partir de los datos del socio."
    }
  }

  const tmb = profile ? calcTmb(profile) : null
  const finalPct = resolvedOverrides?.calorieAdjustmentPct ?? 0
  const finalProtein = resolvedOverrides?.proteinPerKg ?? (targets.protein / (profile!.weight_kg as number))
  const safety = tmb != null
    ? validateNutritionSafety(targets, tmb, finalPct, finalProtein)
    : { needsReview: false, reason: null }
  const fatPerKg = targets.fat / (profile!.weight_kg as number)

  const { data: updated, error } = await supabase
    .from("nutrition_plans" as never)
    .update({
      target_calories: targets.calories,
      target_protein:  targets.protein,
      target_carbs:    targets.carbs,
      target_fat:      targets.fat,
      calorie_adjustment_pct: finalPct,
      protein_per_kg: finalProtein,
      fat_per_kg: fatPerKg,
      needs_review: safety.needsReview,
      needs_review_reason: safety.reason,
    } as never)
    .eq("id", planId)
    .select("id")

  if (error) return { error: error.message }

  // Si RLS bloqueó el update, Supabase no tira error pero tampoco devuelve filas.
  if (!updated || updated.length === 0) {
    return { error: "No se pudo actualizar el plan (sin permiso o no existe)" }
  }

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

- [ ] **Paso 7: Agregar `getGymNutritionDefaults`, `saveGymNutritionDefaults` y `setMemberMetabolicReference`**

Agregar al final de `app/actions/nutrition.ts`:

```typescript
// ── Configuración de nutrición por gym ──────────────────────────

export async function getGymNutritionDefaults(gymId: string): Promise<GymNutritionDefaults> {
  const supabase = createClient()
  const { data } = await supabase
    .from("gym_nutrition_defaults" as never)
    .select("*")
    .eq("gym_id", gymId)
    .maybeSingle()
  if (data) return data as unknown as GymNutritionDefaults

  const { data: created } = await supabase
    .from("gym_nutrition_defaults" as never)
    .insert({ gym_id: gymId, ...DEFAULT_GYM_NUTRITION_DEFAULTS } as never)
    .select("*")
    .single()
  return (created as unknown as GymNutritionDefaults) ?? { gym_id: gymId, ...DEFAULT_GYM_NUTRITION_DEFAULTS }
}

export async function saveGymNutritionDefaults(
  gymId: string,
  updates: Omit<GymNutritionDefaults, "gym_id">
): Promise<{ error: string } | { success: true }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || (me as any).role !== "admin" || (me as any).gym_id !== gymId) {
    return { error: "Sin permiso" }
  }

  const { error } = await supabase
    .from("gym_nutrition_defaults" as never)
    .upsert({ gym_id: gymId, ...updates, updated_at: new Date().toISOString() } as never)
  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}

// ── Referencia metabólica del socio ─────────────────────────────

export async function setMemberMetabolicReference(
  memberId: string,
  reference: "male" | "female"
): Promise<{ error: string } | { success: true }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase.from("profiles").select("role, gym_id").eq("id", user.id).single()
  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: target } = await supabase.from("profiles").select("gym_id").eq("id", memberId).single()
  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ metabolic_reference: reference } as never)
    .eq("id", memberId)
  if (error) return { error: error.message }
  revalidatePath(`/members/${memberId}`)
  revalidatePath("/nutricion")
  return { success: true }
}
```

- [ ] **Paso 8: Extender `MemberContactInput` y `updateMemberContact`**

En `app/actions/members.ts`, reemplazar el tipo `MemberContactInput` (líneas 54-63) por:

```typescript
export type MemberContactInput = {
  memberId: string
  dateOfBirth: string | null
  phone: string | null
  gender: "male" | "female" | "other" | null
  goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  trainingFrequency: "never" | "1-2" | "3-4" | "5+" | null
  dailyActivity: "sedentary" | "moderate" | "active" | null
  emergencyName: string | null
  emergencyPhone: string | null
}
```

Reemplazar el bloque `.update({...})` dentro de `updateMemberContact` (líneas 98-108) por:

```typescript
  const { error } = await supabase
    .from("profiles")
    .update({
      date_of_birth: input.dateOfBirth,
      phone: input.phone,
      gender: input.gender,
      goal: input.goal,
      training_frequency: input.trainingFrequency,
      daily_activity: input.dailyActivity,
      emergency_name: input.emergencyName,
      emergency_phone: input.emergencyPhone,
    } as never)
    .eq("id", input.memberId)
```

- [ ] **Paso 9: Verificación manual**

No hay tests automatizados de Server Actions en este proyecto (solo `lib/*.test.ts` tiene cobertura vitest — confirmado por convención existente, ningún archivo bajo `app/actions/` tiene un `.test.ts` hermano). Verificar a mano:

1. `npx tsc --noEmit` — confirma que `GymNutritionDefaults` ya no es un tipo faltante para `lib/nutrition.ts` (cierra la nota del Paso 6 de Task 1) y que no hay otros errores de tipos introducidos.
2. Desde el editor de plan nutricional existente, confirmar que crear un plan sigue funcionando (se ejercita más a fondo en Task 6, pero un smoke test acá evita arrastrar un error de tipos hasta el final).

- [ ] **Paso 10: Commit**

```bash
git add app/actions/nutrition.ts app/actions/members.ts
git commit -m "feat(nutricion): server actions para defaults por gym, referencia metabolica y valores configurables del plan"
```

---

### Task 5: UI — actividad diaria en el perfil del socio

**Files:**
- Modify: `components/auth/register/MemberRegisterForm.tsx`
- Modify: `components/members/MemberContactEdit.tsx`
- Modify: `app/(dashboard)/members/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateMemberContact` con `dailyActivity` (Task 4).

- [ ] **Paso 1: `MemberRegisterForm.tsx` — agregar el campo al registro**

Reemplazar las líneas 15-32 (tipos `Gender`/`Goal`/`Frequency`, `FormData`, `INITIAL`) por:

```typescript
type Gender = "male" | "female" | "other"
type Goal = "lose_weight" | "gain_muscle" | "performance" | "maintain"
type Frequency = "never" | "1-2" | "3-4" | "5+"
type DailyActivity = "sedentary" | "moderate" | "active"

type FormData = {
  fullName: string; email: string; password: string
  dateOfBirth: string; gender: Gender | ""; phone: string
  weightKg: string; heightCm: string; goal: Goal | ""
  medicalConditions: string; trainingFrequency: Frequency | ""
  dailyActivity: DailyActivity | ""
  emergencyName: string; emergencyPhone: string
}

const INITIAL: FormData = {
  fullName: "", email: "", password: "",
  dateOfBirth: "", gender: "", phone: "",
  weightKg: "", heightCm: "", goal: "",
  medicalConditions: "", trainingFrequency: "", dailyActivity: "",
  emergencyName: "", emergencyPhone: "",
}
```

Reemplazar el bloque `.update({...})` (líneas 139-149) por:

```typescript
      await supabase.from("profiles").update({
        date_of_birth:      data.dateOfBirth || null,
        phone:              data.phone ? normalizePhoneAR(data.phone) : null,
        weight_kg:          data.weightKg ? Number(data.weightKg) : null,
        height_cm:          data.heightCm ? Number(data.heightCm) : null,
        goal:               data.goal || null,
        medical_conditions: data.medicalConditions || null,
        training_frequency: data.trainingFrequency || null,
        daily_activity:     data.dailyActivity || null,
        emergency_name:     data.emergencyName || null,
        emergency_phone:    data.emergencyPhone || null,
      } as never).eq("id", authData.session.user.id)
```

Agregar, justo después del bloque de `<FieldError msg={errors.trainingFrequency} />` (después de la línea 368, antes del `<div>` de "Lesiones o condiciones médicas" que empieza en la línea 370):

```typescript
          <div>
            <label className={labelCls}>¿Cómo es tu actividad diaria fuera del gym?</label>
            <Pill
              options={[
                { value: "sedentary" as DailyActivity, label: "Sedentaria" },
                { value: "moderate" as DailyActivity, label: "Moderada" },
                { value: "active" as DailyActivity, label: "Muy activa" },
              ]}
              value={data.dailyActivity} onChange={(v) => set("dailyActivity", v)} />
          </div>
```

- [ ] **Paso 2: `MemberContactEdit.tsx` — agregar el campo a la edición**

Reemplazar las líneas 12-14 (tipos `Gender`/`Goal`/`Frequency`) por:

```typescript
type Gender = "male" | "female" | "other"
type Goal = "lose_weight" | "gain_muscle" | "performance" | "maintain"
type Frequency = "never" | "1-2" | "3-4" | "5+"
type DailyActivity = "sedentary" | "moderate" | "active"
```

Agregar después de `FREQUENCY_LABELS` (después de la línea 22):

```typescript
const ACTIVITY_LABELS: Record<DailyActivity, string> = {
  sedentary: "Sedentaria", moderate: "Moderada", active: "Muy activa",
}
```

Reemplazar la interfaz `Props` (líneas 24-33) por:

```typescript
interface Props {
  memberId: string
  initialDateOfBirth: string | null
  initialPhone: string | null
  initialGender: Gender | null
  initialGoal: Goal | null
  initialTrainingFrequency: Frequency | null
  initialDailyActivity: DailyActivity | null
  initialEmergencyName: string | null
  initialEmergencyPhone: string | null
}
```

Reemplazar la firma del componente y sus primeros estados (líneas 42-52) por:

```typescript
export default function MemberContactEdit({
  memberId, initialDateOfBirth, initialPhone, initialGender, initialGoal,
  initialTrainingFrequency, initialDailyActivity, initialEmergencyName, initialEmergencyPhone,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "")
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "")
  const [goal, setGoal] = useState<Goal | "">(initialGoal ?? "")
  const [trainingFrequency, setTrainingFrequency] = useState<Frequency | "">(initialTrainingFrequency ?? "")
  const [dailyActivity, setDailyActivity] = useState<DailyActivity | "">(initialDailyActivity ?? "")
```

Reemplazar la llamada a `updateMemberContact` dentro de `handleSave` (líneas 71-80) por:

```typescript
      const result = await updateMemberContact({
        memberId,
        dateOfBirth: dateOfBirth || null,
        phone: normalizedPhone,
        gender: gender || null,
        goal: goal || null,
        trainingFrequency: trainingFrequency || null,
        dailyActivity: dailyActivity || null,
        emergencyName: emergencyName || null,
        emergencyPhone: emergencyPhone || null,
      })
```

Agregar un `Stat` más en el modo vista, después del `Stat` de "Frecuencia" (después de la línea 128, antes del `Stat` de "Emergencia"):

```typescript
            <Stat icon={<Activity className="h-4 w-4 text-brand-500" />} label="Actividad diaria"
              value={initialDailyActivity ? (ACTIVITY_LABELS[initialDailyActivity] ?? initialDailyActivity) : "—"} />
```

Agregar el select en modo edición, justo después del `</label>` que cierra "Frecuencia de entrenamiento" (después de la línea 206, antes del `<div className="grid grid-cols-2 gap-3">` de contacto de emergencia):

```typescript
            <label className="space-y-1.5 block">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Activity className="h-3.5 w-3.5" />
                Actividad diaria (fuera del gym)
              </span>
              <select value={dailyActivity} onChange={e => setDailyActivity(e.target.value as DailyActivity | "")} className={selectCls}>
                <option value="">Sin especificar</option>
                <option value="sedentary">Sedentaria</option>
                <option value="moderate">Moderada</option>
                <option value="active">Muy activa</option>
              </select>
            </label>
```

- [ ] **Paso 3: `app/(dashboard)/members/[id]/page.tsx` — traer y pasar el dato**

Reemplazar el tipo `MemberRow` (líneas 32-42) por:

```typescript
type MemberRow = {
  id: string; full_name: string | null; avatar_url: string | null
  role: string; membership_type: string | null; membership_expires_at: string | null
  weight_kg: number | null; height_cm: number | null
  phone: string | null; date_of_birth: string | null
  gender: "male" | "female" | "other" | null
  emergency_name: string | null; emergency_phone: string | null
  goal: string | null; medical_conditions: string | null
  training_frequency: string | null; daily_activity: string | null
  total_xp: number; created_at: string
  trainer_id: string | null
}
```

Reemplazar el `.select(...)` de `rawMember` (líneas 82-84) por:

```typescript
  const { data: rawMember } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, membership_type, membership_expires_at, weight_kg, height_cm, phone, date_of_birth, gender, emergency_name, emergency_phone, goal, medical_conditions, training_frequency, daily_activity, total_xp, created_at, trainer_id")
```

Reemplazar el bloque `<MemberContactEdit ... />` (líneas 263-272) por:

```typescript
      <MemberContactEdit
        memberId={params.id}
        initialDateOfBirth={member.date_of_birth}
        initialPhone={member.phone}
        initialGender={member.gender}
        initialGoal={member.goal as "lose_weight" | "gain_muscle" | "performance" | "maintain" | null}
        initialTrainingFrequency={member.training_frequency as "never" | "1-2" | "3-4" | "5+" | null}
        initialDailyActivity={member.daily_activity as "sedentary" | "moderate" | "active" | null}
        initialEmergencyName={member.emergency_name}
        initialEmergencyPhone={member.emergency_phone}
      />
```

- [ ] **Paso 4: Verificación manual**

1. `npm run dev`, registrar un socio nuevo — confirmar que el paso de "Tu salud" muestra el nuevo selector de actividad diaria antes de las condiciones médicas.
2. Como admin/trainer, entrar a `/members/[id]` de un socio existente, click en "Editar" en "Datos de contacto" — confirmar que aparece "Actividad diaria" con las 3 opciones, que guarda, y que el modo vista lo muestra después de guardar.

- [ ] **Paso 5: Commit**

```bash
git add components/auth/register/MemberRegisterForm.tsx components/members/MemberContactEdit.tsx "app/(dashboard)/members/[id]/page.tsx"
git commit -m "feat(nutricion): agregar actividad diaria al registro y ficha del socio"
```

---

### Task 6: UI — proteína/ajuste configurables + referencia metabólica en el flujo de planes

**Files:**
- Modify: `components/nutrition/NutritionPlansPanel.tsx`
- Modify: `components/nutrition/NutritionPlanEditor.tsx`

**Interfaces:**
- Consumes: `getGymNutritionDefaults`, `createNutritionPlan` (firma nueva), `recalculateNutritionPlanTargets` (firma nueva), `setMemberMetabolicReference` (Task 4); `gymDefaultsForGoal`, `type MemberProfile` (Task 1).

- [ ] **Paso 1: `NutritionPlansPanel.tsx` — inputs editables + selector de referencia metabólica**

Reemplazar el import de `@/app/actions/nutrition` (línea 8) por:

```typescript
import { createNutritionPlan, deleteNutritionPlan, getMemberProfileForPlan, getGymNutritionDefaults, setMemberMetabolicReference } from "@/app/actions/nutrition"
import type { NutritionPlan, GymNutritionDefaults } from "@/app/actions/nutrition"
```

(Esto reemplaza también la línea 9 `import type { NutritionPlan } from "@/app/actions/nutrition"` — se fusiona en el import de arriba.)

Reemplazar el import de `@/lib/nutrition` (línea 10) por:

```typescript
import { calcNutritionTargets, missingTargetFields, NUTRITION_GOAL_OPTIONS, NUTRITION_GOAL_LABELS, gymDefaultsForGoal } from "@/lib/nutrition"
```

Agregar el import de `useEffect` — reemplazar la línea 3 (`import { useState, useTransition } from "react"`) por:

```typescript
import { useState, useEffect, useTransition } from "react"
```

Reemplazar el bloque de estado del componente (líneas 51-57) por:

```typescript
  const [plans, setPlans] = useState(initialPlans)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ memberId: "", name: "", goal: "" as NutritionPlan["goal"] | "", notes: "" })
  const [memberProfile, setMemberProfile] = useState<Awaited<ReturnType<typeof getMemberProfileForPlan>>>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [gymDefaults, setGymDefaults] = useState<GymNutritionDefaults | null>(null)
  const [calorieAdjustmentPct, setCalorieAdjustmentPct] = useState<number | "">("")
  const [proteinPerKg, setProteinPerKg] = useState<number | "">("")
  const [savingMetabolicRef, setSavingMetabolicRef] = useState(false)

  useEffect(() => {
    getGymNutritionDefaults(gymId).then(setGymDefaults)
  }, [gymId])
```

Reemplazar `handleMemberChange` (líneas 59-70) por:

```typescript
  async function handleMemberChange(memberId: string) {
    setForm(f => ({ ...f, memberId }))
    setMemberProfile(null)
    if (!memberId) return
    setLoadingProfile(true)
    try {
      const profile = await getMemberProfileForPlan(memberId)
      setMemberProfile(profile)
    } finally {
      setLoadingProfile(false)
    }
  }

  function handleGoalChange(goal: NutritionPlan["goal"] | "") {
    setForm(f => ({ ...f, goal }))
    if (goal && gymDefaults) {
      const d = gymDefaultsForGoal(gymDefaults, goal)
      setCalorieAdjustmentPct(d.pct)
      setProteinPerKg(d.protein)
    } else {
      setCalorieAdjustmentPct("")
      setProteinPerKg("")
    }
  }

  async function handleSaveMetabolicReference(reference: "male" | "female") {
    if (!form.memberId) return
    setSavingMetabolicRef(true)
    try {
      await setMemberMetabolicReference(form.memberId, reference)
      await handleMemberChange(form.memberId)
    } finally {
      setSavingMetabolicRef(false)
    }
  }
```

Reemplazar la línea `const suggestedTargets = ...` (línea 74) por:

```typescript
  const suggestedTargets = memberProfile && form.goal && calorieAdjustmentPct !== "" && proteinPerKg !== ""
    ? calcNutritionTargets(memberProfile, form.goal, { calorieAdjustmentPct, proteinPerKg })
    : null

  const needsMetabolicReference = missingFields.includes("referencia metabólica")
```

(Esta línea va DESPUÉS de `const missingFields = missingTargetFields(memberProfile)` que ya existe en la línea 72 — no la reemplaza, se agrega después.)

Reemplazar `handleCreate` (líneas 76-94) por:

```typescript
  function handleCreate() {
    if (!form.memberId || !form.name.trim() || !form.goal || calorieAdjustmentPct === "" || proteinPerKg === "") return
    const goal = form.goal
    const pct = calorieAdjustmentPct
    const protein = proteinPerKg
    startTransition(async () => {
      try {
        const result = await createNutritionPlan(gymId, form.memberId, form.name, goal, pct, protein, form.notes || undefined)
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

Reemplazar el `<select>` de "Objetivo" (líneas 210-224) para que use `handleGoalChange` en vez de setear `form` directo:

```typescript
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">Objetivo</label>
                <select
                  value={form.goal}
                  onChange={e => handleGoalChange(e.target.value as NutritionPlan["goal"] | "")}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Seleccioná un objetivo…</option>
                  {NUTRITION_GOAL_OPTIONS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                {form.goal && GOAL_DESCRIPTIONS[form.goal] && (
                  <p className="mt-1.5 text-xs text-zinc-500">{GOAL_DESCRIPTIONS[form.goal]}</p>
                )}
              </div>
```

Agregar, después del bloque `{!loadingProfile && memberProfile && missingFields.length > 0 && (...)}` (después de la línea 248, antes del bloque `{suggestedTargets && (...)}`), el selector de referencia metabólica (solo cuando hace falta) y los dos inputs editables (solo cuando ya se eligió un objetivo):

```typescript
              {!loadingProfile && memberProfile && needsMetabolicReference && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs text-amber-400">
                    Este socio no tiene género masculino/femenino cargado. Elegí con qué referencia calcular su metabolismo basal — es una estimación matemática para la fórmula, no determina el metabolismo real de la persona.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingMetabolicRef}
                      onClick={() => handleSaveMetabolicReference("male")}
                      className="flex-1 rounded-lg border border-amber-500/40 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                    >
                      Referencia masculina
                    </button>
                    <button
                      type="button"
                      disabled={savingMetabolicRef}
                      onClick={() => handleSaveMetabolicReference("female")}
                      className="flex-1 rounded-lg border border-amber-500/40 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                    >
                      Referencia femenina
                    </button>
                  </div>
                </div>
              )}

              {form.goal && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-500">Ajuste calórico (%)</label>
                    <input
                      type="number" step="1"
                      value={calorieAdjustmentPct}
                      onChange={e => setCalorieAdjustmentPct(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-500">Proteína (g/kg)</label>
                    <input
                      type="number" step="0.1"
                      value={proteinPerKg}
                      onChange={e => setProteinPerKg(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                </div>
              )}
```

Reemplazar el `disabled` del botón "Crear plan" (línea 295) para incluir los nuevos campos:

```typescript
                disabled={isPending || !form.memberId || !form.name.trim() || !suggestedTargets || loadingProfile}
```

(Sin cambios en esta línea puntual — `!suggestedTargets` ya cubre el caso de que falten `calorieAdjustmentPct`/`proteinPerKg`, porque `suggestedTargets` ahora depende de ellos. Confirmar que sigue así, no hace falta editar.)

- [ ] **Paso 2: `NutritionPlanEditor.tsx` — sincronizar el tipo local del perfil**

`NutritionPlanEditor.tsx` declara su propio tipo `MemberProfileForTargets` (líneas 25-31) en vez de importar `MemberProfile` de `lib/nutrition.ts` — quedó desactualizado por Task 1 (le faltan `daily_activity`/`metabolic_reference`, que ahora son campos requeridos por `calcNutritionTargets`). La página que renderiza este componente (`app/(dashboard)/nutricion/[id]/page.tsx`) ya llama a `getMemberProfileForPlan` (la misma función que Task 4 extendió), así que el dato ya llega — solo falta el tipo.

Reemplazar el tipo `MemberProfileForTargets` (líneas 25-31) por:

```typescript
type MemberProfileForTargets = {
  weight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  gender: "male" | "female" | "other" | null
  training_frequency: "never" | "1-2" | "3-4" | "5+" | null
  daily_activity: "sedentary" | "moderate" | "active" | null
  metabolic_reference: "male" | "female" | null
}
```

- [ ] **Paso 3: `NutritionPlanEditor.tsx` — sección editable + aviso de revisión de seguridad**

El import de `@/app/actions/nutrition` (línea 16) no cambia — `recalculateNutritionPlanTargets` no cambia de nombre, solo de firma (2º parámetro opcional nuevo), así que el import existente sigue siendo válido.

Agregar estado nuevo después de `const [isRecalculating, setIsRecalculating] = useState(false)` (línea 599):

```typescript
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [editCalorieAdjustmentPct, setEditCalorieAdjustmentPct] = useState<number>(plan.calorie_adjustment_pct ?? 0)
  const [editProteinPerKg, setEditProteinPerKg] = useState<number>(plan.protein_per_kg ?? 0)
  const [confirmingRecalculateWithValues, setConfirmingRecalculateWithValues] = useState(false)
  const [isRecalculatingWithValues, setIsRecalculatingWithValues] = useState(false)
```

Agregar, después de `handleConfirmRecalculate` (después de la línea 799), un nuevo handler:

```typescript
  async function handleConfirmRecalculateWithValues() {
    setIsRecalculatingWithValues(true)
    try {
      const result = await recalculateNutritionPlanTargets(plan.id, {
        calorieAdjustmentPct: editCalorieAdjustmentPct,
        proteinPerKg: editProteinPerKg,
      })
      if ("error" in result) {
        sileo.error({ title: "No se pudo actualizar el objetivo", description: result.error, duration: 4000 })
        return
      }
      sileo.success({
        title: "Objetivo actualizado",
        description: `Nuevo objetivo: ${result.targets.calories.toLocaleString("es-AR")} kcal.`,
        duration: 3000,
      })
      setConfirmingRecalculateWithValues(false)
      router.refresh()
    } catch {
      sileo.error({ title: "No se pudo actualizar el objetivo", description: "Revisá tu conexión e intentá de nuevo.", duration: 4000 })
    } finally {
      setIsRecalculatingWithValues(false)
    }
  }
```

Agregar el aviso de `needs_review`, junto a los otros warnings (después del bloque `{nutritionWarnings.length > 0 && (...)}`, después de la línea 866, antes de `{/* ── Active badge + stats bar ───────────────────────── */}`):

```typescript
      {plan.needs_review && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <p className="font-semibold">Este plan quedó marcado para revisión</p>
          <p className="mt-0.5">{plan.needs_review_reason}</p>
        </div>
      )}
```

Agregar la sección editable, en la tarjeta "Resumen del plan" (dentro del `<div className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 min-w-[180px]">`, después del último `<div className="flex items-center gap-2 text-zinc-400">` que muestra "Objetivo" — después de la línea 913, antes del cierre `</div>` de la línea 914):

```typescript
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-600 font-bold">·</span>
              <span>Objetivo: <span className="font-bold text-zinc-200">{GOAL_LABELS[plan.goal] ?? plan.goal}</span></span>
            </div>
            <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ajuste %</label>
                  <input
                    type="number" step="1"
                    value={editCalorieAdjustmentPct}
                    onChange={e => setEditCalorieAdjustmentPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Prot. g/kg</label>
                  <input
                    type="number" step="0.1"
                    value={editProteinPerKg}
                    onChange={e => setEditProteinPerKg(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              </div>
              <button
                onClick={() => setConfirmingRecalculateWithValues(true)}
                className="w-full rounded-lg bg-zinc-700 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-600 transition-colors"
              >
                Recalcular con estos valores
              </button>
            </div>
```

Agregar el modal de confirmación correspondiente, después del `</Dialog>` que cierra el modal "Recalculate targets modal" (después de la línea 1180, antes de `{/* USDA Import Modal */}`):

```typescript
      {/* Recalculate with custom values modal */}
      <Dialog open={confirmingRecalculateWithValues} onOpenChange={open => { if (!open && !isRecalculatingWithValues) setConfirmingRecalculateWithValues(false) }}>
        <DialogContent className="sm:max-w-sm border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">¿Recalcular con estos valores?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              El objetivo se recalcula con {editCalorieAdjustmentPct}% de ajuste y {editProteinPerKg} g/kg de proteína. Las comidas cargadas no se tocan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirmingRecalculateWithValues(false)}
              disabled={isRecalculatingWithValues}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmRecalculateWithValues}
              disabled={isRecalculatingWithValues}
              className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {isRecalculatingWithValues ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Paso 4: Verificación manual**

1. `npm run dev`, entrar a "Nutrición" como admin/trainer, click en "Nuevo plan". Elegir un socio con perfil completo (género male/female) y un objetivo — confirmar que los inputs de "Ajuste calórico (%)" y "Proteína (g/kg)" se precargan con los defaults del gym y son editables; cambiar los valores y confirmar que "Targets calculados automáticamente" se actualiza en vivo.
2. Elegir un socio con `gender = 'other'` (o editar uno a "Otro" desde `/members/[id]` primero) — confirmar que aparece el aviso de referencia metabólica con los dos botones, que clickear uno lo guarda y desbloquea el cálculo.
3. Crear el plan, entrar al editor (`/nutricion/[id]`), cambiar los valores de "Ajuste %"/"Prot. g/kg" en la tarjeta de resumen y clickear "Recalcular con estos valores" — confirmar que el modal muestra los valores elegidos y que al confirmar el objetivo se actualiza.
4. Forzar un caso fuera de rango (ej: ajuste -30%) y confirmar que aparece el aviso rojo "Este plan quedó marcado para revisión" con el motivo, y que el plan se guardó igual (no bloqueó nada).

- [ ] **Paso 5: Commit**

```bash
git add components/nutrition/NutritionPlansPanel.tsx components/nutrition/NutritionPlanEditor.tsx
git commit -m "feat(nutricion): proteina y ajuste calorico configurables, selector de referencia metabolica, aviso de revision"
```

---

### Task 7: UI — pantalla de admin para los defaults del gym

**Files:**
- Create: `components/admin/GymNutritionDefaultsPanel.tsx`
- Modify: `app/(dashboard)/admin/page.tsx`

**Interfaces:**
- Consumes: `getGymNutritionDefaults`, `saveGymNutritionDefaults`, `type GymNutritionDefaults` (Task 4).

- [ ] **Paso 1: Crear `GymNutritionDefaultsPanel.tsx`**

```typescript
"use client"

import { useState, useEffect } from "react"
import { sileo } from "sileo"
import { getGymNutritionDefaults, saveGymNutritionDefaults } from "@/app/actions/nutrition"
import type { GymNutritionDefaults } from "@/app/actions/nutrition"

interface Props { gymId: string }

type Row = { key: keyof Omit<GymNutritionDefaults, "gym_id">; label: string; unit: string }

const PCT_ROWS: Row[] = [
  { key: "volumen_pct",          label: "Volumen — ajuste",          unit: "%" },
  { key: "rendimiento_pct",      label: "Rendimiento — ajuste",      unit: "%" },
  { key: "perdida_moderada_pct", label: "Pérdida moderada — ajuste", unit: "%" },
  { key: "definicion_pct",       label: "Definición — ajuste",       unit: "%" },
]

const PROTEIN_ROWS: Row[] = [
  { key: "volumen_protein",          label: "Volumen — proteína",          unit: "g/kg" },
  { key: "rendimiento_protein",      label: "Rendimiento — proteína",      unit: "g/kg" },
  { key: "mantenimiento_protein",    label: "Mantenimiento — proteína",    unit: "g/kg" },
  { key: "recomposicion_protein",    label: "Recomposición — proteína",    unit: "g/kg" },
  { key: "perdida_moderada_protein", label: "Pérdida moderada — proteína", unit: "g/kg" },
  { key: "definicion_protein",       label: "Definición — proteína",       unit: "g/kg" },
]

export default function GymNutritionDefaultsPanel({ gymId }: Props) {
  const [defaults, setDefaults] = useState<GymNutritionDefaults | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGymNutritionDefaults(gymId).then(setDefaults)
  }, [gymId])

  function setField(key: Row["key"], value: number) {
    setDefaults(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function handleSave() {
    if (!defaults) return
    setSaving(true)
    try {
      const { gym_id, ...updates } = defaults
      const result = await saveGymNutritionDefaults(gymId, updates)
      if ("error" in result) {
        sileo.error({ title: "No se pudo guardar", description: result.error, duration: 4000 })
        return
      }
      sileo.success({ title: "Valores guardados", description: "Los nuevos planes van a usar estos defaults.", duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  if (!defaults) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ajuste calórico por objetivo</p>
        <p className="mb-4 text-xs text-zinc-500">
          Punto de partida al crear un plan — el trainer puede cambiarlo para un socio puntual sin afectar esta configuración.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PCT_ROWS.map(row => (
            <div key={row.key}>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">{row.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" step="1"
                  value={defaults[row.key]}
                  onChange={e => setField(row.key, Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-xs text-zinc-500">{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Proteína por objetivo</p>
        <p className="mb-4 text-xs text-zinc-500">Gramos de proteína por kilo de peso corporal.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PROTEIN_ROWS.map(row => (
            <div key={row.key}>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">{row.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" step="0.1"
                  value={defaults[row.key]}
                  onChange={e => setField(row.key, Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-xs text-zinc-500">{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  )
}
```

- [ ] **Paso 2: Agregar la pestaña en `app/(dashboard)/admin/page.tsx`**

Reemplazar el import de componentes admin (líneas 6-9) para agregar el nuevo panel:

```typescript
import GymSettingsPanel from "@/components/admin/GymSettingsPanel"
import MembershipPlansPanel from "@/components/admin/MembershipPlansPanel"
import ExportPanel from "@/components/admin/ExportPanel"
import GymNutritionDefaultsPanel from "@/components/admin/GymNutritionDefaultsPanel"
```

Reemplazar el array `tabs` (líneas 33-38) por:

```typescript
  const tabs = [
    { key: "pagos",          label: "Pagos" },
    { key: "membresias",     label: "Membresías" },
    { key: "nutricion",      label: "Nutrición" },
    { key: "exportaciones",  label: "Exportaciones" },
    { key: "configuracion",  label: "Configuración" },
  ]
```

Agregar una rama al `if/else if` que arma `content` (después del bloque `} else if (tab === "membresias") { ... }`, antes del `} else {` final que maneja "pagos"):

```typescript
  } else if (tab === "nutricion") {
    content = <GymNutritionDefaultsPanel gymId={gymId} />
  } else {
```

- [ ] **Paso 3: Verificación manual**

1. `npm run dev`, entrar a `/admin?tab=nutricion` como admin — confirmar que se ven los 10 campos (4 de ajuste %, 6 de proteína) con los valores por default.
2. Cambiar un valor, guardar, refrescar la página — confirmar que el valor persiste.
3. Crear un plan nuevo desde "Nutrición" para el objetivo que se cambió — confirmar que el input de proteína/ajuste en `NutritionPlansPanel.tsx` (Task 6) se precarga con el nuevo valor guardado acá.

- [ ] **Paso 4: Commit**

```bash
git add components/admin/GymNutritionDefaultsPanel.tsx "app/(dashboard)/admin/page.tsx"
git commit -m "feat(nutricion): pantalla de admin para configurar defaults de proteina y ajuste calorico"
```
