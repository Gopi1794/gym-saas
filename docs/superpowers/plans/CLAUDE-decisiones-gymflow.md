# Decisiones y trampas — GymFlow

> Agregar al `CLAUDE.md` del proyecto.
> Esto NO describe qué hace el código (eso se lee del código).
> Documenta **por qué** es así y qué se rompió al hacerlo distinto.

---

## Fechas: `membership_expires_at` es un día, no un instante

**El problema.** La columna es `timestamptz`, pero conceptualmente guarda un
**día calendario**. Viene de un `<input type="date">` que produce `"2026-08-08"`,
y JavaScript lo parsea como **medianoche UTC** de ese día. En Argentina (UTC−3),
esa medianoche son las **21:00 del día anterior**.

**Qué se rompió por esto** (tres bugs distintos, mismo origen):

- El middleware bloqueaba al socio 21 horas antes de que venciera.
- El gate del check-in por QR, igual: no podía escanear estando al día.
- Cinco lugares mostraban la fecha un día antes de la cargada.

**La regla.** Nunca compares ni formatees `membership_expires_at` con
`new Date(x) < new Date()` ni con `toLocaleDateString` sin `timeZone`.

- Para comparar → `daysUntilAR(expiresAt)` en `lib/date-ar.ts`
- Para mostrar → `formatDayAR(expiresAt)`

**La trampa.** Aplicarle `AT TIME ZONE 'America/Argentina/Buenos_Aires'` parece
la corrección obvia y es **al revés**: convierte la medianoche UTC del 8 en las
21:00 del 7, corriendo la fecha para atrás. El valor guardado ya es el día
correcto — hay que leerlo crudo, no convertirlo.

**Distinguir de los instantes reales.** `created_at`, `checked_in_at`,
`completed_at` son `timestamptz` de verdad (`default now()`). Ahí convertir a
hora local **sí** es correcto. La diferencia no está en el tipo de columna,
está en qué representa el dato.

**Deuda conocida.** Migrar la columna a `date` mataría esta familia entera de
bugs. Toca middleware, check-in, notificaciones, formatos y tests.

---

## Notificaciones: `dedup_key` se ata a la condición, nunca al tiempo

**El problema.** `notify_churn_members` usaba
`churn:{admin}:{member}:{fecha}`. Con la fecha adentro, el dedup solo servía
dentro de un mismo día: al siguiente la clave cambiaba y el mismo socio en
riesgo generaba otra notificación. Un socio con 40 días de ausencia produjo
**40 notificaciones idénticas**. En total, 533 de 684 filas eran duplicados.

**La regla.** El `dedup_key` identifica **la condición**, no el momento en que
se detectó. Si la condición no cambió, no hay nada nuevo que avisar.

```
churn:{admin_id}:{member_id}                    ← sin fecha
weight_drift:{plan_id}:{target_calories}        ← se resetea al recalcular
```

