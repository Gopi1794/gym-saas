# Editar datos de contacto del socio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un trainer/admin pueda cargar fecha de nacimiento, teléfono, género, objetivo, frecuencia de entrenamiento y contacto de emergencia de un socio desde su ficha — hoy esa sección es de solo lectura, y por eso un socio que no cargó esos datos al registrarse queda sin forma de que alguien se los complete (lo cual bloquea la creación de su plan nutricional, arreglada en el fix anterior).

**Architecture:** Un componente nuevo (`MemberContactEdit`), estructuralmente igual a `MemberPhysicalEdit` (vista/edición con framer-motion, botón "Editar"), más una server action nueva (`updateMemberContact`) que sigue el mismo esqueleto de auth+gym-check que `updateMemberPhysical`. Reemplaza el bloque de solo-lectura "Datos de contacto" en la ficha del socio — `medical_conditions` queda afuera y sigue de solo lectura en el mismo lugar.

**Tech Stack:** Next.js Server Actions, sin cambios de schema.

## Global Constraints

- `medical_conditions` NO se toca en este formulario — dato de salud, decisión aparte.
- `date_of_birth` vacío se guarda como `null`, nunca como `""` (columna `date` en Postgres).
- `gender`, `goal`, `training_frequency` van con `<select>` de opciones acotadas — mismos value/label que `MemberRegisterForm.tsx`, no inputs libres.
- La server action verifica que el socio pertenezca al gym de quien llama, antes de actualizar (mismo patrón que `updateMemberPhysical`).

---

## Contexto verificado antes de planificar — y tres desvíos del "copiá exactamente" que quiero que confirmes

1. **`MemberPhysicalEdit.tsx` no usa toast — usa un `Alert` inline con estado local `feedback`**, y **no tiene `try/catch`** alrededor de la llamada a `updateMemberPhysical`. Vos pediste "siguiendo exactamente el patrón" pero también "manejo del error con toast" y "try/catch para fallos de red" — esas dos cosas no están en el archivo que dice seguir. Tres decisiones que tomé, cada una un desvío deliberado de la copia literal:

   - **Toast en vez de `Alert` inline**: uso `sileo` (ya es el estándar de la app después de la migración de esta sesión), no el `Alert` que usa `MemberPhysicalEdit`.
   - **`try/catch` alrededor de la action**: sin esto, si `updateMemberContact` rechaza la promesa (red, timeout, 500) en vez de resolver con `{error}`, `setLoading(false)` nunca corre — mismo bug de "pending que no sale" que ya cerramos tres veces en el plan del reenvío y una cuarta en la creación de planes. `MemberPhysicalEdit.tsx` tiene este bug latente hoy (no lo toco, no lo pediste, pero te lo marco).
   - **`router.refresh()` después de guardar**: `MemberPhysicalEdit.tsx` tampoco lo tiene — su modo vista muestra `initialWeight`/`initialHeight` (props, no el estado editado), así que después de guardar sigue mostrando el valor viejo hasta un reload manual. Sin `router.refresh()`, `MemberContactEdit` tendría el mismo problema, y directamente contradice tu pedido de "revalidar la ficha" — `revalidatePath` del lado del servidor invalida el cache para la próxima visita, pero no empuja datos nuevos a un componente ya montado; hace falta el refresh del lado del cliente para verlo sin recargar a mano.

   Confirmado: se aplican los mismos dos fixes a `MemberPhysicalEdit.tsx` — Task 3.

2. **`gender` no se selecciona hoy en la query de la ficha del socio** (`app/(dashboard)/members/[id]/page.tsx:89`) ni existe en `MemberRow`. Falta agregarlo — es el único de los 7 campos que hoy no llega a la página en absoluto.

3. **Después de reemplazar el grid de "Datos de contacto" por `MemberContactEdit`, quedan huérfanos en `page.tsx`**: el componente local `InfoCell` (líneas 364-371, sin otro uso en el archivo), los imports de íconos `Phone`, `Calendar`, `Target`, `AlertTriangle` (cada uno usado solo ahí — verificado grep por archivo, no solo por nombre suelto), y las constantes `GOAL_LABELS`/`FREQ_LABELS` (`member.goal`/`member.training_frequency` se siguen usando más abajo para `MemberWorkoutHistory`, pero como valores crudos, no mapeados). Los saco todos — dejarlos genera warnings de ESLint por variables sin usar.

