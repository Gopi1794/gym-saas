# Objetivo del plan nutricional: sacar "Otro", mostrar el efecto, sin preselección — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres cambios en `nutrition_plans.goal`: sacar la opción "Otro" (que hoy da targets de mantenimiento en silencio), que la etiqueta de cada objetivo muestre su efecto real (%), y que el select de creación no arranque con nada preseleccionado — mostrando además el objetivo que el socio declaró en su perfil como contexto.

**Architecture:** Una sola fuente de verdad nueva en `lib/nutrition.ts` (`NUTRITION_GOAL_OPTIONS` + `NUTRITION_GOAL_LABELS`), derivada a mano de los multiplicadores reales del switch de `calcNutritionTargets` — no se toca esa función. Los 4 archivos que hoy duplican `GOAL_LABELS` para `nutrition_plans.goal` pasan a importarla. `NutritionPlansPanel.tsx` además cambia de arquitectura: `suggestedTargets`/`missingFields` dejan de ser estado actualizado a mano y pasan a ser valores derivados en cada render — necesario para separar correctamente "el socio no tiene datos" (visible apenas se elige el socio) de "todavía no se eligió objetivo" (ya no es un error, es el estado inicial esperado).

**Tech Stack:** Sin cambios de schema. `NutritionPlan["goal"]` sigue incluyendo `"otro"` en el tipo — no se saca del tipo, solo de las opciones ofrecidas (ver Contexto, punto 1).

## Global Constraints

- No tocar `calcNutritionTargets` — ni el `case "otro"` (que no existe), ni el `default` (que sigue siendo mantenimiento como red de seguridad para valores inesperados).
- No preseleccionar ningún objetivo en el form de creación — arranca vacío, sin excepción.
- No advertir ni bloquear si el objetivo elegido por el trainer no coincide con el que el socio declaró en su perfil — son dos campos distintos a propósito.
- `getMemberProfileForPlan` gana el campo `goal` en su `select`, no se agrega un query nuevo.

---

## Contexto verificado antes de planificar

1. **Confirmé el bug de "Otro" leyendo `lib/nutrition.ts:74-106`**: el switch tiene casos para `volumen`, `definicion`, `recomposicion`, `rendimiento`, `perdida_moderada`, y `mantenimiento`+`default` comparten el mismo bloque. No hay `case "otro"` — cae directo al `default`, que es exactamente mantenimiento. Confirmado también con una consulta real a la base (`select goal from nutrition_plans`, agregada en JS): **0 planes en total en la base hoy**, así que 0 con `goal='otro'` — se saca la opción sin necesidad de backfill ni migración de datos.

   **Decisión**: `"otro"` se saca de las *opciones del select* (`NUTRITION_GOAL_OPTIONS`), pero se **mantiene** en el tipo `NutritionPlan["goal"]` (`app/actions/nutrition.ts`) — así, si alguna vez aparece una fila con ese valor (import manual, dato viejo de otro entorno), la app la sigue renderizando con el fallback `?? plan.goal` que ya usan todos los lugares que leen `goal`, en vez de que TypeScript se queje o el valor rompa algo.

2. **`GOAL_LABELS` para `nutrition_plans.goal` (vocabulario `volumen`/`definicion`/etc.) está duplicado en 4 archivos, no 2**: `NutritionPlansPanel.tsx:23-31`, `NutritionPlanEditor.tsx:36-40`, `MemberNutritionView.tsx:23-31`, `NutritionAdherencePanel.tsx:8-10` — los cuatro con el mismo contenido letra por letra. `GOAL_COLORS` y `GOAL_DESCRIPTIONS` (clases Tailwind y texto descriptivo) **no** están duplicados — solo existen en `NutritionPlansPanel.tsx` — así que esos quedan locales ahí, sin tocar, tal como pide la convención del proyecto de tipos/constantes locales por componente.

   **No confundir con `profiles.goal`** (vocabulario `lose_weight`/`gain_muscle`/`performance`/`maintain`, el objetivo que el socio elige al registrarse) — es un campo y una tabla de labels completamente distinta, ya usada en `MemberContactEdit.tsx`. Los porcentajes de CAMBIO 2 son solo para `nutrition_plans.goal`.

