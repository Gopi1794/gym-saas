# Migración de nextjs-toast-notify a Sileo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `nextjs-toast-notify` por `sileo` en todo el proyecto — mismo comportamiento visible (toasts success/error con posición y duración), sin librería duplicada.

**Architecture:** Sileo requiere un `<Toaster />` montado una vez en la raíz de la app (a diferencia de `nextjs-toast-notify`, que no necesitaba nada). Como el theme de la app es manual (toggle propio vía `next-themes`, no solo del SO), el `Toaster` necesita un wrapper cliente que lea `useTheme()` y se lo pase — si no, un usuario en modo claro vería los toasts en oscuro. El resto es una sustitución 1:1 de cada `showToast.success/error(mensaje, opciones)` por `sileo.success/error({ title, position, duration })`.

**Tech Stack:** Next.js 14 App Router, `sileo@0.1.5`, `next-themes` (ya en el proyecto).

## Global Constraints

- Ningún cambio de comportamiento visible más allá de: el estilo/animación propio de Sileo (spring physics) en vez del de `nextjs-toast-notify`, y la pérdida de `transition: "bounceIn"` (Sileo no tiene ese parámetro — ver Task 1).
- No dejar las dos librerías conviviendo al terminar — es reemplazo total.

---

## Contexto verificado antes de planificar

1. **`sileo@0.1.5` — versión 0.x.** Es un paquete joven (recién instalado para inspeccionarlo: `node_modules/sileo/package.json`). Antes de migrar 8 archivos y ~40 call sites vale la pena que lo sepas: no es una librería con años de uso como `sonner` o `react-hot-toast`. Su única dependencia es `motion` (`^12.34.0`, el sucesor de Framer Motion) — huella chica, nada raro. `npm audit` post-instalación sigue mostrando las mismas 23 vulnerabilidades que ya tenía el proyecto (todas de `next`, `eslint`, `postcss`, etc.) — Sileo no sumó ninguna nueva.

2. **API real (leída de `node_modules/sileo/dist/index.d.ts`, no de la doc web — la doc web omitía `duration` en su resumen)**:
   ```ts
   interface SileoOptions {
     title?: string
     description?: ReactNode | string
     type?: "success" | "loading" | "error" | "warning" | "info" | "action"
     position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
     duration?: number | null
     icon?: ReactNode | null
     styles?: { title?: string; description?: string; badge?: string; button?: string }
     fill?: string
     roundness?: number
     autopilot?: boolean | { expand?: number; collapse?: number }
     button?: { title: string; onClick: () => void }
   }
   const sileo: {
     success: (opts: SileoOptions) => string
     error: (opts: SileoOptions) => string
     // + warning, info, action, show, promise, dismiss, clear
   }
   function Toaster(props: { children?; position?; offset?; options?; theme?: "light"|"dark"|"system" }): any
   ```
   **No hay parámetro `transition`.** Cada llamada actual con `transition: "bounceIn"` pierde esa opción — Sileo trae su propia animación (spring physics) fija, no configurable por toast. El resto (`duration`, `position`) mapea directo.

3. **`nextjs-toast-notify` hoy no tiene ningún provider montado** (`app/layout.tsx` no lo menciona) — funciona standalone. Sileo **sí** exige `<Toaster />` en la raíz, o los toasts no aparecen.

4. **El modo claro/oscuro de esta app es un toggle manual, no del SO** (`ThemeProvider` usa `enableSystem={false}`, y hay un toggle real: `components/ui/animated-theme-toggler.tsx` usa `useTheme()`). Si monto `<Toaster theme="dark">` fijo, los toasts quedarían oscuros aunque el usuario esté en modo claro. Hace falta un wrapper cliente que lea `useTheme()` de `next-themes` y se lo pase a Sileo — `theme="system"` en Sileo no serviría porque seguiría al SO, no al toggle de la app.

5. **`app/globals.css:13-19`** tiene un bloque de variables CSS específico para el dark mode de `nextjs-toast-notify` (`--toast-bg-color`, etc.) que queda huérfano una vez migrado — Sileo resuelve su propio dark mode por prop, no por CSS vars.

6. **Alcance real**: 8 componentes, 44 call sites de `showToast.success`/`showToast.error`, todos con la misma forma de opciones (`{ duration, position }`, algunos con `transition` de más). Es mecánico — la Task 2 define la regla de transformación una sola vez y la aplica archivo por archivo.

7. **Secuencia de commits — encontrado en self-review**: si `npm uninstall nextjs-toast-notify` corre en Task 1 (antes de migrar los call sites), el commit de Task 1 deja la app rota — los 8 archivos de Task 2 siguen importando un paquete que ya no está instalado, hasta que Task 2 termina. El uninstall se mueve al final de Task 2, después de confirmar que no queda ninguna referencia.