4. **Opciones exactas reusadas de `MemberRegisterForm.tsx`** (líneas 292-296, 334-339, 358-362): género (`male`→"Hombre", `female`→"Mujer", `other`→"Otro"), objetivo (`lose_weight`→"Perder peso", `gain_muscle`→"Ganar músculo", `performance`→"Rendimiento", `maintain`→"Mantenerme"), frecuencia (`never`→"Nunca", `1-2`→"1-2 / sem", `3-4`→"3-4 / sem", `5+`→"5+ / sem"). Uso los mismos values y labels; el componente de registro usa un `Pill` (botones grandes, pensado para onboarding), acá van en `<select>` como pediste — mismo vocabulario, distinto control.

---

## Task 1 — Server action: `updateMemberContact`

**Files:**
- Modify: `app/actions/members.ts`

**Interfaces:**
- Produces: `updateMemberContact(input: MemberContactInput): Promise<{ error: string } | { success: true }>`

- [ ] **Paso 1: agregar el tipo y la función**, mismo esqueleto que `updateMemberPhysical` (auth → rol admin/trainer → mismo gym → update → revalidatePath):

```ts
export type MemberContactInput = {
  memberId: string
  dateOfBirth: string | null
  phone: string | null
  gender: "male" | "female" | "other" | null
  goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  trainingFrequency: "never" | "1-2" | "3-4" | "5+" | null
  emergencyName: string | null
  emergencyPhone: string | null
}

export async function updateMemberContact(input: MemberContactInput) {
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

  const { data: target } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", input.memberId)
    .single()

  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      date_of_birth: input.dateOfBirth,
      phone: input.phone,
      gender: input.gender,
      goal: input.goal,
      training_frequency: input.trainingFrequency,
      emergency_name: input.emergencyName,
      emergency_phone: input.emergencyPhone,
    } as never)
    .eq("id", input.memberId)

  if (error) return { error: error.message }

  revalidatePath(`/members/${input.memberId}`)
  return { success: true }
}
```

- [ ] **Paso 2: verificación manual**

Se verifica junto con Task 2 y 3 (Task 2 Paso 6) — no hay UI hasta entonces.

---

## Task 2 — Componente `MemberContactEdit`

**Files:**
- Create: `components/members/MemberContactEdit.tsx`

**Interfaces:**
- Consumes: `updateMemberContact` de Task 1.
- Produces: `<MemberContactEdit memberId initialDateOfBirth initialPhone initialGender initialGoal initialTrainingFrequency initialEmergencyName initialEmergencyPhone />`

- [ ] **Paso 1: crear el componente completo**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Phone, User2, Target, Activity, AlertTriangle, Pencil } from "lucide-react"
import { sileo } from "sileo"
import { updateMemberContact } from "@/app/actions/members"

type Gender = "male" | "female" | "other"
type Goal = "lose_weight" | "gain_muscle" | "performance" | "maintain"
type Frequency = "never" | "1-2" | "3-4" | "5+"

const GENDER_LABELS: Record<Gender, string> = { male: "Hombre", female: "Mujer", other: "Otro" }
const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: "Perder peso", gain_muscle: "Ganar músculo", performance: "Rendimiento", maintain: "Mantenerme",
}
const FREQUENCY_LABELS: Record<Frequency, string> = {
  never: "Nunca", "1-2": "1-2 / sem", "3-4": "3-4 / sem", "5+": "5+ / sem",
}

