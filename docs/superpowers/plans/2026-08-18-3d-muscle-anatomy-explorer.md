# Explorador de Anatomía 3D — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un explorador de anatomía 3D rotable al plan de entrenamiento: tocar una muscle card abre el cuerpo en 3D centrado en ese músculo, con Origen/Inserción/Función y ejercicios recomendados reales de la base.

**Architecture:** Se extrae la data de músculos (hoy privada de `PlanEditor.tsx`) a un módulo compartido `lib/muscle-anatomy.ts`. Un script de Node (`scripts/build-anatomy-model.ts`, `gltf-transform`) cura el modelo completo de Z-Anatomy (158MB) a un `.glb` liviano con solo los 19 músculos que ya usa la app, servido como asset estático de Next.js. Un nuevo componente `MuscleAnatomy3D` (React Three Fiber) renderiza ese `.glb`, maneja cámara/interacción, y un `MuscleDetailSheet` muestra el contenido — todo montado desde `PlanEditor.tsx`.

**Tech Stack:** Next.js 14 (App Router), React Three Fiber + `@react-three/drei`, `@gltf-transform/core`/`functions` (solo para el script de build), Vitest, Framer Motion (ya en el proyecto).

**Spec:** `docs/superpowers/specs/2026-08-18-3d-muscle-anatomy-explorer-design.md`

## Global Constraints

- El `.glb` final debe pesar entre 2-3MB, nunca más de 5MB (spec, sección "Pipeline del asset 3D").
- Sin fetch de red nuevo para los ejercicios recomendados — se reusa la lista de `exercises` que `PlanEditor` ya tiene cargada (spec, "Modelo de datos").
- Sin badge de dificultad en las cards de ejercicio (fuera de alcance, spec "No objetivos").
- El modelo 3D vive en `public/models/`, no en Supabase Storage (spec, "Pipeline del asset 3D").
- Todo texto de UI en español rioplatense, mismo tono que el resto de la app.
- Conventional commits, sin atribución de IA (CLAUDE.md del proyecto).

---

## Task 1: Extraer la data de músculos a un módulo compartido

**Files:**
- Create: `lib/muscle-anatomy.ts`
- Create: `components/planes/MuscleIcon.tsx`
- Modify: `components/planes/PlanEditor.tsx:66-264` (borrar las definiciones movidas, importarlas)
- Test: `lib/muscle-anatomy.test.ts`

**Interfaces:**
- Produces: `MuscleZone` (union type), `MuscleStatus` (union type), `MUSCLE_META`, `MUSCLE_ZONE_IMAGE`, `normalizeMuscle(muscle: string): string`, `getMuscleMeta(muscle: string): { zone: MuscleZone; range: [number, number] }`, `getMuscleStatus(sets: number, range: [number, number]): MuscleStatus`, `statusLabel(status: MuscleStatus): string`, `statusPillClass(status: MuscleStatus): string`, `progressColor(percent: number): string` — todos exportados desde `lib/muscle-anatomy.ts`.
- Produces: `MuscleIcon`, `MuscleSilhouette` componentes exportados desde `components/planes/MuscleIcon.tsx`.

- [ ] **Step 1: Escribir el test que fija el contrato del módulo**

```ts
// lib/muscle-anatomy.test.ts
import { describe, it, expect } from "vitest"
import {
  normalizeMuscle,
  getMuscleMeta,
  getMuscleStatus,
  statusLabel,
  statusPillClass,
  progressColor,
  MUSCLE_META,
  MUSCLE_ZONE_IMAGE,
} from "./muscle-anatomy"

describe("normalizeMuscle", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizeMuscle("  Pecho ")).toBe("pecho")
  })
})

describe("getMuscleMeta", () => {
  it("resuelve un músculo conocido", () => {
    expect(getMuscleMeta("Bíceps")).toEqual({ zone: "biceps", range: [8, 16] })
  })

  it("cae a core con rango default para un músculo desconocido", () => {
    expect(getMuscleMeta("musculo-inventado")).toEqual({ zone: "core", range: [8, 16] })
  })
})

describe("getMuscleStatus", () => {
  it("clasifica bajo, ligeramente bajo, óptimo y alto", () => {
    expect(getMuscleStatus(2, [8, 16])).toBe("low")
    expect(getMuscleStatus(7, [8, 16])).toBe("slightly-low")
    expect(getMuscleStatus(12, [8, 16])).toBe("optimal")
    expect(getMuscleStatus(20, [8, 16])).toBe("high")
  })
})

describe("statusLabel / statusPillClass", () => {
  it("devuelven un label y una clase para cada status", () => {
    expect(statusLabel("low")).toBe("BAJO")
    expect(statusPillClass("optimal")).toContain("emerald")
  })
})

describe("progressColor", () => {
  it("es verde puro en 0% y rojo puro en 100%", () => {
    expect(progressColor(0)).toBe("hsl(120, 70%, 40%)")
    expect(progressColor(100)).toBe("hsl(0, 70%, 40%)")
  })
})

describe("MUSCLE_META / MUSCLE_ZONE_IMAGE", () => {
  it("toda entrada de MUSCLE_ZONE_IMAGE tiene una zona presente en MUSCLE_META", () => {
    const zonesInMeta = new Set(Object.values(MUSCLE_META).map(m => m.zone))
    for (const zone of Object.keys(MUSCLE_ZONE_IMAGE)) {
      expect(zonesInMeta.has(zone as never)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run lib/muscle-anatomy.test.ts`
Expected: FAIL — `Cannot find module './muscle-anatomy'`

- [ ] **Step 3: Crear `lib/muscle-anatomy.ts` moviendo el contenido exacto de `PlanEditor.tsx`**

Copiar tal cual (sin cambios de comportamiento) las líneas 66-181 actuales de `components/planes/PlanEditor.tsx` (el bloque desde `type MuscleZone = ...` hasta el cierre de `const MUSCLE_ZONE_IMAGE`, incluyendo `MuscleStatus`, `MUSCLE_META`, `normalizeMuscle`, `getMuscleMeta`, `getMuscleStatus`, `statusLabel`, `statusPillClass`, `progressColor` y `MUSCLE_ZONE_IMAGE`) a un archivo nuevo:

```ts
// lib/muscle-anatomy.ts
export type MuscleZone = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "obliques" | "traps" | "rhomboids" | "lower_back" | "soleus" | "serratus" | "pec_minor" | "rear_delts" | "front_delts"
export type MuscleStatus = "low" | "slightly-low" | "optimal" | "high"

export const MUSCLE_META: Record<string, { zone: MuscleZone; range: [number, number] }> = {
  // Pecho
  pecho:             { zone: "chest",       range: [10, 20] },
  pectoral:          { zone: "chest",       range: [10, 20] },
  pectorales:        { zone: "chest",       range: [10, 20] },
  "pectoral menor":  { zone: "pec_minor",   range: [6,  12] },
  serratos:          { zone: "serratus",    range: [6,  12] },
  // Espalda
  espalda:           { zone: "back",        range: [10, 20] },
  dorsal:            { zone: "back",        range: [10, 20] },
  dorsales:          { zone: "back",        range: [10, 20] },
  "dorsal ancho":    { zone: "back",        range: [10, 20] },
  trapecio:          { zone: "traps",       range: [8,  16] },
  trapecios:         { zone: "traps",       range: [8,  16] },
  romboides:         { zone: "rhomboids",   range: [6,  14] },
  "espalda media":   { zone: "rhomboids",   range: [6,  14] },
  lumbar:            { zone: "lower_back",  range: [6,  12] },
  lumbares:          { zone: "lower_back",  range: [6,  12] },
  "erector espinal": { zone: "lower_back",  range: [6,  12] },
  // Hombros
  hombros:               { zone: "shoulders",  range: [10, 18] },
  deltoides:             { zone: "shoulders",  range: [10, 18] },
  "deltoides lateral":   { zone: "shoulders",  range: [10, 18] },
  "deltoides anterior":  { zone: "front_delts",range: [8,  16] },
  "deltoides posterior": { zone: "rear_delts", range: [8,  16] },
  // Brazos
  biceps:   { zone: "biceps",   range: [8, 16] },
  bíceps:   { zone: "biceps",   range: [8, 16] },
  triceps:  { zone: "triceps",  range: [8, 16] },
  tríceps:  { zone: "triceps",  range: [8, 16] },
  // Core
  abdomen:     { zone: "core",     range: [6, 14] },
  abdominales: { zone: "core",     range: [6, 14] },
  core:        { zone: "core",     range: [6, 14] },
  oblicuos:    { zone: "obliques", range: [6, 14] },
  // Piernas
  cuadriceps:     { zone: "quads",      range: [10, 20] },
  cuádriceps:     { zone: "quads",      range: [10, 20] },
  aductores:      { zone: "quads",      range: [8,  16] },
  isquiotibiales: { zone: "hamstrings", range: [8,  16] },
  femorales:      { zone: "hamstrings", range: [8,  16] },
  gluteos:        { zone: "glutes",     range: [8,  16] },
  glúteos:        { zone: "glutes",     range: [8,  16] },
  pantorrillas:   { zone: "calves",     range: [8,  16] },
  gemelos:        { zone: "calves",     range: [8,  16] },
  soleo:          { zone: "soleus",     range: [6,  14] },
  sóleo:          { zone: "soleus",     range: [6,  14] },
}

export function normalizeMuscle(muscle: string) {
  return muscle.trim().toLowerCase()
}

export function getMuscleMeta(muscle: string) {
  return MUSCLE_META[normalizeMuscle(muscle)] ?? { zone: "core" as MuscleZone, range: [8, 16] as [number, number] }
}

export function getMuscleStatus(sets: number, [min, max]: [number, number]): MuscleStatus {
  if (sets > max) return "high"
  if (sets >= min) return "optimal"
  if (sets >= Math.max(1, Math.round(min * 0.75))) return "slightly-low"
  return "low"
}

export function statusLabel(status: MuscleStatus) {
  return {
    low: "BAJO",
    "slightly-low": "LIGERAMENTE BAJO",
    optimal: "ÓPTIMO",
    high: "ALTO",
  }[status]
}

export function statusPillClass(status: MuscleStatus) {
  return {
    low: "bg-red-100 dark:bg-red-500/15 text-red-500",
    "slightly-low": "bg-amber-100 dark:bg-amber-500/15 text-amber-500",
    optimal: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-500",
    high: "bg-orange-100 dark:bg-orange-500/15 text-orange-500",
  }[status]
}

/**
 * Verde en 0% -> rojo en 100%, pasando por amarillo, como un gauge.
 * Luminosidad baja (40%) a propósito: al 50% da amarillo, que en 50%L
 * pierde casi todo el contraste como texto sobre fondo blanco.
 */
export function progressColor(percent: number) {
  const t = Math.max(0, Math.min(1, percent / 100))
  return `hsl(${120 * (1 - t)}, 70%, 40%)`
}

export const MUSCLE_ZONE_IMAGE: Record<MuscleZone, string> = {
  shoulders:   "1.png",   // Deltoides lateral
  chest:       "2.png",   // Pectorales
  triceps:     "3.png",   // Tríceps
  core:        "5.png",   // Abdominales
  obliques:    "6.png",   // Oblicuos
  front_delts: "7.png",   // Deltoides anterior
  calves:      "8.png",   // Gemelos
  back:        "10.png",  // Dorsal ancho
  traps:       "11.png",  // Trapecio
  quads:       "14.png",  // Cuádriceps + Aductores
  biceps:      "16.png",  // Bíceps
  rhomboids:   "20.png",  // Romboides + Espalda media
  hamstrings:  "22.png",  // Isquiotibiales + Glúteos
  lower_back:  "23.png",  // Lumbar / Erector espinal
  soleus:      "24.png",  // Sóleo + Gemelos
  serratus:    "25.png",  // Serratos + Oblicuos
  pec_minor:   "26.png",  // Pectoral menor
  rear_delts:  "27.png",  // Deltoides posterior
  glutes:      "28.png",  // Glúteos
}
```

- [ ] **Step 4: Crear `components/planes/MuscleIcon.tsx` moviendo `MuscleIcon` y `MuscleSilhouette`**

```tsx
// components/planes/MuscleIcon.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { MUSCLE_ZONE_IMAGE, type MuscleZone } from "@/lib/muscle-anatomy"

export function MuscleIcon({ zone, className }: { zone: MuscleZone; className?: string }) {
  const [failed, setFailed] = useState(false)
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/muscles/${MUSCLE_ZONE_IMAGE[zone]}`
  if (failed) return <MuscleSilhouette zone={zone} className={className} />
  return (
    <img
      src={url}
      alt={zone}
      className={cn("object-contain", className)}
      onError={() => setFailed(true)}
    />
  )
}

