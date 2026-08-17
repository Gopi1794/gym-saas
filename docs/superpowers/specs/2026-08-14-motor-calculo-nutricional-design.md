# Motor de cálculo nutricional — Spec

**Fecha:** 2026-08-14
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

`lib/nutrition.ts` calcula el objetivo calórico y de macros de un socio con
Mifflin-St Jeor. Una auditoría externa (pegada por el usuario, verificada
línea por línea contra el código real) encontró que varios de los
supuestos del motor son demasiado rígidos o carecen de base:

- El TDEE depende solo de `training_frequency`, ignorando la actividad
  fuera del gimnasio.
- El intercepto de la fórmula para género `other`/no especificado
  (`-78`) es un promedio matemático entre el intercepto masculino y
  femenino, sin justificación fisiológica.
- La proteína por objetivo (ej. 2.5 g/kg fijo para recomposición) y los
  porcentajes de déficit/superávit (+12%/+8%/-10%/-18%) están hardcodeados,
  sin forma de ajustarlos.
- No hay validación de que el resultado esté en un rango razonable antes
  de guardarlo.

Este spec cubre **Frente A** de dos frentes independientes identificados
durante el brainstorming (Frente B — seguimiento de tendencias de peso,
adherencia y entrenamiento — se aborda después, como spec separado).