3. **Los números de CAMBIO 2 verificados contra el switch real** (`lib/nutrition.ts`):

   | goal | multiplicador | `label` (siempre visible) | `hint` (solo en el select de creación) |
   |---|---|---|---|
   | `volumen` | `tdee * 1.12` | Volumen | +12% |
   | `rendimiento` | `tdee * 1.08` | Rendimiento deportivo | +8% |
   | `mantenimiento` | `tdee` (sin multiplicador) | Mantenimiento | *(ninguno)* |
   | `recomposicion` | `tdee` (idéntico a mantenimiento — la diferencia real es `proteinPerKg: 2.5` vs `1.7`) | Recomposición | proteína alta |
   | `perdida_moderada` | `tdee * 0.90` | Pérdida moderada | −10% |
   | `definicion` | `tdee * 0.82` | Definición | −18% |

   Uso el signo menos tipográfico "−" (no el guión "-") en los `hint`, igual que como los escribiste.

4. **Corrección sobre la marcha, señalada en review**: la primera versión de este plan ponía el `%` directamente en `NUTRITION_GOAL_LABELS`, que Task 4 hace importar a tres componentes de solo lectura — uno de ellos, `MemberNutritionView.tsx`, es la vista del **socio**. Eso filtraba el `%` (una herramienta para que el trainer decida) a un lugar donde se vuelve una decisión de producto no tomada a propósito (¿el socio debe ver que su plan es un déficit del 18%?) y a badges compactos donde queda ruidoso (`NutritionPlanEditor.tsx`, `NutritionAdherencePanel.tsx`). Se separa en `NUTRITION_GOALS` (una sola fuente, con `label` y `hint` aparte) → `NUTRITION_GOAL_OPTIONS` (label+hint combinado, solo para el select) y `NUTRITION_GOAL_LABELS` (label a secas, para todo lo demás). Los nombres siguen sin poder divergir entre select y vistas de lectura porque salen del mismo array.

5. **Encontré un bug al planificar la no-preselección, no lo pediste pero hay que evitarlo**: si `form.goal` arranca en `""` y sigo llamando a `calcNutritionTargets(profile, goal)` con `goal=""` en cuanto se elige el socio (como hace hoy `handleMemberOrGoalChange`), el switch cae al `default` — mantenimiento, en silencio — exactamente el mismo bug de CAMBIO 1, pero disparado por "todavía no elegí objetivo" en vez de por la opción "Otro". Por eso separo el estado: **el fetch del perfil del socio (`memberProfile`) ya no depende del objetivo elegido**, y **`suggestedTargets`/`missingFields` pasan a ser valores derivados** (`memberProfile && form.goal ? calcNutritionTargets(...) : null`), no estado que se actualiza a mano — así "faltan datos del socio" (independiente del objetivo) y "no elegiste objetivo todavía" (no es un error) quedan separados en vez de mezclados en una sola condición `!suggestedTargets`.

6. **`getMemberProfileForPlan` (`app/actions/nutrition.ts:160-174`)** ya selecciona `weight_kg, height_cm, date_of_birth, gender, training_frequency` — agrego `goal` a esa misma lista y al tipo de retorno. `calcNutritionTargets` no lee `profile.goal` (usa el `goal` que se le pasa aparte, ya lo habíamos confirmado en el fix anterior), así que agregar el campo es aditivo y no cambia ningún cálculo — solo queda disponible para mostrar "El socio indicó: X".

---

## Task 1 — Fuente única en `lib/nutrition.ts`

**Files:**
- Modify: `lib/nutrition.ts`

- [ ] **Paso 1: agregar las constantes, sin tocar `calcNutritionTargets`**

Al final del archivo (después de `calcNutritionTargets`, sin modificar una sola línea de la función):

```ts
export const NUTRITION_GOALS = [
  { value: "volumen",          label: "Volumen",               hint: "+12%" },
  { value: "rendimiento",      label: "Rendimiento deportivo",  hint: "+8%" },
  { value: "mantenimiento",    label: "Mantenimiento",          hint: null },
  { value: "recomposicion",    label: "Recomposición",          hint: "proteína alta" },
  { value: "perdida_moderada", label: "Pérdida moderada",       hint: "−10%" },
  { value: "definicion",       label: "Definición",             hint: "−18%" },
] as const

// Para el select del formulario de creación — el % ayuda a decidir
export const NUTRITION_GOAL_OPTIONS: { value: NutritionPlan["goal"]; label: string }[] = NUTRITION_GOALS.map(g => ({
  value: g.value,
  label: g.hint ? `${g.label} (${g.hint})` : g.label,
}))

// Para mostrar en cualquier lugar de solo lectura (editor, panel de adherencia,
// vista del socio) — sin el %. Mostrarle a un socio que su plan es un déficit
// del 18% es una decisión de producto aparte, no algo que se hereda gratis
// de esta constante.
export const NUTRITION_GOAL_LABELS: Partial<Record<NutritionPlan["goal"], string>> = Object.fromEntries(
  NUTRITION_GOALS.map(g => [g.value, g.label])
)
```