interface Props {
  memberId: string
  initialDateOfBirth: string | null
  initialPhone: string | null
  initialGender: Gender | null
  initialGoal: Goal | null
  initialTrainingFrequency: Frequency | null
  initialEmergencyName: string | null
  initialEmergencyPhone: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

const selectCls = "w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
const inputCls = selectCls + " placeholder-zinc-600"

export default function MemberContactEdit({
  memberId, initialDateOfBirth, initialPhone, initialGender, initialGoal,
  initialTrainingFrequency, initialEmergencyName, initialEmergencyPhone,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "")
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "")
  const [goal, setGoal] = useState<Goal | "">(initialGoal ?? "")
  const [trainingFrequency, setTrainingFrequency] = useState<Frequency | "">(initialTrainingFrequency ?? "")
  const [emergencyName, setEmergencyName] = useState(initialEmergencyName ?? "")
  const [emergencyPhone, setEmergencyPhone] = useState(initialEmergencyPhone ?? "")
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const result = await updateMemberContact({
        memberId,
        dateOfBirth: dateOfBirth || null,
        phone: phone || null,
        gender: gender || null,
        goal: goal || null,
        trainingFrequency: trainingFrequency || null,
        emergencyName: emergencyName || null,
        emergencyPhone: emergencyPhone || null,
      })
      if ("error" in result) {
        sileo.error({ title: "No se pudo guardar", description: result.error, duration: 4000 })
        return
      }
      sileo.success({ title: "Datos de contacto guardados", description: "La ficha del socio ya está actualizada.", duration: 3000 })
      setEditing(false)
      router.refresh()
    } catch {
      sileo.error({ title: "No se pudo guardar", description: "Revisá tu conexión e intentá de nuevo.", duration: 4000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Datos de contacto
        </h3>
        <button
          onClick={() => setEditing(e => !e)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[44px] text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? "Cancelar" : "Editar"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <Stat icon={<Phone className="h-4 w-4 text-brand-500" />} label="Teléfono" value={initialPhone ?? "—"} />
            <Stat icon={<Calendar className="h-4 w-4 text-brand-500" />} label="Nacimiento"
              value={initialDateOfBirth ? formatDate(initialDateOfBirth) : "—"} />
            <Stat icon={<User2 className="h-4 w-4 text-brand-500" />} label="Género"
              value={initialGender ? (GENDER_LABELS[initialGender] ?? initialGender) : "—"} />
            <Stat icon={<Target className="h-4 w-4 text-brand-500" />} label="Objetivo"
              value={initialGoal ? (GOAL_LABELS[initialGoal] ?? initialGoal) : "—"} />
            <Stat icon={<Activity className="h-4 w-4 text-brand-500" />} label="Frecuencia"
              value={initialTrainingFrequency ? (FREQUENCY_LABELS[initialTrainingFrequency] ?? initialTrainingFrequency) : "—"} />
            <Stat icon={<AlertTriangle className="h-4 w-4 text-brand-500" />} label="Emergencia"
              value={initialEmergencyName ? `${initialEmergencyName}${initialEmergencyPhone ? ` · ${initialEmergencyPhone}` : ""}` : "—"} />
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Nacimiento
                </span>
                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Phone className="h-3.5 w-3.5" />
                  Teléfono
                </span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 11 1234-5678" className={inputCls} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <User2 className="h-3.5 w-3.5" />
                  Género
                </span>
                <select value={gender} onChange={e => setGender(e.target.value as Gender | "")} className={selectCls}>
                  <option value="">Sin especificar</option>
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Target className="h-3.5 w-3.5" />
                  Objetivo
                </span>
                <select value={goal} onChange={e => setGoal(e.target.value as Goal | "")} className={selectCls}>
                  <option value="">Sin especificar</option>
                  <option value="lose_weight">Perder peso</option>
                  <option value="gain_muscle">Ganar músculo</option>
                  <option value="performance">Rendimiento</option>
                  <option value="maintain">Mantenerme</option>
                </select>
              </label>
            </div>

            <label className="space-y-1.5 block">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Activity className="h-3.5 w-3.5" />
                Frecuencia de entrenamiento
              </span>
              <select value={trainingFrequency} onChange={e => setTrainingFrequency(e.target.value as Frequency | "")} className={selectCls}>
                <option value="">Sin especificar</option>
                <option value="never">Nunca</option>
                <option value="1-2">1-2 / sem</option>
                <option value="3-4">3-4 / sem</option>
                <option value="5+">5+ / sem</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Contacto de emergencia
                </span>
                <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Nombre" className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400 opacity-0" aria-hidden="true">·</span>
                <input
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="Teléfono"
                  aria-label="Teléfono de emergencia"
                  className={inputCls}
                />
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-800/60 px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium text-zinc-100 truncate">{value}</p>
    </div>
  )
}
```

- [ ] **Paso 2: agregar `gender` a la query y al tipo de la ficha del socio**

En `app/(dashboard)/members/[id]/page.tsx`, en `MemberRow` (línea 22-31) agregar:

```ts
gender: "male" | "female" | "other" | null
```

Y en el `.select(...)` (línea 89) agregar `gender` a la lista de columnas.

- [ ] **Paso 3: reemplazar el bloque de solo lectura por el componente, sacar el código huérfano**

Reemplazar (líneas 237-258):

```tsx
{/* Contact & profile info */}
<div className="rounded-2xl border border-border bg-card p-5 space-y-4">
  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Datos de contacto</h3>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <InfoCell icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={member.phone ?? "—"} />
    ...
  </div>
  {member.medical_conditions && (...)}
</div>
```

por:

```tsx
{/* Contact & profile info */}
<MemberContactEdit
  memberId={params.id}
  initialDateOfBirth={member.date_of_birth}
  initialPhone={member.phone}
  initialGender={member.gender}
  initialGoal={member.goal as "lose_weight" | "gain_muscle" | "performance" | "maintain" | null}
  initialTrainingFrequency={member.training_frequency as "never" | "1-2" | "3-4" | "5+" | null}
  initialEmergencyName={member.emergency_name}
  initialEmergencyPhone={member.emergency_phone}
/>
{member.medical_conditions && (
  <div className="rounded-2xl border border-border bg-card p-5">
    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Condiciones médicas</p>
      <p className="text-sm text-amber-900 dark:text-amber-200">{member.medical_conditions}</p>
    </div>
  </div>
)}
```

(El box de `medical_conditions` sale de adentro de la card vieja y pasa a tener su propia card — antes vivía pegado al grid que ahora es otro componente; sigue de solo lectura, mismo contenido, mismo estilo.)

Agregar el import:

```ts
import MemberContactEdit from "@/components/members/MemberContactEdit"
```

- [ ] **Paso 4: sacar el código huérfano**

En `app/(dashboard)/members/[id]/page.tsx`:
- Sacar `Phone`, `Calendar`, `Target`, `AlertTriangle` del import de `lucide-react` (línea 4-8) — quedan sin uso en este archivo. `Activity` se queda (stats strip la sigue usando).
- Borrar las constantes `GOAL_LABELS`/`FREQ_LABELS` (líneas 43-55).
- Borrar la función `InfoCell` completa (líneas 364-371).

- [ ] **Paso 5: verificación manual**

`npm run dev` → ficha de un socio:

1. Modo vista: confirmar que los 6 `Stat` (teléfono, nacimiento, género, objetivo, frecuencia, emergencia) muestran los datos actuales o "—" si no están cargados. `medical_conditions` sigue apareciendo debajo, solo lectura, si el socio tiene algo cargado.
2. Click "Editar" → completar/cambiar fecha de nacimiento, teléfono, género, objetivo, frecuencia, contacto de emergencia → "Guardar cambios" → confirmar toast de éxito, que el modo vista vuelve solo y **sin recargar la página** ya muestra los valores nuevos (confirma que `router.refresh()` funciona).
3. Dejar la fecha de nacimiento vacía a propósito y guardar → confirmar que no tira error de tipo de columna (se guardó `null`, no `""`).
4. Cortar la red (devtools → Offline) antes de "Guardar cambios" → confirmar que el botón no queda trabado en "Guardando…", vuelve a habilitarse y aparece el toast "Revisá tu conexión e intentá de nuevo."
5. **El caso que motivó todo esto**: completar fecha de nacimiento + peso/altura (si faltaban) en un socio, ir a `/nutricion` → "Nuevo plan" → elegir ese socio → confirmar que ahora aparece la preview de targets calculados en vez del aviso de datos faltantes.

- [ ] **Paso 6: commit**

```bash
git add app/actions/members.ts components/members/MemberContactEdit.tsx "app/(dashboard)/members/[id]/page.tsx"
git commit -m "feat: permitir editar datos de contacto del socio desde su ficha"
```

---

## Task 3 — Aplicar los mismos dos fixes a `MemberPhysicalEdit.tsx`

**Files:**
- Modify: `components/members/MemberPhysicalEdit.tsx`

- [ ] **Paso 1: `try/catch` + `router.refresh()` en `handleSave`**

Agregar el import:

```ts
import { useRouter } from "next/navigation"
```

Y dentro del componente, `const router = useRouter()`. Reemplazar `handleSave` (líneas 23-39) por:

```ts
async function handleSave() {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await updateMemberPhysical({
        memberId,
        weightKg: weight ? parseFloat(weight) : null,
        heightCm: height ? parseInt(height) : null,
      })
      if (result.error) {
        setFeedback({ type: "error", msg: result.error })
      } else {
        setFeedback({ type: "success", msg: "Guardado" })
        setEditing(false)
        router.refresh()
        setTimeout(() => setFeedback(null), 3000)
      }
    } catch {
      setFeedback({ type: "error", msg: "Revisá tu conexión e intentá de nuevo." })
    } finally {
      setLoading(false)
    }
  }
```

`setLoading(false)` pasa a un `finally` — así corre pase lo que pase, incluido el rechazo de la promesa que hoy lo deja trabado.

- [ ] **Paso 2: verificación manual**

`npm run dev` → ficha de un socio → "Datos físicos" → "Editar" → cambiar el peso → "Guardar cambios" → confirmar que el modo vista, **sin recargar la página**, ya muestra el peso nuevo (antes de este fix mostraba el viejo hasta un reload manual). Repetir con la red cortada (devtools → Offline) → confirmar que el botón no queda trabado en "Guardando…".

- [ ] **Paso 3: commit**

```bash
git add components/members/MemberPhysicalEdit.tsx
git commit -m "fix: evitar botón trabado y vista desactualizada en Datos físicos"
```

---

## Fuera de alcance

- `medical_conditions` no se toca — sigue de solo lectura, sin componente de edición.
- No se agrega validación de formato para teléfono — mismo criterio que el resto de la app (campo de texto libre).
