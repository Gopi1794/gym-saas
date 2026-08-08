# Registro de comidas por foto vinculado al plan nutricional

**Fecha:** 2026-08-08
**Estado:** Aprobado

## Contexto

El chat del miembro ya permite sacar una foto de una comida, mandarla a Claude (vision), recibir una descripción + macros estimados, y — si el miembro toca "Registrar" — guardarla en `quick_log_entries`. Ese pipeline funciona hoy, pero es deliberadamente liviano:

- La foto nunca se persiste (se usa en memoria del browser y se descarta).
- `quick_log_entries` no tiene ninguna relación con `nutrition_meals` ni con el plan activo del miembro — es una lista suelta, sin horario, sin saber "a qué comida del plan corresponde esto".
- No hay alertas: nadie avisa si el total del día se pasó o se quedó corto del objetivo calórico del plan.

Este spec cubre el **primer subsistema** de una idea más grande: usar fotos de comida para hacer más preciso el seguimiento del plan nutricional existente. El **segundo subsistema** — generar un plan nutricional nuevo a partir de una semana completa de fotos, con evaluación de viabilidad y sustituciones — queda fuera de este documento; se brainstormea aparte una vez que este esté implementado y probado.

## Decisiones de arquitectura

- **Se extiende `quick_log_entries`, no se crea una tabla nueva.** Ya es la tabla que alimenta la sección "Registrado por foto" de `MemberNutritionView.tsx` — agregarle columnas mantiene una sola fuente de verdad para "cosas que el miembro registró por foto", en vez de duplicar el concepto.
- **Se mantiene el paso de confirmación manual** ("¿Registro esto?") que ya existe hoy. La IA propone (incluyendo, ahora, a qué comida del plan quedaría vinculado), el miembro confirma o corrige antes de que se escriba nada.
- **Todo lo registrado por foto suma al total del día**, esté o no vinculado a una comida específica del plan. La vinculación (`meal_id`) es solo para mostrar contexto ("esto fue tu almuerzo") — el cálculo de calorías/macros del día siempre sale de sumar TODAS las filas de `quick_log_entries` del día más lo ya registrado vía `nutrition_logs` (comidas planificadas tildadas a mano).
- **La foto se guarda de forma permanente**, en un bucket nuevo `food-photos`, siguiendo el mismo patrón ya usado por `avatar` y `exercise-images` (path `{user_id}/{uuid}.{ext}`, políticas RLS por dueño). Esto habilita auditoría futura por parte del trainer (no se construye esa UI en este subsistema, pero el dato queda disponible para no tener que migrar nada después).

## Componentes

### 1. Migración: extender `quick_log_entries`

```sql
alter table quick_log_entries
  add column meal_id uuid references nutrition_meals(id) on delete set null,
  add column photo_url text;
```

`on delete set null`: si se borra la comida del plan (ej. el trainer reordena/limpia el plan), el registro histórico del miembro no desaparece — solo pierde el vínculo y pasa a comportarse como "extra".

### 2. Bucket `food-photos`

Migración nueva creando el bucket (`insert into storage.buckets`) y sus policies — a diferencia de `machine-images` (que quedó sin IaC, creado a mano en el dashboard), este se define en SQL versionado como corresponde. Privado (no público como `avatar`/`exercise-images`, porque son fotos de comida de una persona, no algo pensado para mostrarse fuera de la app): política de insert/select restringida a `auth.uid()::text = (storage.foldername(name))[1]` para el propio miembro, más una policy adicional de `select` para `admin`/`trainer` del mismo gym (join contra `profiles`) para habilitar la auditoría futura.

### 3. Matcheo de horario