Una sola fuente (`NUTRITION_GOALS`), dos derivadas — los nombres no pueden divergir entre el select y las vistas de lectura porque salen del mismo array, pero el `%`/aclaración solo aparece donde ayuda a decidir (el select de creación), no donde alguien simplemente lee el nombre del plan.

`NUTRITION_GOAL_LABELS` sigue siendo `Partial` a propósito: no cubre `"otro"` (no está en `NUTRITION_GOALS`), y cualquier lugar que lo indexe con `plan.goal` ya hace `NUTRITION_GOAL_LABELS[plan.goal] ?? plan.goal` — si algún día aparece una fila con `"otro"`, muestra el valor crudo en vez de romper.

- [ ] **Paso 2: verificación**

No hay UI todavía — se verifica en Task 3/4.

---

## Task 2 — `getMemberProfileForPlan` gana `goal`

**Files:**
- Modify: `app/actions/nutrition.ts`

- [ ] **Paso 1: agregar `goal` al select y al tipo de retorno**

```ts
export async function getMemberProfileForPlan(memberId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("profiles")
    .select("weight_kg, height_cm, date_of_birth, gender, training_frequency, goal")
    .eq("id", memberId)
    .single()
  return data as {
    weight_kg: number | null
    height_cm: number | null
    date_of_birth: string | null
    gender: "male" | "female" | "other" | null
    training_frequency: "never" | "1-2" | "3-4" | "5+" | null
    goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  } | null
}
```

- [ ] **Paso 2: verificación**

Se verifica en Task 3.

---

## Task 3 — `NutritionPlansPanel.tsx`: sin "Otro", labels con %, sin preselección + contexto del socio

**Files:**
- Modify: `components/nutrition/NutritionPlansPanel.tsx`

- [ ] **Paso 1: imports y constantes**

Cambiar:

```ts
import { calcNutritionTargets } from "@/lib/nutrition"
```

por:

```ts
import { calcNutritionTargets, NUTRITION_GOAL_OPTIONS, NUTRITION_GOAL_LABELS } from "@/lib/nutrition"
```

Borrar el bloque local `GOAL_LABELS` (líneas 23-31). En `GOAL_DESCRIPTIONS`, borrar la línea `otro: "",` (queda inalcanzable — `form.goal` ya no puede valer `"otro"`). `GOAL_COLORS` queda igual, con su entrada `otro` — sigue siendo alcanzable por `plan.goal` de un plan existente.

Agregar, junto a los otros consts del archivo:

```ts
const MEMBER_GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  gain_muscle: "Ganar músculo",
  performance: "Rendimiento",
  maintain: "Mantenerme",
}
```

(Vocabulario de `profiles.goal` — no se unifica con el de `nutrition_plans.goal`, son campos distintos. Mismos labels que ya usa `MemberContactEdit.tsx`; no lo comparto entre los dos porque no es el que pediste unificar y son solo 4 entradas.)

- [ ] **Paso 2: reestructurar el estado — `memberProfile` en vez de `suggestedTargets`/`missingFields` como estado propio**

Cambiar:

```ts
const [form, setForm] = useState({ memberId: "", name: "", goal: "mantenimiento" as NutritionPlan["goal"], notes: "" })
const [suggestedTargets, setSuggestedTargets] = useState<Targets>(null)
const [missingFields, setMissingFields] = useState<string[]>([])
const [loadingTargets, setLoadingTargets] = useState(false)
```

por:

```ts
const [form, setForm] = useState({ memberId: "", name: "", goal: "" as NutritionPlan["goal"] | "", notes: "" })
const [memberProfile, setMemberProfile] = useState<Awaited<ReturnType<typeof getMemberProfileForPlan>>>(null)
const [loadingProfile, setLoadingProfile] = useState(false)
```

`type Targets = ...` (línea 53) ya no se usa — borrarlo también.

- [ ] **Paso 3: `handleMemberOrGoalChange` → `handleMemberChange`, ya no depende del objetivo**

Reemplazar la función completa por:

```ts
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
```

Después de este bloque (y antes del `return`), agregar los valores derivados:

```ts
  const missingFields = memberProfile
    ? ([
        !memberProfile.weight_kg && "peso",
        !memberProfile.height_cm && "altura",
        !memberProfile.date_of_birth && "fecha de nacimiento",
      ].filter(Boolean) as string[])
    : []

  const suggestedTargets = memberProfile && form.goal ? calcNutritionTargets(memberProfile, form.goal) : null
```

- [ ] **Paso 4: `handleCreate` — guard de `form.goal` vacío**