export function MuscleSilhouette({ zone, className }: { zone: MuscleZone; className?: string }) {
  const active = (target: MuscleZone | MuscleZone[]) => {
    const targets = Array.isArray(target) ? target : [target]
    return targets.includes(zone)
  }

  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500/60">
        <circle cx="32" cy="10" r="6" fill="currentColor" className="text-zinc-500/45" />
        <path d="M25 20h14l5 23-4 26H24l-4-26 5-23Z" fill="currentColor" className="text-zinc-500/35" />
        <path d="M24 25 12 37M40 25l12 12M24 69l-7 20M40 69l7 20" strokeWidth="7" />
      </g>
      <g className="text-red-500 drop-shadow-[0_0_7px_rgba(239,68,68,0.7)]" fill="currentColor" opacity="0.95">
        {active("shoulders") && (
          <>
            <circle cx="22" cy="25" r="5" />
            <circle cx="42" cy="25" r="5" />
          </>
        )}
        {active("chest") && (
          <>
            <path d="M25 28c4-4 10-4 14 0l-2 11H27l-2-11Z" />
            <path d="M32 28v12" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
          </>
        )}
        {active("back") && <path d="M23 25c5 4 13 4 18 0l2 20c-7 5-15 5-22 0l2-20Z" />}
        {active("biceps") && (
          <>
            <path d="M15 36c5 2 7 9 4 15l-5-2c2-5 1-9-3-12l4-1Z" />
            <path d="M49 36c-5 2-7 9-4 15l5-2c-2-5-1-9 3-12l-4-1Z" />
          </>
        )}
        {active("triceps") && (
          <>
            <path d="M18 42c4 4 4 11 1 17l-5-2c2-5 2-10 0-14l4-1Z" />
            <path d="M46 42c-4 4-4 11-1 17l5-2c-2-5-2-10 0-14l-4-1Z" />
          </>
        )}
        {active("core") && <path d="M27 42h10l2 16H25l2-16Z" />}
        {active("glutes") && (
          <>
            <path d="M24 60c4-3 7-3 8 2v7h-8v-9Z" />
            <path d="M40 60c-4-3-7-3-8 2v7h8v-9Z" />
          </>
        )}
        {active("quads") && (
          <>
            <path d="M24 70h8l-2 19h-7l1-19Z" />
            <path d="M40 70h-8l2 19h7l-1-19Z" />
          </>
        )}
        {active("hamstrings") && (
          <>
            <path d="M23 69h7l-1 19h-7l1-19Z" />
            <path d="M41 69h-7l1 19h7l-1-19Z" />
          </>
        )}
        {active("calves") && (
          <>
            <path d="M22 82h7l-1 11h-8l2-11Z" />
            <path d="M42 82h-7l1 11h8l-2-11Z" />
          </>
        )}
      </g>
    </svg>
  )
}
```

- [ ] **Step 5: Actualizar `PlanEditor.tsx` para importar en vez de definir**

Borrar las líneas 66-264 actuales (todo el bloque `MuscleZone` → `MuscleSilhouette`) y en su lugar agregar el import, junto al resto de imports del archivo:

```ts
import { MuscleIcon } from "@/components/planes/MuscleIcon"
import {
  type MuscleZone,
  MUSCLE_META,
  normalizeMuscle,
  getMuscleMeta,
  getMuscleStatus,
  statusLabel,
  statusPillClass,
  progressColor,
} from "@/lib/muscle-anatomy"
```

`normalizeMuscle` y `MuscleZone` puede que no se usen directamente en `PlanEditor.tsx` después de la extracción (se usan indirectamente vía `getMuscleMeta`) — si TypeScript marca el import como no usado, sacarlo del import en vez de dejarlo.

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npx vitest run lib/muscle-anatomy.test.ts`
Expected: PASS (5 test suites, todos verdes)

- [ ] **Step 7: Verificar que `PlanEditor.tsx` sigue compilando y el resto de sus tests (si existen) pasan**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos relacionados a `PlanEditor.tsx` ni a los archivos nuevos.

- [ ] **Step 8: Commit**

```bash
git add lib/muscle-anatomy.ts lib/muscle-anatomy.test.ts components/planes/MuscleIcon.tsx components/planes/PlanEditor.tsx
git commit -m "refactor(entrenamiento): extraer datos de musculos a lib/muscle-anatomy compartido"
```

---

## Task 2: Agregar el contenido anatómico y el mapeo a nodos del modelo 3D

**Files:**
- Modify: `lib/muscle-anatomy.ts`
- Modify: `lib/muscle-anatomy.test.ts`

**Interfaces:**
- Consumes: `MuscleZone` (de Task 1).
- Produces: `type MuscleAnatomyEntry`, `const MUSCLE_ANATOMY: Record<MuscleZone, MuscleAnatomyEntry>` — usados por el script de curación (Task 4) y por `MuscleAnatomy3D`/`MuscleDetailSheet` (Tasks 5-6).

- [ ] **Step 1: Escribir el test que fija el contrato de `MUSCLE_ANATOMY`**

Agregar a `lib/muscle-anatomy.test.ts`:

```ts
import { MUSCLE_ANATOMY } from "./muscle-anatomy"

describe("MUSCLE_ANATOMY", () => {
  const ALL_ZONES: (keyof typeof MUSCLE_ANATOMY)[] = [
    "chest", "pec_minor", "biceps", "triceps", "shoulders", "front_delts",
    "rear_delts", "back", "traps", "rhomboids", "serratus", "core",
    "obliques", "quads", "hamstrings", "glutes", "calves", "soleus", "lower_back",
  ]

  it("tiene una entrada para cada una de las 19 zonas", () => {
    for (const zone of ALL_ZONES) {
      expect(MUSCLE_ANATOMY[zone]).toBeDefined()
    }
    expect(Object.keys(MUSCLE_ANATOMY)).toHaveLength(19)
  })

  it("cada entrada tiene todos los campos de texto no vacíos", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(entry.zone).toBe(zone)
      expect(entry.displayName.length).toBeGreaterThan(0)
      expect(entry.category.length).toBeGreaterThan(0)
      expect(entry.origen.length).toBeGreaterThan(0)
      expect(entry.insercion.length).toBeGreaterThan(0)
      expect(entry.funcion.length).toBeGreaterThan(0)
    }
  })

  it("cada entrada tiene al menos un nodo del modelo 3D y una posición 3D", () => {
    for (const zone of ALL_ZONES) {
      const entry = MUSCLE_ANATOMY[zone]
      expect(entry.nodeNames.length).toBeGreaterThan(0)
      expect(entry.pointPosition).toHaveLength(3)
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run lib/muscle-anatomy.test.ts`
Expected: FAIL — `MUSCLE_ANATOMY is not exported`

- [ ] **Step 3: Agregar `MuscleAnatomyEntry` y `MUSCLE_ANATOMY` a `lib/muscle-anatomy.ts`**

Los `nodeNames` y `pointPosition` salen del mapeo resuelto contra el modelo real de Z-Anatomy (`Startup.gltf`) durante el spike de esta feature — son los nombres de nodo y la traslación (`translation`) del nodo `.l` (o `.el`) de cada músculo. El contenido de Origen/Inserción/Función es kinesiología estándar.