8. **Z-index — encontrado en self-review, verificado en código, no supuesto**: `node_modules/sileo/dist/styles.css:404` define `[data-sileo-viewport] { z-index: 50 }`. `components/ui/dialog.tsx:20` usa `z-50` para el overlay de los modales — empate exacto. `components/notifications/NotificationBell.tsx:170` usa `z-[9999]` para su dropdown. Sileo no expone `zIndex` ni `className` en las props de `Toaster` (ver el tipo en el punto 2), así que la única forma de garantizar que un toast se vea arriba de un modal recién cerrado (patrón que ya existe hoy: `confirmDeleteMeal`/`confirmClearPlan` en `NutritionPlanEditor` cierran un Dialog y acto seguido muestran un toast) es un override de CSS por selector — Task 1 lo agrega.

9. **Nota de branch, no de código**: seguimos en `fix/trainer-membership-update`, que ya acumuló en esta sesión el resend de ForgotPasswordForm y los avisos de nutrición — ninguno de los tres cambios tiene que ver con el nombre de la branch. No creo una branch nueva sin que lo pidas porque no sé si preferís consolidar todo en un solo PR o separarlo; lo dejo para que lo decidas antes del primer commit (`work-unit-commits`/`branch-pr` son las skills que tocan acá).

---

## Task 1 — Instalar Sileo, montar el Toaster, migrar un archivo como smoke test

`nextjs-toast-notify` **no se desinstala todavía** — sigue en `package.json` hasta el final de Task 2, porque 7 de los 8 archivos siguen dependiendo de él hasta entonces (punto 7 del contexto). Esta task deja la app funcionando de punta a punta, con las dos librerías conviviendo un rato: eso es intencional, no un descuido.

**Files:**
- Modify: `package.json` (ya tiene `sileo` sumado por la instalación previa)
- Create: `components/providers/ToastProvider.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css:13-19` (reemplazar el bloque de `nextjs-toast-notify` por el override de z-index de Sileo)
- Modify: `components/nutrition/WeightChart.tsx` (smoke test — el archivo más chico, 2 call sites)

**Interfaces:**
- Produces: `<ToastProvider />`, componente cliente sin props, para montar una vez en la raíz.

- [ ] **Paso 1: crear el wrapper cliente del Toaster**

Crear `components/providers/ToastProvider.tsx`:

```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sileo"

export function ToastProvider() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="top-right" theme={resolvedTheme === "light" ? "light" : "dark"} />
}
```

- [ ] **Paso 2: montarlo en la raíz**

En `app/layout.tsx`, agregar el import:

```ts
import { ToastProvider } from "@/components/providers/ToastProvider"
```

Y dentro de `<ThemeProvider>`, como hermano de `{children}`:

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
  <ToastProvider />
  {children}
</ThemeProvider>
```

- [ ] **Paso 3: reemplazar el CSS de `nextjs-toast-notify` por el override de z-index de Sileo**

En `app/globals.css`, reemplazar el bloque (líneas 13-19):

```css
/* ── nextjs-toast-notify dark mode override ────────────────── */
.dark {
  --toast-bg-color: #18181b;
  --toast-text-color: #f4f4f5;
  --toast-close-color: #a1a1aa;
  --toast-box-shadow: 0 0.25rem 1.125rem 0 rgba(0, 0, 0, 0.5);
}
```

por:

```css
/* ── Sileo: por encima de modales (Dialog usa z-50, mismo z-index que el
   viewport de Sileo por defecto) y del dropdown de notificaciones (z-[9999]) ── */
[data-sileo-viewport] {
  z-index: 10000;
}
```

- [ ] **Paso 4: migrar `WeightChart.tsx` como smoke test**

En `components/nutrition/WeightChart.tsx`, cambiar el import (línea 5) y los 2 call sites:

```tsx
// línea 5
import { sileo } from "sileo"

// línea 76
sileo.success({ title: `Peso registrado: ${kg} kg`, duration: 3000, position: "top-right" })
// línea 80
sileo.error({ title: "No se pudo registrar el peso", duration: 4000, position: "top-right" })
```

- [ ] **Paso 5: verificación manual**

`npm run dev` → una pantalla que use `WeightChart` (registro de peso del socio) → registrar un peso → confirmar que aparece el toast de éxito de Sileo, arriba a la derecha, con el ícono y el color de "success". Togglear el theme (claro/oscuro) y repetir para confirmar que el fondo del toast cambia con el theme de la app, no con el del SO. Abrir el modal de eliminar comida en `/nutricion/[id]` (todavía sin migrar, pero sirve para ver el Dialog) y confirmar visualmente que el overlay del Dialog (`z-50`) no tapa nada de Sileo si llegaran a coincidir en pantalla — con el override del Paso 3 el toast queda arriba.

- [ ] **Paso 6: commit**

```bash
git add package.json package-lock.json components/providers/ToastProvider.tsx app/layout.tsx app/globals.css components/nutrition/WeightChart.tsx
git commit -m "chore: instalar sileo, montar Toaster, migrar WeightChart como smoke test"
```

---

## Task 2 — Migrar el resto de los call sites y desinstalar nextjs-toast-notify

`WeightChart.tsx` ya quedó migrado en Task 1 (smoke test) — quedan 7 archivos, 42 call sites.

**Regla de transformación (aplica a los 7 archivos que quedan, sin excepción):**

```ts
// Antes
import { showToast } from "nextjs-toast-notify"
showToast.success(mensaje, { duration, position: "top-right", transition: "bounceIn" })
showToast.error(mensaje, { duration, position: "top-right" })