Un punto de la auditoría (distinguir alimentos crudo/cocido) se descarta:
el seed de `foods` ya lo resuelve por convención de nombres ("Pechuga de
pollo **cocida**", "Avena (seca)") sin ambigüedad práctica hoy.

## Alcance de este spec

1. Actividad diaria como input adicional del TDEE.
2. Captura real de duración de entrenamiento + alerta al trainer cuando
   hay dato suficiente para refinar el cálculo (sin aplicarlo solo).
3. Referencia metabólica explícita para género `other`/no especificado,
   sin promediar interceptos.
4. Proteína y % de ajuste calórico configurables (gym + override por
   plan), con los valores realmente usados grabados en el plan.
5. Límites de seguridad no bloqueantes sobre el resultado final.

### Fuera de alcance (explícito)

- Distinción crudo/cocido en la librería de alimentos.
- Taxonomía de identidad de género y datos de terapia hormonal — no
  tienen ningún consumidor en la app hoy más allá de lo decorativo
  (`TodayWorkoutCard.tsx` elige arte hombre/mujer), y cargar datos de
  salud sensible sin que alimenten ninguna decisión del sistema es
  riesgo de privacidad sin beneficio funcional.
- El motor de seguimiento de tendencias (peso, adherencia, entrenamiento)
  — Frente B, spec aparte.
- El bug de timezone en `getAdherenceStatus`/`relativeLogDate`
  (`lib/nutrition.ts`, usan `new Date().toISOString().split("T")[0]`) —
  no se toca en este frente porque no se modifican esas funciones acá;
  queda anotado para cuando Frente B entre a ese archivo.

## Modelo de datos

### `profiles`

```sql
alter table profiles
  add column daily_activity text check (daily_activity in ('sedentary', 'moderate', 'active')),
  add column metabolic_reference text check (metabolic_reference in ('male', 'female'));
```

- `daily_activity`: nivel de actividad fuera del gimnasio. Se pregunta
  junto a `training_frequency` en el mismo formulario de intake/edición
  de perfil físico. Nullable — un perfil sin este dato todavía puede
  calcular targets (fallback a `'moderate'`, igual que hoy
  `training_frequency` cae a `'3-4'` si falta).
- `metabolic_reference`: solo tiene sentido cuando `gender` no es
  `'male'` ni `'female'`. Lo fija el trainer explícitamente (ver punto
  3). No se infiere ni se autocompleta.

### `workout_sessions`

```sql
alter table workout_sessions
  add column duration_seconds integer;
```

Nullable — sesiones históricas y sesiones donde el cliente no reportó
duración (por ejemplo, un draft recuperado de una versión vieja de la
app) quedan en `null`, no en `0`.

### `nutrition_plans`

```sql
alter table nutrition_plans
  add column calorie_adjustment_pct numeric(5,2),
  add column protein_per_kg          numeric(4,2),
  add column fat_per_kg              numeric(4,2),
  add column needs_review            boolean not null default false,
  add column needs_review_reason     text;
```

- `calorie_adjustment_pct`, `protein_per_kg`, `fat_per_kg`: los valores
  **realmente usados** para ese plan (ya sea el default del gym o el
  override del trainer), copiados al plan en el momento de crear o
  recalcular. `target_calories/protein/carbs/fat` (ya existentes) siguen
  siendo el resultado final derivado de estos tres valores más el TDEE
  del socio.
- `needs_review` / `needs_review_reason`: resultado de la validación de
  límites de seguridad (punto 5). No bloquea el guardado.

### Nueva tabla `gym_nutrition_defaults`

```sql
create table gym_nutrition_defaults (
  gym_id                 uuid primary key references gyms(id) on delete cascade,
  volumen_pct            numeric(5,2) not null default 12,
  volumen_protein        numeric(4,2) not null default 1.8,
  rendimiento_pct        numeric(5,2) not null default 8,
  rendimiento_protein    numeric(4,2) not null default 1.8,
  mantenimiento_protein  numeric(4,2) not null default 1.7,
  recomposicion_protein  numeric(4,2) not null default 2.0,
  perdida_moderada_pct   numeric(5,2) not null default -10,
  perdida_moderada_protein numeric(4,2) not null default 2.0,
  definicion_pct         numeric(5,2) not null default -18,
  definicion_protein     numeric(4,2) not null default 2.2,
  updated_at             timestamptz not null default now()
);
```

Una fila por gym, creada con los defaults actuales de `lib/nutrition.ts`
en el momento en que el gym se crea (o con un `insert ... on conflict do
nothing` la primera vez que se pide la config, para gyms ya existentes).
RLS: lectura para cualquier miembro del gym, escritura solo
`admin`.

`mantenimiento` no tiene columna `_pct`: por definición ese objetivo usa
el TDEE sin ajuste (igual que hoy, donde el `switch` de `calcNutritionTargets`
no multiplica nada para ese caso). No es una omisión.

## Comportamiento

### 1. Actividad diaria en el TDEE

`ACTIVITY_FACTOR` deja de ser una tabla 1D indexada solo por
`training_frequency`. Pasa a una tabla 2D:

```typescript
const ACTIVITY_FACTOR: Record<string, Record<string, number>> = {
  sedentary: { never: 1.2,   "1-2": 1.3,   "3-4": 1.45,  "5+": 1.6   },
  moderate:  { never: 1.2,   "1-2": 1.375, "3-4": 1.55,  "5+": 1.725 },
  active:    { never: 1.3,   "1-2": 1.45,  "3-4": 1.65,  "5+": 1.8   },
}
```

La fila `moderate` es idéntica, valor por valor, a la tabla 1D actual
(`never: 1.2, "1-2": 1.375, "3-4": 1.55, "5+": 1.725`), para no romper el
cálculo de perfiles existentes que no cargaron `daily_activity` todavía
(caen a `moderate` por el fallback descrito abajo).

### 2. Duración real de sesión

- `WorkoutSession.tsx` captura `Date.now()` al montar el componente (una
  sola vez, primer render de la sesión activa).
- Al completar, calcula `durationSeconds = Math.round((Date.now() -
  sessionStartedAt) / 1000)` y lo manda como `p_duration_seconds` a la
  RPC `complete_workout_session`.
- La RPC guarda `duration_seconds` en la fila insertada.
- Después de insertar, la RPC cuenta las sesiones del usuario con
  `duration_seconds is not null` en las últimas 4 semanas. Si el conteo
  llega a 8 por primera vez (no estaba ya en 8+ antes de esta sesión),
  inserta una notificación (`type =
  'nutrition_duration_ready'`, `dedup_key =
  'nutrition-duration-ready:' || member_id`) dirigida al `trainer_id`
  del socio si está asignado, o a los `admin` del gym si no.
- La notificación no dispara ningún recálculo. Es informativa; el
  trainer decide si y cuándo usar el promedio de duración real para
  refinar el plan de ese socio (mecanismo de aplicación queda para
  cuando se construya, no es parte de este spec — la alerta solo dejar
  registrado que el dato ya está disponible).

### 3. Referencia metabólica para género "otro"

- Si `profile.gender` es `'male'` o `'female'`: comportamiento actual,
  sin cambios.
- Si `profile.gender` es `'other'` o `null` y `profile.metabolic_reference`
  es `null`: `calcNutritionTargets` devuelve `null`, exactamente como hoy
  hace cuando falta `weight_kg`/`height_cm`/`date_of_birth`. No inventa
  ningún intercepto promedio.
  - `missingTargetFields` se extiende para incluir
    `"referencia metabólica"` en su lista cuando aplica esta condición,
    así el warning existente en `NutritionPlanEditor.tsx`
    ("Faltan datos del socio para calcular el objetivo: ...") lo muestra
    sin necesidad de un mecanismo de estado nuevo.
  - La UI de creación/recálculo de plan muestra un selector: "Referencia
    metabólica — Masculina / Femenina", con el texto "Esto es una
    estimación matemática para la fórmula, no determina el metabolismo
    real de la persona." El trainer elige una y se guarda en
    `profile.metabolic_reference` (persiste para el socio, no hay que
    volver a preguntar en el próximo plan).
- Si `profile.gender` es `'other'` o `null` y `profile.metabolic_reference`
  ya está seteado: `calcNutritionTargets` usa el intercepto de la
  referencia elegida (`+5` para `'male'`, `-161` para `'female'`) —
  nunca un promedio.

### 4. Proteína y ajuste calórico configurables

- Pantalla de admin (`/admin`, sección nueva "Nutrición") para editar
  `gym_nutrition_defaults` — un input numérico por celda de la tabla del
  modelo de datos.
- Al crear un plan (`NutritionPlansPanel.tsx`): al elegir el objetivo, se
  precargan `calorie_adjustment_pct` y `protein_per_kg` desde
  `gym_nutrition_defaults` en dos inputs editables (no un texto fijo).
  El trainer puede dejarlos o cambiarlos antes de guardar.
- Al recalcular (`recalculateNutritionPlanTargets`): reutiliza los
  valores ya guardados en el plan (`calorie_adjustment_pct`,
  `protein_per_kg`, `fat_per_kg`) — no vuelve a los defaults del gym.
- `NutritionPlanEditor.tsx` suma una sección editable (inputs para
  `protein_per_kg` y `calorie_adjustment_pct`, junto al bloque donde hoy
  se edita `goal`/`notes` vía `updateNutritionPlan`) con un botón
  "Recalcular con estos valores". Ese botón llama a una versión
  extendida de `recalculateNutritionPlanTargets` que recibe los dos
  valores como parámetros en vez de releerlos del plan — así el trainer
  puede tanto reaplicar lo ya guardado (botón actual, sin tocar nada) como
  adoptar nuevos valores (edita los inputs y usa el botón nuevo).
- `fat_per_kg` sigue derivado del objetivo (no se expone como input en
  esta iteración — la crítica no lo señaló como problema, y agregarlo
  como tercer input no aporta sobre el problema real detectado).

### 5. Límites de seguridad

Después de calcular `target_calories`/`protein`/`carbs`/`fat` (ya sea al
crear o recalcular un plan), se corre una validación no bloqueante:

```typescript
function validateNutritionSafety(
  targets: { calories: number; protein: number },
  tmb: number,
  weightKg: number,
  adjustmentPct: number,
  proteinPerKg: number
): { needsReview: boolean; reason: string | null } {
  const reasons: string[] = []
  if (targets.calories < tmb) reasons.push("El objetivo calórico queda por debajo del metabolismo basal (TMB).")
  if (targets.calories < 1200) reasons.push("El objetivo calórico queda por debajo de 1200 kcal.")
  if (adjustmentPct < -25) reasons.push("El déficit supera el 25%.")
  if (adjustmentPct > 20) reasons.push("El superávit supera el 20%.")
  if (proteinPerKg < 1.2) reasons.push("La proteína queda por debajo de 1.2 g/kg.")
  if (proteinPerKg > 3.0) reasons.push("La proteína supera 3.0 g/kg.")
  return { needsReview: reasons.length > 0, reason: reasons.join(" ") || null }
}
```

El plan se guarda igual (`needs_review = true` y el motivo en
`needs_review_reason`). La UI del editor de plan (mismo lugar donde hoy
vive el warning de "objetivo desactualizado") muestra un aviso
equivalente cuando `needs_review` es `true`, sin impedir nada.

## Testing

- `lib/nutrition.ts` no tiene tests hoy — este spec introduce los
  primeros: tabla 2D de actividad (casos límite: falta
  `daily_activity`, falta `training_frequency`), referencia metabólica
  explícita (male/female sin cambios, other sin referencia → falta
  dato, other con referencia → usa el intercepto correcto, nunca
  promedio), y `validateNutritionSafety` (un caso por regla, más un caso
  que no dispara ninguna).
- La captura de duración en `WorkoutSession.tsx` se verifica manualmente
  (completar un entrenamiento y confirmar `duration_seconds` en la fila
  de `workout_sessions`), dado que el resto del componente no tiene
  tests automatizados y no es parte de este spec extender esa
  cobertura.
- El umbral de notificación (8 sesiones / 4 semanas) se verifica con un
  test de la función SQL usando `mcp__supabase__execute_sql` en modo
  manual durante la revisión de la tarea correspondiente, no con un test
  automatizado (no hay infraestructura de test de funciones SQL en este
  proyecto todavía).
