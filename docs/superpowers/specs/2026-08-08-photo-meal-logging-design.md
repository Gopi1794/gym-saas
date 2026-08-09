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

`on delete set null`: si se borra la comida del plan (ej. el trainer reordena/limpia el plan), el registro histórico del miembro no desaparece — solo pierde el vínculo y pasa a comportarse como "extra". `meal_id` no es único: una misma comida puede tener varias fotos vinculadas (ej. plato principal + bebida en fotos separadas), no hay restricción de "una foto por comida".

### 2. Bucket `food-photos`

Migración nueva creando el bucket (`insert into storage.buckets`) y sus policies — a diferencia de `machine-images` (que quedó sin IaC, creado a mano en el dashboard), este se define en SQL versionado como corresponde. Privado (no público como `avatar`/`exercise-images`, porque son fotos de comida de una persona, no algo pensado para mostrarse fuera de la app): política de insert/select restringida a `auth.uid()::text = (storage.foldername(name))[1]` para el propio miembro.

**Corrección tras autorevisión**: la policy de `admin`/`trainer` la había descrito como "join contra profiles" sin más detalle — no alcanza, porque hay que comparar el gym de quien llama contra el gym del *dueño de la carpeta* (dos profiles distintos), no contra el propio. La condición real necesita dos lookups:
```sql
exists (
  select 1 from profiles caller
  join profiles owner on owner.gym_id = caller.gym_id
  where caller.id = auth.uid()
    and caller.role in ('admin', 'trainer')
    and owner.id::text = (storage.foldername(name))[1]
)
```

### 3. Matcheo de horario

Función pura (`lib/nutrition-photo-match.ts` o similar): dado un timestamp y la lista de comidas del plan activo (`nutrition_meals` con su `time_label`), parsea cada `time_label` tipo `"HH:MM"` a minutos del día, calcula la diferencia contra la hora del timestamp, y devuelve la comida más cercana **si la diferencia es ≤ 3 horas**. Si ninguna comida cae dentro de esa ventana (o el plan no tiene comidas, o el miembro no tiene plan activo), devuelve `null` → el registro queda como "extra".

**Corrección tras autorevisión**: la primera versión decía "el timestamp de la foto" sin aclarar de dónde sale ese dato. El pipeline actual (`MemberChat.tsx`) comprime la imagen en un canvas antes de mandarla — eso normalmente descarta los metadatos EXIF, así que no se puede confiar en la fecha de la foto original. El timestamp que se usa es el momento del **servidor** al procesar la confirmación (`now()` en el insert), no algo leído de la imagen ni mandado a mano por el cliente.

`time_label` con formato inválido o vacío se ignora silenciosamente para el matcheo (no rompe el cálculo del resto de las comidas).

### 3.5. Bug preexistente que este subsistema debe arreglar de paso

**Encontrado en autorevisión, a partir de un comentario del usuario recordando los bugs de timezone de hoy.** `saveQuickLogEntry` (`app/actions/nutrition-tracking.ts:413`) calcula el día así:

```ts
const today = new Date().toISOString().split("T")[0]
```

`toISOString()` devuelve la fecha en **UTC**, no en hora de Argentina — es el mismo bug que ya arreglamos hoy en los pagos (`formatInstantAR`). Alguien que registra entre las 21:00 y la medianoche hora AR queda archivado en `logged_at` del día siguiente, sin aviso. Esto ya rompe el sistema actual (aunque nadie lo reportó todavía), y **rompe directamente el cálculo de las alertas de este subsistema** si no se corrige: una foto de las 22hs computaría mal a qué día pertenece, y el total del día quedaría incompleto.

Fix, dentro del alcance de este subsistema porque lo toca de lleno: cambiar esa línea a `todayAR()` de `lib/date-ar.ts` (mismo patrón ya establecido en el proyecto). Se corrige en el mismo commit que agrega `meal_id`/`photo_url`, no como cambio aparte.