**La excepción que confirma la regla.** `check_in_daily:{admin_id}:{fecha}`
**sí** lleva fecha, porque es un contador diario: la condición ("cuántos
entraron hoy") efectivamente cambia cada día.

**Corolario.** Una notificación tiene que limpiarse cuando la condición deja de
ser cierta, o el panel se llena de avisos que mienten. `recalculateNutritionPlanTargets`
borra las de `weight_drift` del objetivo viejo; `notify_churn_members` borra las
de socios que volvieron.

---

## Notificaciones: hay dos modelos conviviendo sin declararse

- **Evento** — pasó algo y no se deshace: `achievement`, `new_member`,
  `plan_assigned`.
- **Estado** — una condición es cierta *ahora* y puede dejar de serlo:
  `churn_alert`, `membership_expiring`, `weight_drift`, el digest de `check_in`.

Los dos usan la misma tabla y las mismas reglas, y **no deberían**. Un estado
necesita limpieza automática; un evento no.

Los tres mecanismos que hoy se pisan: `dedup_key` (evita reinsertar), `read`
(marca vista) y el borrado (elimina). Descartar una notificación cuya
`dedup_key` incluye fecha la reinserta en la próxima corrida del cron.

---

## Notificaciones: nunca `limit 1` para elegir destinatario

`notify_check_in` hacía `select id ... where role = 'admin' limit 1`. En un
gimnasio con dos admins, uno recibía la notificación y el otro no — y cuál,
dependía del orden que devolviera Postgres, que no está garantizado.

**La regla.** Notificar a **todos** los destinatarios que correspondan, con una
fila por cada uno. El `dedup_key` ya incluye el `user_id`, así que no chocan
entre sí.

**Y no uses `upsert` con `onConflict` desde supabase-js contra el índice de
dedup**: es un índice **parcial** (`where dedup_key is not null`) y Postgres no
lo matchea salvo que la sentencia repita el predicado, cosa que la API de
supabase-js no permite. Falla con *"there is no unique or exclusion constraint
matching the ON CONFLICT specification"*. Insertá de a uno y tragá el error
`23505`. En SQL crudo (dentro de una función) sí se puede escribir el predicado.

---

## Pagos: `status` y `method` son conceptos distintos

**El problema.** El enum de `status` incluía `'cash'`, que no es un estado sino
un método. Consecuencia: cinco lugares filtraban `status = 'approved'` y dejaban
afuera los pagos en efectivo — **$25.400 de $157.400 invisibles**, el 16% de los
ingresos. Y un pago en efectivo no podía estar pendiente ni rechazado.

**La regla.** Una columna, un concepto. `status` responde "¿se concretó?",
`method` responde "¿cómo pagó?".

Cuando dos ideas comparten un campo, cada consulta tiene que recordar la
excepción — y basta que una se olvide para que los números mientan. Se olvidaron
cinco de seis.

---

## Errores que no gritan

El patrón que más tiempo costó esta semana: **fallas silenciosas**.

- Un `SELECT` bloqueado por RLS devuelve **cero filas**, no un error.
- Un `.update()` bloqueado por RLS **no tira error** y afecta cero filas.
- Un `try/catch` alrededor de una notificación se traga el motivo real.
- Un link a una ruta inexistente no rompe el build, ni el lint, ni los tests.

**Las reglas que salieron de eso:**

- Después de un `.update()` con cliente admin, chequear que afectó filas.
- Todo `catch` que traga un error debe hacer `console.error` — fue lo único que
  permitió encontrar el bug del `ON CONFLICT` en producción.
- El mensaje genérico al usuario está bien (no filtra información), pero el
  error real tiene que quedar en algún lado que vos puedas leer.

---

## Server Actions: devolver errores, no lanzarlos

Next.js **redacta los mensajes de `throw`** desde Server Actions en producción:
el cliente recibe un digest genérico. En `next dev` se ve completo, así que el
problema aparece recién al desplegar.

**La regla.** `return { error: string }`, nunca `throw`. Y en el cliente, además
del manejo de `{ error }`, un `try/catch` para las fallas que ocurren *antes* de
ejecutar la acción (red, timeout, 500).

---

## Privilegios de columna en `profiles`: el trade-off

Para impedir que un socio se escriba `role = 'admin'`, se revocó `UPDATE` a
`authenticated` y se concedió solo sobre 14 columnas de perfil personal.

**Consecuencia.** `role`, `gym_id`, `trainer_id`, `membership_type`,
`membership_expires_at`, `total_xp` y `qr_code` **no las puede escribir ningún
usuario logueado**, ni siquiera un admin. Toda operación administrativa sobre
esas columnas tiene que usar el cliente admin (`lib/supabase/admin.ts`).

**El costo.** Esas columnas ya no tienen respaldo de la base: la validación en la
server action es la **única** barrera. Un bug ahí no tiene red abajo.

**Cómo se descubrió.** Asignar un entrenador empezó a fallar con
`permission denied for table profiles`. La columna se bloqueó sin verificar qué
funcionalidad legítima la escribía.

---

## Estado de UI: todo camino que entra en "pending" tiene que salir

Tres veces apareció el mismo bug en la misma feature: un botón que quedaba en
"Enviando…" para siempre.

1. Falta el `finally` → el estado no vuelve a `idle`.
2. El callback del captcha nunca dispara → nadie limpia la bandera.
3. `execute()` sobre un ref nulo → ni éxito ni error.

**La regla.** Por cada camino que entra en `pending`, tiene que existir uno que
salga: `finally`, handler de error, y un watchdog para el caso de que ninguno de
los dos ocurra.

---

## Duplicación de constantes: siempre diverge

Casos concretos de esta semana:

- `GOAL_LABELS` en 4 archivos → dos decían `"Reintegrado"`, otros `"Reembolsado"`.
- "Tasa de renovación" con dos fórmulas distintas en dashboard y reports.
- Tres definiciones distintas de "socio activo" en tres pantallas.
- La lógica de "campos faltantes" en tres lugares.

**La regla.** Una definición, un lugar. Y si la misma etiqueta se muestra en
contextos distintos, una fuente con varias presentaciones — no varias fuentes.

---

## El repo debe describir la base

La policy `"service role full access"` de `payments` —la peor de las
vulnerabilidades encontradas— **no estaba en ninguna migración**. Se creó desde
el dashboard de Supabase. Por eso sobrevivió meses: no había nada que leer.

**La regla.** Todo cambio de esquema, policy, `grant`, `revoke` o función va en
un archivo de migración versionado y commiteado. El click en el dashboard es
cómodo y es exactamente cómo se generan los agujeros invisibles.

Aplicar en Supabase **y** guardar el archivo. Las dos cosas, siempre.