```ts
export type MuscleAnatomyEntry = {
  zone: MuscleZone
  displayName: string
  category: string
  origen: string
  insercion: string
  funcion: string
  nodeNames: string[]
  pointPosition: [number, number, number]
}

export const MUSCLE_ANATOMY: Record<MuscleZone, MuscleAnatomyEntry> = {
  chest: {
    zone: "chest",
    displayName: "Pectoral Mayor",
    category: "Pecho / Torso anterior",
    origen: "Clavícula, esternón y cartílagos costales de las primeras 6 costillas",
    insercion: "Cresta del tubérculo mayor del húmero",
    funcion: "Aducción, flexión y rotación interna del brazo",
    nodeNames: ["Pectoralis major muscle.el", "Pectoralis major muscle.er"],
    pointPosition: [0.19172227420787635, 1.3195691289398854, -0.016229230919791192],
  },
  pec_minor: {
    zone: "pec_minor",
    displayName: "Pectoral Menor",
    category: "Pecho / Torso anterior (capa profunda)",
    origen: "Costillas 3ª a 5ª, cerca de sus cartílagos costales",
    insercion: "Apófisis coracoides de la escápula",
    funcion: "Estabiliza y desciende la escápula; eleva las costillas en inspiración forzada",
    nodeNames: ["Pectoralis minor muscle.l", "Pectoralis minor muscle.r"],
    pointPosition: [0.10999276842227768, 1.334290886982461, 0.037255869761520816],
  },
  biceps: {
    zone: "biceps",
    displayName: "Bíceps Braquial",
    category: "Brazo anterior",
    origen: "Cabeza larga: tubérculo supraglenoideo de la escápula. Cabeza corta: apófisis coracoides",
    insercion: "Tuberosidad del radio y fascia del antebrazo (aponeurosis bicipital)",
    funcion: "Flexión del codo y supinación del antebrazo",
    nodeNames: ["Biceps brachii muscle.el", "Biceps brachii muscle.er"],
    pointPosition: [0.23465213643052407, 1.0637427072618018, -0.019650323790571106],
  },
  triceps: {
    zone: "triceps",
    displayName: "Tríceps Braquial",
    category: "Brazo posterior",
    origen: "Cabeza larga: tubérculo infraglenoideo de la escápula. Cabezas lateral y medial: cara posterior del húmero",
    insercion: "Olécranon del cúbito",
    funcion: "Extensión del codo",
    nodeNames: ["Triceps brachii muscle.el", "Triceps brachii muscle.er"],
    pointPosition: [0.21067643435714256, 1.1009191564432754, -0.053656613130917095],
  },
  shoulders: {
    zone: "shoulders",
    displayName: "Deltoides Lateral",
    category: "Hombro",
    origen: "Cara lateral del acromion",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Abducción del brazo (elevación lateral)",
    nodeNames: ["Acromial part of deltoid muscle.l", "Acromial part of deltoid muscle.r"],
    pointPosition: [0.20313743662940453, 1.3671288937671426, -0.03053530392370432],
  },
  front_delts: {
    zone: "front_delts",
    displayName: "Deltoides Anterior",
    category: "Hombro",
    origen: "Tercio lateral de la clavícula",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Flexión y rotación interna del brazo",
    nodeNames: ["Clavicular part of deltoid muscle.l", "Clavicular part of deltoid muscle.r"],
    pointPosition: [0.15897937783835014, 1.3779676942286094, -0.003568909958264782],
  },
  rear_delts: {
    zone: "rear_delts",
    displayName: "Deltoides Posterior",
    category: "Hombro",
    origen: "Espina de la escápula",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Extensión y rotación externa del brazo",
    nodeNames: ["Scapular spinal part of deltoid muscle.l", "Scapular spinal part of deltoid muscle.r"],
    pointPosition: [0.18292278847025267, 1.3422717108136912, -0.06701088895108337],
  },
  back: {
    zone: "back",
    displayName: "Dorsal Ancho",
    category: "Espalda",
    origen: "Vértebras torácicas bajas, lumbares, sacro y cresta ilíaca",
    insercion: "Corredera bicipital del húmero",
    funcion: "Aducción, extensión y rotación interna del brazo",
    nodeNames: ["Latissimus dorsi muscle.l", "Latissimus dorsi muscle.r"],
    pointPosition: [0.06625735557205614, 1.0880115433832303, -0.06930657631808373],
  },
  traps: {
    zone: "traps",
    displayName: "Trapecio",
    category: "Espalda alta / Cuello",
    origen: "Base del cráneo y apófisis espinosas de las vértebras cervicales y torácicas",
    insercion: "Clavícula, acromion y espina de la escápula",
    funcion: "Eleva, retrae y rota la escápula según la porción activada",
    nodeNames: [
      "Ascending part of trapezius muscle.l", "Ascending part of trapezius muscle.r",
      "Descending part of trapezius muscle.l", "Descending part of trapezius muscle.r",
      "Transverse part of trapezius muscle.l", "Transverse part of trapezius muscle.r",
    ],
    pointPosition: [0.038053877439899186, 1.312265076796196, -0.10428806525999343],
  },
  rhomboids: {
    zone: "rhomboids",
    displayName: "Romboides",
    category: "Espalda media",
    origen: "Apófisis espinosas de C7 a T5",
    insercion: "Borde medial de la escápula",
    funcion: "Retrae y eleva la escápula",
    nodeNames: [
      "Rhomboid major muscle.l", "Rhomboid major muscle.r",
      "Rhomboid minor muscle.l", "Rhomboid minor muscle.r",
    ],
    pointPosition: [0.029562645829892098, 1.362468691760047, -0.09965517394455112],
  },
  serratus: {
    zone: "serratus",
    displayName: "Serrato Anterior",
    category: "Costado del torso",
    origen: "Cara externa de las costillas 1ª a 8ª/9ª",
    insercion: "Borde medial de la escápula (cara costal)",
    funcion: "Protrae la escápula y la estabiliza contra la caja torácica",
    nodeNames: ["Serratus anterior muscle.l", "Serratus anterior muscle.r"],
    pointPosition: [0.11495263490071883, 1.303064749991727, -0.03244206098166119],
  },
  core: {
    zone: "core",
    displayName: "Recto Abdominal",
    category: "Abdomen",
    origen: "Cresta púbica y sínfisis del pubis",
    insercion: "Cartílagos costales de las costillas 5ª a 7ª y apófisis xifoides",
    funcion: "Flexión del tronco",
    nodeNames: ["Rectus abdominis muscle.l", "Rectus abdominis muscle.r"],
    pointPosition: [0.04097413469655631, 1.1085009158926376, 0.09763856169489013],
  },
  obliques: {
    zone: "obliques",
    displayName: "Oblicuo Externo",
    category: "Abdomen lateral",
    origen: "Cara externa de las costillas 5ª a 12ª",
    insercion: "Cresta ilíaca y línea alba",
    funcion: "Flexión lateral y rotación del tronco",
    nodeNames: ["External abdominal oblique muscle.l", "External abdominal oblique muscle.r"],
    pointPosition: [0.063744249278888, 1.0711176136119518, 0.07793664444504456],
  },
  quads: {
    zone: "quads",
    displayName: "Cuádriceps",
    category: "Muslo anterior",
    origen: "Ilion (recto femoral) y fémur (vastos)",
    insercion: "Tuberosidad tibial vía tendón rotuliano",
    funcion: "Extensión de la rodilla",
    nodeNames: ["Quadriceps femoris muscle.el", "Quadriceps femoris muscle.er"],
    pointPosition: [0.08563427762449105, 0.45788656336729505, 0.012444187662544872],
  },
  hamstrings: {
    zone: "hamstrings",
    displayName: "Isquiotibiales",
    category: "Muslo posterior",
    origen: "Tuberosidad isquiática",
    insercion: "Cabeza del peroné (bíceps femoral) y cara medial de la tibia (semitendinoso/semimembranoso)",
    funcion: "Flexión de la rodilla y extensión de la cadera",
    nodeNames: [
      "Biceps femoris muscle.el", "Biceps femoris muscle.er",
      "Semitendinosus muscle.l", "Semitendinosus muscle.r",
      "Semimembranosus muscle.l", "Semimembranosus muscle.r",
    ],
    pointPosition: [0.1183620376264245, 0.40985578499659603, -0.04595087321785117],
  },
  glutes: {
    zone: "glutes",
    displayName: "Glúteo Mayor",
    category: "Cadera",
    origen: "Ilion posterior, sacro y ligamento sacrotuberoso",
    insercion: "Tracto iliotibial y línea áspera del fémur",
    funcion: "Extensión y rotación externa de la cadera",
    nodeNames: ["Gluteus maximus muscle.l", "Gluteus maximus muscle.r"],
    pointPosition: [0.07832767939156215, 0.8527824780495955, -0.06686435346525538],
  },
  calves: {
    zone: "calves",
    displayName: "Gastrocnemio",
    category: "Pantorrilla",
    origen: "Cóndilos femorales medial y lateral",
    insercion: "Calcáneo vía tendón de Aquiles",
    funcion: "Flexión plantar del tobillo y flexión de la rodilla",
    nodeNames: [
      "Lateral head of gastrocnemius.l", "Lateral head of gastrocnemius.r",
      "Medial head of gastrocnemius.l", "Medial head of gastrocnemius.r",
    ],
    pointPosition: [0.10594226209682, 0.3656616159319598, -0.07409787124401496],
  },
  soleus: {
    zone: "soleus",
    displayName: "Sóleo",
    category: "Pantorrilla profunda",
    origen: "Cara posterior de la tibia y el peroné",
    insercion: "Calcáneo vía tendón de Aquiles",
    funcion: "Flexión plantar del tobillo (independiente de la posición de la rodilla)",
    nodeNames: ["Soleus muscle.l", "Soleus muscle.r"],
    pointPosition: [0.085938707574306, 0.28455447407854784, -0.05818861340975501],
  },
  lower_back: {
    zone: "lower_back",
    displayName: "Erector Espinal",
    category: "Espalda baja",
    origen: "Sacro, cresta ilíaca y apófisis espinosas lumbares",
    insercion: "Costillas, apófisis transversas y base del cráneo, según el fascículo",
    funcion: "Extensión de la columna vertebral",
    nodeNames: ["Erector spinae.ol", "Erector spinae.or"],
    pointPosition: [0.046878314102694385, 0.9678699957795948, -0.06814057182037628],
  },
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run lib/muscle-anatomy.test.ts`
Expected: PASS (8 test suites en total)