// Después
import { sileo } from "sileo"
sileo.success({ title: mensaje, duration, position: "top-right" })
sileo.error({ title: mensaje, duration, position: "top-right" })
```

`transition` se descarta siempre (no existe en Sileo — punto 2 del contexto). `duration` y `position` se copian tal cual. Cuando `mensaje` es un template string (ej. `` `${food.name} agregado` ``), se copia igual como `title`.

**Files (import a cambiar en los 7, más el/los call site(s) mostrados — el resto de cada archivo sigue la misma regla):**

- [ ] **`components\dashboard\WeightReminderBanner.tsx`** — import línea 6; 2 call sites (líneas 30, 33), mismo patrón que el `WeightChart.tsx` de Task 1.

- [ ] **`components\machines\MachinesPanel.tsx`** — import línea 7; 6 call sites (líneas 52, 60, 81, 99, 169, 228), mismo patrón.

- [ ] **`components\machines\MachineScanner.tsx`** — import línea 6; 4 call sites (líneas 48, 104, 118, 120), mismo patrón.

- [ ] **`components\nutrition\NutritionPlansPanel.tsx`** — import línea 7; 4 call sites (líneas 85, 90, 107, 109), mismo patrón.

- [ ] **`components\nutrition\NutritionPlanEditor.tsx`** — import línea 8; 10 call sites (líneas 696, 697, 771, 773, 784, 786, 814, 816, 832, 834), incluye uno con `catch { showToast.error(...) }` en una sola línea (línea 697) — mismo patrón, solo cambia el nombre.

- [ ] **`components\nutrition\MemberNutritionView.tsx`** — import línea 9; 6 call sites (líneas 48, 51, 128, 131, 140, 143), mismo patrón.

- [ ] **`components\check-in\QRScanner.tsx`** — import línea 10; 10 call sites (líneas 44-46 multilínea, 65, 67, 76, 89, 91, 110, 115, 155, 170). El de la línea 44 está partido en dos líneas:

```tsx
// antes
showToast.error("Solo el staff puede fichar con el QR del establecimiento", {
  duration: 3000, position: "top-right",
})

// después
sileo.error({ title: "Solo el staff puede fichar con el QR del establecimiento", duration: 3000, position: "top-right" })
```

El resto de los call sites de este archivo usa variables (`msg`) en vez de string literal — mismo patrón, solo cambia `showToast.error(msg, {...})` → `sileo.error({ title: msg, ...})`.

- [ ] **Paso: confirmar que no queda ninguna referencia**

```bash
grep -r "nextjs-toast-notify\|showToast" --include="*.tsx" --include="*.ts" .
```

Esperado: sin resultados (fuera de `package-lock.json`, que se limpia con el `npm uninstall` del paso siguiente).

- [ ] **Verificación manual — un toast success y uno error por archivo tocado**

`npm run dev` → para cada uno de los 7 flujos que quedan (recordatorio de peso, escanear máquina, crear/eliminar máquina, crear/eliminar plan nutricional, agregar/eliminar comida, marcar agua/comida, fichar QR) → disparar al menos un caso success y un caso error → confirmar que el toast aparece arriba a la derecha, con el texto correcto, y que el color sigue siendo correcto en ambos themes (claro/oscuro). Puntual: en `NutritionPlanEditor`, eliminar una comida (dispara el Dialog de confirmación) y confirmar que el toast "Comida eliminada" se ve completo arriba del overlay del modal mientras este todavía está cerrando — es el caso concreto que motivó el override de z-index del Paso 3 de Task 1.

- [ ] **Paso: recién ahora, desinstalar `nextjs-toast-notify`**

Solo después de que el grep de arriba no encuentre nada:

```bash
npm uninstall nextjs-toast-notify
```

- [ ] **Commit**

```bash
git add components/dashboard/WeightReminderBanner.tsx \
        components/machines/MachinesPanel.tsx components/machines/MachineScanner.tsx \
        components/nutrition/NutritionPlansPanel.tsx components/nutrition/NutritionPlanEditor.tsx \
        components/nutrition/MemberNutritionView.tsx components/check-in/QRScanner.tsx \
        package.json package-lock.json
git commit -m "refactor: migrar showToast (nextjs-toast-notify) a sileo en todo el proyecto"
```

---

## Fuera de alcance

- No se toca el estilo/copy de ningún mensaje — solo la llamada a la API.
- No se agregan features nuevas de Sileo (`promise`, `action`, `button`) — eso sería una mejora, no parte de este reemplazo.
- No decido la estrategia de branch/PR — queda para que lo confirmes antes del primer commit.