Función pura (`lib/nutrition-photo-match.ts` o similar): dado el timestamp de la foto y la lista de comidas del plan activo (`nutrition_meals` con su `time_label`), parsea cada `time_label` tipo `"HH:MM"` a minutos del día, calcula la diferencia contra la hora de la foto, y devuelve la comida más cercana **si la diferencia es ≤ 3 horas**. Si ninguna comida cae dentro de esa ventana (o el plan no tiene comidas, o el miembro no tiene plan activo), devuelve `null` → el registro queda como "extra".

`time_label` con formato inválido o vacío se ignora silenciosamente para el matcheo (no rompe el cálculo del resto de las comidas).

### 4. Flujo del chat (`app/api/chat/member/route.ts`, `components/chat/MemberChat.tsx`)

- Al recibir una foto de comida, además de lo que ya hace hoy (estimar macros), se corre el matcheo de horario contra el plan activo del miembro.
- El resumen de confirmación que se le muestra al miembro ahora incluye la comida sugerida ("Esto lo sumo a tu Almuerzo") o la aclaración de que quedará suelto ("No coincide con ninguna comida programada, lo sumo como extra igual"). El miembro puede tocar para cambiar la vinculación antes de confirmar.
- Al confirmar: se sube la foto al bucket (si falla el upload, el registro se guarda igual sin `photo_url` — un fallo de storage no debe bloquear el registro de la comida).
- Se guarda el insert en `quick_log_entries` con `meal_id` y `photo_url`.

### 5. Alertas de calorías

Después de cada registro confirmado (foto o comida planificada tildada), se recalcula el total del día y se compara contra `nutrition_plans.target_calories` del plan activo:

- **Se pasó**: si el acumulado supera el 100% del objetivo, dispara alerta.
- **Se quedó corto**: solo se evalúa desde las 21:00 en adelante (hora del dispositivo/gym) — evita avisar "estás bajo" a media mañana, que es esperable. Si a esa hora el acumulado está por debajo del 70% del objetivo, dispara alerta.
- **Una sola alerta por umbral cruzado por día** — no se reenvía en cada foto subsiguiente aunque el total siga subiendo o bajando. Se trackea con un campo simple (ej. `notified_over`/`notified_under` boolean del día, o un log de notificaciones ya enviadas hoy para ese miembro+tipo).

### 6. Entrega de la alerta

Doble canal, ambos al momento del registro que cruza el umbral:
- **Notificación in-app** vía el sistema de `NotificationBell` ya existente.
- **Mensaje del asistente en el chat**, agregado a la respuesta de confirmación del registro (ej. "Listo, registrado. Vas 320 kcal arriba de tu objetivo de hoy.").

### 7. UI — `MemberNutritionView.tsx`

La sección "Registrado por foto" pasa a mostrar, por cada entrada: miniatura de la foto (si existe `photo_url`) y, si tiene `meal_id`, el nombre de la comida a la que quedó vinculada ("→ Almuerzo"). Sin `meal_id`: se muestra como hoy, sin esa etiqueta.

## Manejo de errores

- **Miembro sin plan activo**: no hay comidas contra las que matchear — todo queda como "extra", mismo comportamiento que el sistema actual. No es un caso de error, es el comportamiento esperado para alguien sin plan.
- **Falla el upload de la foto**: se loguea el error server-side, el registro se guarda igual sin `photo_url`. Nunca se pierde el dato nutricional por un problema de storage.
- **`time_label` inválido en una comida del plan**: se ignora esa comida para el matcheo, no afecta a las demás.
- **Miembro edita la vinculación propuesta antes de confirmar**: soportado — la sugerencia de la IA es un default, no una decisión final.

## Fuera de alcance

- Generar un plan nuevo a partir de una semana de fotos (subsistema 2, spec aparte).
- UI para que el trainer/admin revise las fotos guardadas — el dato queda accesible (RLS ya contempla su lectura), pero construir esa pantalla es trabajo futuro, no de este subsistema.
- Cambiar el comportamiento de `nutrition_logs` (comidas planificadas tildadas a mano) — sigue funcionando exactamente igual, en paralelo.