- [ ] **Step 5: Commit**

```bash
git add lib/muscle-anatomy.ts lib/muscle-anatomy.test.ts
git commit -m "feat(entrenamiento): agregar contenido anatomico y mapeo de nodos 3D por musculo"
```

---

## Task 3: Helper de ejercicios recomendados por músculo

**Files:**
- Create: `lib/muscle-exercises.ts`
- Test: `lib/muscle-exercises.test.ts`
- Modify: `components/planes/PlanEditor.tsx:26-30` (borrar el `type Exercise` local, importarlo desde `lib/muscle-exercises.ts`)

**Interfaces:**
- Consumes: `MuscleZone`, `getMuscleMeta` (de Task 1).
- Produces: `type Exercise` (`{ id, name, category, image_url, muscle_groups, is_timed }`), `getExercisesForZone(zone: MuscleZone, exercises: Exercise[]): Exercise[]` — usado por `MuscleDetailSheet` (Task 5) y por `PlanEditor.tsx` (Task 7), que pasa a importar `Exercise` desde acá en vez de declararlo localmente (hoy está duplicado con el mismo shape en `PlanEditor.tsx:26-30` — se unifica en una sola fuente).

- [ ] **Step 1: Escribir el test**

```ts
// lib/muscle-exercises.test.ts
import { describe, it, expect } from "vitest"
import { getExercisesForZone, type Exercise } from "./muscle-exercises"

const EXERCISES: Exercise[] = [
  { id: "1", name: "Press de banca", category: "Fuerza", image_url: null, muscle_groups: ["Pecho", "Tríceps"], is_timed: false },
  { id: "2", name: "Curl de bíceps", category: "Fuerza", image_url: null, muscle_groups: ["Bíceps"], is_timed: false },
  { id: "3", name: "Plancha", category: "Core", image_url: null, muscle_groups: ["Core"], is_timed: true },
]

describe("getExercisesForZone", () => {
  it("devuelve los ejercicios cuyo muscle_groups matchea la zona", () => {
    const result = getExercisesForZone("chest", EXERCISES)
    expect(result.map(e => e.id)).toEqual(["1"])
  })

  it("un ejercicio puede aparecer en más de una zona", () => {
    const result = getExercisesForZone("triceps", EXERCISES)
    expect(result.map(e => e.id)).toEqual(["1"])
  })

  it("devuelve array vacío si ningún ejercicio matchea", () => {
    expect(getExercisesForZone("soleus", EXERCISES)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run lib/muscle-exercises.test.ts`
Expected: FAIL — `Cannot find module './muscle-exercises'`

- [ ] **Step 3: Implementar**

```ts
// lib/muscle-exercises.ts
import { getMuscleMeta, type MuscleZone } from "./muscle-anatomy"

export type Exercise = {
  id: string
  name: string
  category: string
  image_url: string | null
  muscle_groups: string[]
  is_timed: boolean
}

export function getExercisesForZone(zone: MuscleZone, exercises: Exercise[]): Exercise[] {
  return exercises.filter(exercise =>
    (exercise.muscle_groups ?? []).some(muscle => getMuscleMeta(muscle).zone === zone)
  )
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run lib/muscle-exercises.test.ts`
Expected: PASS

- [ ] **Step 5: Unificar el tipo `Exercise` en `PlanEditor.tsx`**

Borrar la declaración local en `components/planes/PlanEditor.tsx:26-30`:

```ts
// borrar esto:
type Exercise = {
  id: string; name: string; category: string
  image_url: string | null; muscle_groups: string[]
  is_timed: boolean
}
```

Y agregar el import junto al resto de imports del archivo:

```ts
import type { Exercise } from "@/lib/muscle-exercises"
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores — `Exercise` sigue teniendo el mismo shape, solo cambia de dónde viene.

- [ ] **Step 7: Commit**

```bash
git add lib/muscle-exercises.ts lib/muscle-exercises.test.ts components/planes/PlanEditor.tsx
git commit -m "feat(entrenamiento): filtrar ejercicios recomendados por zona muscular"
```

---

## Task 4: Instalar dependencias 3D y curar el modelo

**Files:**
- Modify: `package.json` (dependencias)
- Create: `scripts/build-anatomy-model.ts`
- Create (generado por el script, no a mano): `public/models/muscles.glb`

**Interfaces:**
- Produces: `public/models/muscles.glb`, un archivo binario con exactamente los nodos listados en `MUSCLE_ANATOMY[zone].nodeNames` para las 19 zonas (Task 2), pesando entre 2-3MB.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @gltf-transform/core @gltf-transform/functions @types/three
```

- [ ] **Step 2: Escribir el script de curación**

El script toma como entrada la carpeta local donde está `Startup.gltf` + `model.bin` (158MB, resultado de la conversión hecha durante el spike — no se commitea al repo) y produce `public/models/muscles.glb`. La ruta de entrada se pasa por variable de entorno para no hardcodear una ruta de la máquina del usuario.

**Importante — por qué no alcanza con "conservar 50 nodos y borrar el resto":** en el modelo fuente los 19 músculos NO son nodos raíz de la escena (solo 21 de 7179 nodos lo son) — son hijos anidados de otros nodos (huesos, grupos de Z-Anatomy). Ej.: `Pectoralis major muscle.el` es hijo de `Humerus.l`. Si se descartan los nodos padre sin más, se pierde la transformación (posición/rotación) que ubica correctamente al músculo en el espacio. El script primero "hornea" la transformación mundial de cada músculo conservado con `getWorldMatrix()`/`setMatrix()` y lo re-parenta directo a la escena (`scene.addChild()`, que desengancha automáticamente del padre anterior) — recién ahí es seguro borrar todo lo demás.