Segunda instancia del mismo bug, misma causa: `app/api/chat/member/route.ts:86` usa el mismo `new Date().toISOString().split("T")[0]` para armar el contexto de "cuánto ya consumió hoy" que se le pasa a Claude — justo el número que mi verificación de umbral necesita correcto. Se corrige junto con la anterior.

Para contraste, `app/(dashboard)/nutricion/page.tsx:34` ya usa `todayAR()` bien — confirma que la utilidad correcta existe y está probada, el problema es que el fix no se aplicó en estos otros dos lugares cuando se hizo la primera vez.

### 4. Flujo del chat (`app/api/chat/member/route.ts`, `components/chat/MemberChat.tsx`)

- Al recibir una foto de comida, además de lo que ya hace hoy (estimar macros), se corre el matcheo de horario contra el plan activo del miembro.
- El resumen de confirmación que se le muestra al miembro ahora incluye la comida sugerida ("Esto lo sumo a tu Almuerzo") o la aclaración de que quedará suelto ("No coincide con ninguna comida programada, lo sumo como extra igual"). El miembro puede tocar para cambiar la vinculación antes de confirmar.
- Al confirmar: se sube la foto al bucket (si falla el upload, el registro se guarda igual sin `photo_url` — un fallo de storage no debe bloquear el registro de la comida).
- Se guarda el insert en `quick_log_entries` con `meal_id` y `photo_url`.

### 5. Alertas de calorías

**Corrección tras autorevisión**: la primera versión de esta sección asumía que la verificación corre "después de cada registro confirmado (foto o comida planificada tildada)" — pero la sección "Fuera de alcance" dice que `nutrition_logs` (el tildado manual de comidas planificadas) no se toca. Esas dos frases se contradicen: si no se toca ese código, tildar una comida planificada nunca dispararía la verificación, y alguien que solo usa el checkbox (sin sacar fotos) no recibiría alertas nunca — un hueco que no tiene sentido dejar. Se resuelve así: se extrae la lógica de "recalcular total del día + verificar umbral + notificar" a una función compartida (ej. `checkDailyCalorieThreshold(memberId, date)`), y se llama desde **los dos** puntos de escritura — el insert nuevo de `quick_log_entries` (este subsistema) y el punto donde hoy se confirma un `nutrition_logs` (existente, se le agrega una llamada a esta función al final, sin tocar su lógica actual de guardado).

Después de cada registro confirmado (foto o comida planificada tildada), se recalcula el total del día y se compara contra `nutrition_plans.target_calories` del plan activo:

- **Se pasó**: si el acumulado supera el 100% del objetivo, dispara alerta.
- **Se quedó corto**: solo se evalúa desde las 21:00 en adelante — usa `hourAR()` de `lib/date-ar.ts` (ya existe en el proyecto para esto exacto, no se inventa un mecanismo de hora nuevo). Si a esa hora el acumulado está por debajo del 70% del objetivo, dispara alerta.
- **Una sola alerta por umbral cruzado por día** — no se reenvía en cada foto subsiguiente aunque el total siga subiendo o bajando. Se trackea con un campo simple (ej. `notified_over`/`notified_under` boolean del día, o un log de notificaciones ya enviadas hoy para ese miembro+tipo).

**Confirmado**: el 100%/70%/21:00 eran una propuesta mía sin confirmar — el usuario los aprobó explícitamente como default razonable. Quedan cerrados para esta implementación; ajustarlos después es un cambio de una constante, no de arquitectura.

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
- Cambiar el guardado/lógica de `nutrition_logs` (comidas planificadas tildadas a mano) — sigue exactamente igual. La única adición ahí es la llamada a `checkDailyCalorieThreshold` al final (sección 5), para que las alertas funcionen también para quien no usa fotos — no es un cambio de comportamiento del tildado en sí, es un hook nuevo después.