Cambiar la primera línea de `handleCreate`:

```ts
if (!form.memberId || !form.name.trim()) return
```

por:

```ts
if (!form.memberId || !form.name.trim() || !form.goal) return
```

(Después de este `return` temprano, TypeScript angosta `form.goal` a `NutritionPlan["goal"]` — sin el `""` — así que la llamada a `createNutritionPlan(gymId, form.memberId, form.name, form.goal, ...)` sigue tipando igual que antes, sin `as`.)

- [ ] **Paso 5: el select de socio usa el nuevo handler**

Cambiar:

```tsx
<select
  value={form.memberId}
  onChange={e => {
    const id = e.target.value
    setForm(f => ({ ...f, memberId: id }))
    handleMemberOrGoalChange(id, form.goal)
  }}
  ...
```

por:

```tsx
<select
  value={form.memberId}
  onChange={e => handleMemberChange(e.target.value)}
  ...
```

- [ ] **Paso 6: el select de objetivo — sin preselección, opciones ordenadas de superávit a déficit, sin "Otro"**

Cambiar:

```tsx
<select
  value={form.goal}
  onChange={e => {
    const goal = e.target.value as NutritionPlan["goal"]
    setForm(f => ({ ...f, goal }))
    handleMemberOrGoalChange(form.memberId, goal)
  }}
  className="..."
>
  <option value="mantenimiento">Mantenimiento</option>
  <option value="volumen">Volumen</option>
  <option value="definicion">Definición</option>
  <option value="recomposicion">Recomposición</option>
  <option value="rendimiento">Rendimiento deportivo</option>
  <option value="perdida_moderada">Pérdida moderada</option>
  <option value="otro">Otro</option>
</select>
```

por:

```tsx
<select
  value={form.goal}
  onChange={e => setForm(f => ({ ...f, goal: e.target.value as NutritionPlan["goal"] | "" }))}
  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
>
  <option value="">Seleccioná un objetivo…</option>
  {NUTRITION_GOAL_OPTIONS.map(g => (
    <option key={g.value} value={g.value}>{g.label}</option>
  ))}
</select>
```

- [ ] **Paso 7: contexto del objetivo del socio + reordenar los avisos**

Justo después del bloque de `GOAL_DESCRIPTIONS[form.goal]` (que queda igual), y reemplazando todo el bloque de "Auto-calculated targets" hasta el aviso de datos faltantes:

```tsx
{loadingProfile && (
  <p className="text-xs text-zinc-500 text-center py-2">Cargando datos del socio…</p>
)}

{!loadingProfile && memberProfile && (
  <p className="text-xs text-zinc-500">
    {memberProfile.goal
      ? `El socio indicó: ${MEMBER_GOAL_LABELS[memberProfile.goal] ?? memberProfile.goal}`
      : "El socio no indicó objetivo."}
  </p>
)}

{!loadingProfile && memberProfile && missingFields.length > 0 && (
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
    <p>Faltan datos del socio para calcular el objetivo: {missingFields.join(", ")}.</p>
    <Link
      href={`/members/${form.memberId}`}
      className="mt-1.5 inline-block font-semibold underline hover:text-amber-300 transition-colors"
    >
      Completar datos del socio →
    </Link>
  </div>
)}

{suggestedTargets && (
  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
    <div className="mb-2 flex items-center gap-1.5">
      <Zap className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-xs font-semibold text-emerald-400">Targets calculados automáticamente (Mifflin-St Jeor)</span>
    </div>
    <div className="grid grid-cols-4 gap-2 text-center">
      <div>
        <p className="text-base font-black text-brand-400">{suggestedTargets.calories}</p>
        <p className="text-[10px] text-zinc-500">kcal</p>
      </div>
      <div>
        <p className="text-base font-black text-blue-400">{suggestedTargets.protein}g</p>
        <p className="text-[10px] text-zinc-500">Prot.</p>
      </div>
      <div>
        <p className="text-base font-black text-amber-400">{suggestedTargets.carbs}g</p>
        <p className="text-[10px] text-zinc-500">Carbs</p>
      </div>
      <div>
        <p className="text-base font-black text-emerald-400">{suggestedTargets.fat}g</p>
        <p className="text-[10px] text-zinc-500">Grasas</p>
      </div>
    </div>
  </div>
)}
```

Nota clave: el aviso de "faltan datos" ya **no** depende de si se eligió objetivo — aparece apenas se elige un socio con datos incompletos, aunque el trainer todavía no haya tocado el select de objetivo. El contexto "El socio indicó: X" tampoco depende del objetivo elegido — aparece apenas hay un socio seleccionado, tenga o no datos completos.