```ts
// scripts/build-anatomy-model.ts
/**
 * Cura el modelo completo de Z-Anatomy (glTF, ~158MB) a un .glb liviano
 * con solo los 19 musculos que usa la app. Correr con:
 *
 *   ANATOMY_SOURCE_DIR="C:/Users/gabri/Downloads/ImageToStl.com_Startup" npx tsx scripts/build-anatomy-model.ts
 *
 * Requiere que ANATOMY_SOURCE_DIR contenga Startup.gltf + model.bin
 * (salida de la conversion hecha con ImageToStl a partir del modelo de
 * Z-Anatomy, ver docs/superpowers/specs/2026-08-18-3d-muscle-anatomy-explorer-design.md).
 */
import { NodeIO } from "@gltf-transform/core"
import { prune, dedup, simplify, draco } from "@gltf-transform/functions"
import { MeshoptSimplifier } from "meshoptimizer"
import path from "path"
import fs from "fs"
import { MUSCLE_ANATOMY } from "../lib/muscle-anatomy"

const sourceDir = process.env.ANATOMY_SOURCE_DIR
if (!sourceDir) {
  console.error("Falta ANATOMY_SOURCE_DIR (carpeta con Startup.gltf + model.bin)")
  process.exit(1)
}

const KEEP_NAMES = new Set(
  Object.values(MUSCLE_ANATOMY).flatMap(entry => entry.nodeNames)
)

async function main() {
  const io = new NodeIO()
  const document = await io.read(path.join(sourceDir!, "Startup.gltf"))
  const root = document.getRoot()
  const scene = root.listScenes()[0]

  // Fase 1: para cada nodo de musculo a conservar, hornear su transformacion
  // MUNDIAL (no la local, que es relativa a un hueso/grupo padre que vamos a
  // borrar) y re-parentarlo directo a la escena. Tiene que pasar ANTES de
  // borrar nada, porque getWorldMatrix() depende de la jerarquia original
  // todavia intacta.
  let kept = 0
  for (const node of root.listNodes()) {
    const name = node.getName()
    if (!KEEP_NAMES.has(name)) continue
    const worldMatrix = node.getWorldMatrix()
    node.setMatrix(worldMatrix)
    scene.addChild(node)
    kept++
  }
  console.log(`Nodos conservados y re-parentados: ${kept} / esperados: ${KEEP_NAMES.size}`)

  if (kept < KEEP_NAMES.size) {
    console.error("Faltan nodos esperados — revisar MUSCLE_ANATOMY.nodeNames contra el modelo fuente.")
    process.exit(1)
  }

  // Fase 2: ahora que los nodos a conservar ya estan desenganchados de sus
  // padres originales, es seguro borrar todo lo demas (huesos, organos,
  // etiquetas de texto de Z-Anatomy, nodos de grupo vacios).
  let removed = 0
  for (const node of root.listNodes()) {
    const name = node.getName()
    if (KEEP_NAMES.has(name)) continue
    node.dispose()
    removed++
  }
  console.log(`Nodos eliminados: ${removed}`)

  await document.transform(
    prune(),
    dedup(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.01 }),
    draco(),
  )

  const outDir = path.join(process.cwd(), "public", "models")
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "muscles.glb")
  const glb = await io.writeBinary(document)
  fs.writeFileSync(outPath, glb)

  const sizeMB = (glb.byteLength / 1024 / 1024).toFixed(2)
  console.log(`Escrito ${outPath} — ${sizeMB} MB`)
  if (glb.byteLength > 5 * 1024 * 1024) {
    console.error(`ADVERTENCIA: ${sizeMB}MB supera el maximo aceptado de 5MB.`)
    process.exit(1)
  }
}

main()
```

- [ ] **Step 3: Instalar `meshoptimizer` (usado por el script) y `tsx`**

```bash
npm install --save-dev meshoptimizer
```

(`tsx` ya está en el proyecto — se usa en `supabase/create_demo_users.ts` y `supabase/replace_muscle_images.ts`.)

- [ ] **Step 4: Correr el script**

```bash
ANATOMY_SOURCE_DIR="C:/Users/gabri/Downloads/ImageToStl.com_Startup" npx tsx scripts/build-anatomy-model.ts
```

Expected: imprime "Nodos conservados: 50 / esperados: 50" (19 zonas, algunas con más de un nodo — sumar `nodeNames.length` de las 19 entradas de `MUSCLE_ANATOMY`), sin advertencia de tamaño, y `public/models/muscles.glb` existe.

Si el tamaño supera los 5MB: bajar `ratio` en `simplify()` (ej. `0.3`) y volver a correr — no commitear el resultado hasta que esté dentro del presupuesto.

- [ ] **Step 5: Verificar el resultado cargándolo con un script de inspección rápido**

Chequea tres cosas a la vez: la cantidad de nodos, que quedaron como hijos directos de la escena (no anidados bajo otro nodo — si esto falla, la Fase 1 del script no se ejecutó bien), y que su posición mundial coincide con el `pointPosition` que se puso en `MUSCLE_ANATOMY` para `chest`.

```bash
node -e "
const { NodeIO } = require('@gltf-transform/core');
new NodeIO().read('public/models/muscles.glb').then(doc => {
  const scene = doc.getRoot().listScenes()[0];
  const nodes = doc.getRoot().listNodes();
  console.log('Nodos en el .glb final:', nodes.length);
  console.log(nodes.map(n => n.getName()).slice(0, 5));

  const rootChildren = new Set(scene.listChildren().map(n => n.getName()));
  const allAreRootChildren = nodes.every(n => rootChildren.has(n.getName()));
  console.log('Todos son hijos directos de la escena:', allAreRootChildren);

  const chestNode = nodes.find(n => n.getName() === 'Pectoralis major muscle.el');
  console.log('Posicion mundial de Pectoralis major muscle.el:', chestNode.getWorldTranslation());
  console.log('Deberia ser cercano a: [0.1917, 1.3196, -0.0162] (pointPosition de chest en MUSCLE_ANATOMY)');
});
"
```

Expected: 50 nodos, todos hijos directos de la escena (`true`), y la posición mundial impresa coincide (con margen de redondeo de punto flotante) con `[0.1917, 1.3196, -0.0162]`. Si `allAreRootChildren` da `false`, la Fase 1 del script (Step 2) no re-parentó correctamente algún nodo — no seguir a Step 6 hasta que esto de `true`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/build-anatomy-model.ts public/models/muscles.glb
git commit -m "feat(entrenamiento): script de curacion del modelo 3D y modelo curado (2-3MB)"
```

---

## Task 5: `MuscleDetailSheet` — bottom sheet de detalle

**Files:**
- Create: `components/anatomy/MuscleDetailSheet.tsx`
- Test: `components/anatomy/MuscleDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `MuscleAnatomyEntry` (Task 2), `getExercisesForZone`/`Exercise` (Task 3).
- Produces: `<MuscleDetailSheet entry={...} exercises={...} onClose={...} onMinimize={...} minimized={boolean} />` — usado por `MuscleAnatomy3D` (Task 6).

- [ ] **Step 1: Escribir el test**