- [ ] **Paso 8: botón "Crear plan"**

Cambiar:

```tsx
disabled={isPending || !form.memberId || !form.name.trim() || !suggestedTargets || loadingTargets}
```

por:

```tsx
disabled={isPending || !form.memberId || !form.name.trim() || !suggestedTargets || loadingProfile}
```

- [ ] **Paso 9: verificación manual**

`npm run dev` → `/nutricion` → "Nuevo plan":

1. El select de objetivo arranca en "Seleccioná un objetivo…", no en "Mantenimiento". El botón "Crear plan" está deshabilitado incluso con socio y nombre cargados, hasta elegir un objetivo.
2. La opción "Otro" no aparece. El orden es Volumen (+12%), Rendimiento deportivo (+8%), Mantenimiento, Recomposición (proteína alta), Pérdida moderada (−10%), Definición (−18%).
3. Elegir un socio con `profiles.goal` cargado → aparece "El socio indicó: {su objetivo}" apenas se elige el socio, **antes** de tocar el select de objetivo.
4. Elegir un socio sin `profiles.goal` → "El socio no indicó objetivo."
5. Elegir un socio con peso/altura/fecha de nacimiento incompletos → aparece el aviso de datos faltantes apenas se elige el socio, sin haber tocado el objetivo todavía.
6. Elegir un socio con datos completos + un objetivo cualquiera → aparece la preview de targets con los números correctos para ese objetivo.
7. Elegir un objetivo que no coincida con el `profiles.goal` del socio (ej. socio indicó "Perder peso", trainer elige "Volumen") → confirmar que **no** aparece ninguna advertencia — es un caso normal, a propósito.

---

## Task 4 — Los otros 3 archivos importan la constante en vez de duplicarla

**Files:**
- Modify: `components/nutrition/NutritionPlanEditor.tsx`
- Modify: `components/nutrition/MemberNutritionView.tsx`
- Modify: `components/nutrition/NutritionAdherencePanel.tsx`

Mismo cambio en los tres — se importa con alias para no tocar ningún call site (`GOAL_LABELS[plan.goal]` sigue funcionando igual):

- [ ] **`NutritionPlanEditor.tsx`**: borrar el bloque (líneas 35-40):

```ts
// ── Goal labels ─────────────────────────────────────────────────
const GOAL_LABELS: Record<string, string> = {
  volumen: "Volumen", definicion: "Definición", mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición", rendimiento: "Rendimiento deportivo",
  perdida_moderada: "Pérdida moderada", otro: "Otro",
}
```

Agregar al import existente de `@/lib/nutrition`:

```ts
import { calcMacros, calcPlanMacros, calcNutritionTargets, NUTRITION_GOAL_LABELS as GOAL_LABELS } from "@/lib/nutrition"
```

- [ ] **`MemberNutritionView.tsx`**: borrar el bloque (líneas 23-31), agregar el import:

```ts
import { NUTRITION_GOAL_LABELS as GOAL_LABELS } from "@/lib/nutrition"
```

- [ ] **`NutritionAdherencePanel.tsx`**: borrar el bloque (líneas 8-10), agregar el mismo import.

- [ ] **Verificación manual**: `npm run dev` → abrir un plan existente en `/nutricion/[id]` (label de objetivo en el header), la vista de socio en `/nutricion` (member view), y el panel de adherencia → confirmar que los labels de objetivo se siguen viendo **igual que antes, sin el `%`** (ej. "Definición", no "Definición (−18%)") y no hay error de import. El `%` es exclusivo del select de creación en `NutritionPlansPanel.tsx`.

- [ ] **Commit**

```bash
git add lib/nutrition.ts app/actions/nutrition.ts components/nutrition/NutritionPlansPanel.tsx \
        components/nutrition/NutritionPlanEditor.tsx components/nutrition/MemberNutritionView.tsx \
        components/nutrition/NutritionAdherencePanel.tsx
git commit -m "feat: sacar 'Otro' del objetivo del plan, mostrar efecto en el label, sin preselección"
```

---

## Fuera de alcance

- No se toca `calcNutritionTargets` ni su `default`.
- No se saca `"otro"` del tipo `NutritionPlan["goal"]` — solo de las opciones ofrecidas.
- No se unifica `GOAL_COLORS`/`GOAL_DESCRIPTIONS` (no están duplicados) ni `MEMBER_GOAL_LABELS` con `MemberContactEdit.tsx` (vocabulario distinto, no fue lo que pediste unificar).
- No se agrega advertencia ni bloqueo cuando el objetivo elegido no coincide con `profiles.goal` — decisión explícita, son campos distintos.