```tsx
// components/anatomy/MuscleDetailSheet.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MUSCLE_ANATOMY } from "@/lib/muscle-anatomy"
import type { Exercise } from "@/lib/muscle-exercises"

const EXERCISES: Exercise[] = [
  { id: "1", name: "Press de banca", category: "Fuerza", image_url: null, muscle_groups: ["Pecho"], is_timed: false },
]

describe("MuscleDetailSheet", () => {
  it("muestra el nombre, categoria y datos anatomicos del musculo", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={false}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.getByText("Pectoral Mayor")).toBeInTheDocument()
    expect(screen.getByText(MUSCLE_ANATOMY.chest.category)).toBeInTheDocument()
    expect(screen.getByText(MUSCLE_ANATOMY.chest.origen)).toBeInTheDocument()
  })

  it("muestra solo los ejercicios que le pasan como prop", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={false}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.getByText("Press de banca")).toBeInTheDocument()
  })

  it("no renderiza contenido cuando esta minimizado", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={true}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.queryByText(MUSCLE_ANATOMY.chest.origen)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run components/anatomy/MuscleDetailSheet.test.tsx`
Expected: FAIL — `Cannot find module './MuscleDetailSheet'`

- [ ] **Step 3: Implementar**

```tsx
// components/anatomy/MuscleDetailSheet.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronDown } from "lucide-react"
import type { MuscleAnatomyEntry } from "@/lib/muscle-anatomy"
import type { Exercise } from "@/lib/muscle-exercises"

interface MuscleDetailSheetProps {
  entry: MuscleAnatomyEntry
  exercises: Exercise[]
  minimized: boolean
  onClose: () => void
  onMinimize: () => void
}

export function MuscleDetailSheet({ entry, exercises, minimized, onClose, onMinimize }: MuscleDetailSheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <button
        onClick={onMinimize}
        className="flex w-full items-center justify-center py-3"
        aria-label="Minimizar"
      >
        <span className="h-1 w-10 rounded-full bg-zinc-700" />
      </button>

      {!minimized && (
        <div className="px-6 pb-8">
          {/* La key en el nombre del musculo fuerza el crossfade cada vez que cambia la zona seleccionada */}
          <AnimatePresence mode="wait">
            <motion.div
              key={entry.zone}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl text-zinc-50">{entry.displayName}</p>
                  <p className="font-heading text-xs uppercase tracking-wide text-brand-500">{entry.category}</p>
                </div>
                <button
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-[13px]">
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Origen:</span>
                  <span className="text-zinc-100">{entry.origen}</span>
                </div>
                <div className="h-px bg-zinc-800" />
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Inserción:</span>
                  <span className="text-zinc-100">{entry.insercion}</span>
                </div>
                <div className="h-px bg-zinc-800" />
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold text-zinc-500">Función:</span>
                  <span className="text-zinc-100">{entry.funcion}</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="font-heading text-sm text-zinc-50">Ejercicios Recomendados</p>
                {exercises.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">No hay ejercicios cargados para este músculo todavía.</p>
                ) : (
                  <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                    {exercises.map(exercise => (
                      <div key={exercise.id} className="w-[160px] shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                        <p className="truncate text-[13px] font-bold text-zinc-100">{exercise.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {minimized && (
        <div className="flex items-center justify-center gap-1 pb-3 text-xs text-zinc-500">
          <ChevronDown className="h-3.5 w-3.5" />
          Ver {entry.displayName}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run components/anatomy/MuscleDetailSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/anatomy/MuscleDetailSheet.tsx components/anatomy/MuscleDetailSheet.test.tsx
git commit -m "feat(entrenamiento): sheet de detalle de musculo con crossfade entre selecciones"
```

---

## Task 6: `MuscleAnatomy3D` — canvas 3D, cámara e interacción

**Files:**
- Create: `components/anatomy/MuscleAnatomy3D.tsx`

**Interfaces:**
- Consumes: `MUSCLE_ANATOMY`, `MuscleZone` (Task 2), `MuscleDetailSheet` (Task 5), `getExercisesForZone`/`Exercise` (Task 3), `MuscleIcon` (Task 1, para el fallback).
- Produces: `<MuscleAnatomy3D initialZone={zone} exercises={exercises} onClose={() => void} />` — usado por `PlanEditor.tsx` (Task 7).

No es practico escribir un test de comportamiento real para el canvas WebGL (jsdom no implementa WebGL) — la verificacion de esta tarea es manual, en el navegador, segun la seccion "Testing" del spec. El paso de test de este task cubre unicamente que el componente exporta correctamente y no rompe el build.

- [ ] **Step 1: Instalar `camera-controls` (dependencia de `@react-three/drei`'s `CameraControls`)**

```bash
npm install camera-controls
```

- [ ] **Step 2: Implementar**

```tsx
// components/anatomy/MuscleAnatomy3D.tsx
"use client"

import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { CameraControls, useGLTF, Html } from "@react-three/drei"
import * as THREE from "three"
import { X } from "lucide-react"
import { MUSCLE_ANATOMY, type MuscleZone } from "@/lib/muscle-anatomy"
import { getExercisesForZone, type Exercise } from "@/lib/muscle-exercises"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MuscleIcon } from "@/components/planes/MuscleIcon"

const MODEL_PATH = "/models/muscles.glb"
const HIGHLIGHT_COLOR = new THREE.Color("#ef4444")

interface MuscleAnatomy3DProps {
  initialZone: MuscleZone
  exercises: Exercise[]
  onClose: () => void
}

function Body({
  selectedZone,
  onSelect,
  isIdle,
}: {
  selectedZone: MuscleZone | null
  onSelect: (zone: MuscleZone) => void
  isIdle: boolean
}) {
  const { scene } = useGLTF(MODEL_PATH)
  const groupRef = useRef<THREE.Group>(null)

  // Mapa nombre de nodo -> zona, para resolver un click en cualquier mesh a su zona.
  const nodeNameToZone = useMemo(() => {
    const map = new Map<string, MuscleZone>()
    for (const entry of Object.values(MUSCLE_ANATOMY)) {
      for (const name of entry.nodeNames) map.set(name, entry.zone)
    }
    return map
  }, [])

  // Guarda el material original de cada mesh la primera vez que se toca,
  // para poder devolverlo al des-seleccionar sin perder el material real.
  const originalMaterials = useRef(new Map<string, THREE.Material | THREE.Material[]>())

  useFrame((_, delta) => {
    if (isIdle && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  useMemo(() => {
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      const zone = nodeNameToZone.get(obj.name)
      if (!zone) return
      if (!originalMaterials.current.has(obj.name)) {
        originalMaterials.current.set(obj.name, obj.material)
      }
      const isSelected = zone === selectedZone
      if (isSelected) {
        const mat = (obj.material as THREE.MeshStandardMaterial).clone()
        mat.color = HIGHLIGHT_COLOR
        obj.material = mat
      } else {
        obj.material = originalMaterials.current.get(obj.name)!
      }
    })
  }, [scene, selectedZone, nodeNameToZone])

  return (
    <group
      ref={groupRef}
      onClick={event => {
        event.stopPropagation()
        const zone = nodeNameToZone.get(event.object.name)
        if (zone) onSelect(zone)
      }}
    >
      <primitive object={scene} />
      {Object.values(MUSCLE_ANATOMY).map(entry => (
        <Html key={entry.zone} position={entry.pointPosition} center distanceFactor={1.2}>
          <button
            onClick={e => {
              e.stopPropagation()
              onSelect(entry.zone)
            }}
            className="relative grid h-4 w-4 place-items-center"
            aria-label={`Ver ${entry.displayName}`}
          >
            <span className="absolute h-4 w-4 animate-ring-ping rounded-full bg-red-500" />
            <span className="relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          </button>
        </Html>
      ))}
    </group>
  )
}

function CameraRig({ targetZone, controlsRef }: { targetZone: MuscleZone | null; controlsRef: React.RefObject<CameraControls> }) {
  const { camera } = useThree()

  useMemo(() => {
    if (!controlsRef.current) return
    if (targetZone) {
      const [x, y, z] = MUSCLE_ANATOMY[targetZone].pointPosition
      const distance = 0.4
      controlsRef.current.setLookAt(x, y, z + distance, x, y, z, true)
    } else {
      controlsRef.current.setLookAt(0, 0.2, 1.4, 0, 0.2, 0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetZone])

  return null
}

export function MuscleAnatomy3D({ initialZone, exercises, onClose }: MuscleAnatomy3DProps) {
  const [selectedZone, setSelectedZone] = useState<MuscleZone | null>(initialZone)
  const [minimized, setMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const controlsRef = useRef<CameraControls>(null)

  const isIdle = minimized && !isDragging

  function handleSelect(zone: MuscleZone) {
    setSelectedZone(zone)
    setMinimized(false)
  }

  function handleMinimize() {
    setMinimized(true)
  }

  if (webglFailed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
        <MuscleIcon zone={initialZone} className="h-40 w-32" />
        <p className="text-center text-sm text-zinc-400">
          Tu dispositivo no puede mostrar el modelo 3D. Mostrando la vista simple.
        </p>
        <button onClick={onClose} className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-heading text-sm uppercase tracking-wide text-zinc-400">Anatomía</p>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100"
          aria-label="Cerrar explorador de anatomía"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <Canvas
          camera={{ position: [0, 0.2, 1.4], fov: 40 }}
          onCreated={() => {}}
          onError={() => setWebglFailed(true)}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 2, 2]} intensity={1.2} />
          <Body selectedZone={selectedZone} onSelect={handleSelect} isIdle={isIdle} />
          <CameraRig targetZone={minimized ? null : selectedZone} controlsRef={controlsRef} />
          <CameraControls
            ref={controlsRef}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI - Math.PI / 4}
          />
        </Canvas>

        {selectedZone && (
          <MuscleDetailSheet
            entry={MUSCLE_ANATOMY[selectedZone]}
            exercises={getExercisesForZone(selectedZone, exercises)}
            minimized={minimized}
            onClose={onClose}
            onMinimize={handleMinimize}
          />
        )}
      </div>
    </div>
  )
}

useGLTF.preload(MODEL_PATH)
```

- [ ] **Step 3: Agregar la animación `ring-ping` como clase reusable (ya existe el keyframe en `tailwind.config.ts`, falta la utilidad `animate-ring-ping`)**

Verificar en `tailwind.config.ts` bajo `animation` si ya existe `"ring-ping": "ring-ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite"` (spec la referencia como ya existente). Si el nombre de la clase generada no es `animate-ring-ping` sino otro, ajustar el `className` usado en `Body` (Step 2) para que coincida exactamente con la clave definida en `animation` de `tailwind.config.ts`.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores en `components/anatomy/MuscleAnatomy3D.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/anatomy/MuscleAnatomy3D.tsx package.json package-lock.json
git commit -m "feat(entrenamiento): canvas 3D del explorador de anatomia con camara animada"
```

---

## Task 7: Integrar el explorador en `PlanEditor.tsx`

**Files:**
- Modify: `components/planes/PlanEditor.tsx`

**Interfaces:**
- Consumes: `MuscleAnatomy3D` (Task 6).

- [ ] **Step 1: Agregar el estado de apertura y el import**

```ts
import { MuscleAnatomy3D } from "@/components/anatomy/MuscleAnatomy3D"
```

Si el import de `MuscleZone` (Task 1) se había sacado por no usarse, volver a agregarlo junto al resto de imports de `lib/muscle-anatomy`:

```ts
import { type MuscleZone, /* ...resto de imports ya existentes de este módulo */ } from "@/lib/muscle-anatomy"
```

Junto al resto de `useState` del componente (cerca de `pickerPhase`):

```ts
const [anatomyZone, setAnatomyZone] = useState<MuscleZone | null>(null)
```

- [ ] **Step 2: Abrir el explorador al tocar una muscle card**

En el `map` de `muscleVolumeStats` (línea ~1066, el `<div>` de cada card), agregar `onClick`:

```tsx
<div
  key={muscle}
  onClick={() => setAnatomyZone(zone)}
  className="relative rounded-[20px] overflow-hidden border border-zinc-200 dark:border-white/[5%] bg-white dark:bg-[#111214] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-none flex flex-col cursor-pointer"
>
```

(Se agrega `onClick` y `cursor-pointer` al `className` ya existente — el resto de la card queda igual.)

- [ ] **Step 3: Renderizar el overlay al final del componente**

Justo antes del cierre del `return` principal de `PlanEditor` (después del último elemento renderizado, al mismo nivel que el `Dialog` del picker de ejercicios):

```tsx
{anatomyZone && (
  <MuscleAnatomy3D
    initialZone={anatomyZone}
    exercises={exercises}
    onClose={() => setAnatomyZone(null)}
  />
)}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en el navegador**

Levantar `npm run dev`, entrar a un plan de entrenamiento con ejercicios cargados, tocar una muscle card, confirmar:
- El modelo 3D carga y se puede rotar arrastrando.
- La cámara centra el músculo tocado.
- El sheet muestra Origen/Inserción/Función y ejercicios reales.
- Tocar otro punto cambia de músculo con crossfade en el texto, sin corte brusco de cámara.
- Minimizar el sheet aleja la cámara y el cuerpo empieza a auto-rotar; tomarlo con el dedo pausa la auto-rotación.
- Cerrar con X vuelve a la card de origen.

- [ ] **Step 6: Commit**

```bash
git add components/planes/PlanEditor.tsx
git commit -m "feat(entrenamiento): abrir explorador de anatomia 3D desde las muscle cards"
```

---

## Self-Review

**Cobertura del spec:**
- Arquitectura / extracción de código compartido → Task 1. ✓
- Modelo de datos (`MuscleAnatomyEntry`, `MUSCLE_ANATOMY`) → Task 2. ✓
- Ejercicios recomendados sin fetch nuevo → Task 3. ✓
- Pipeline del asset 3D (`gltf-transform`, presupuesto 2-3MB) → Task 4. ✓
- Flujo de interacción (selección, cambio con crossfade, minimizar/auto-rotate) → Tasks 5-6. ✓
- Manejo de errores (WebGL no disponible → fallback `MuscleIcon`) → Task 6. ✓
- Integración con la muscle card existente → Task 7. ✓
- Testing (unit tests para data pura, manual para WebGL) → Tasks 1, 2, 3, 5, 7. ✓

**Riesgos conocidos que quedan para ejecución** (no son placeholders — son verificaciones concretas con pasos definidos, no huecos vagos):
- El nombre exacto de la clase Tailwind para `ring-ping` (Task 6, Step 3) depende de cómo está declarada hoy en `tailwind.config.ts` — el plan indica exactamente qué verificar y ajustar.
- Si el `.glb` supera 5MB en el primer intento (Task 4, Step 4), el plan indica el parámetro exacto a bajar (`ratio` de `simplify()`).
