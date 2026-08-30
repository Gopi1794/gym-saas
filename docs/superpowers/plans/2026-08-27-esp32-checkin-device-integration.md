# Integrar ESP32 Check-in al panel admin

El ESP32 ya quedó validado por Serial como base de check-in. La app debe ser la fuente de verdad: el dispositivo solo envía una credencial, y el backend decide si el socio puede entrar, registra entrada/salida y deja auditoría.

## Quick path

1. Mantener el firmware actual como modo de laboratorio: `PING`, `STATUS`, `CHECKIN:<id>` por Serial.
2. Agregar en la app un modelo de dispositivos y credenciales NFC por gimnasio.
3. Crear un endpoint seguro para check-ins hechos por dispositivo.
4. Sumar una pestaña de admin para registrar/desactivar dispositivos, asignar credenciales a socios y ver actividad.

## Estado verificado

| Área | Estado |
|---|---|
| Repo real | `C:\wamp64\www\gym-saas` |
| Stack | Next.js 14, Supabase, Server Actions, Vitest |
| Check-in actual | QR/manual sobre `check_ins` |
| Tabla actual | `check_ins(id, user_id, gym_id, checked_in_at, checked_out_at, method)` |
| Constraint actual | `method in ('qr', 'manual')` |
| RLS actual | Socio ve lo suyo; admin/trainer ve/crea en su gym |
| Admin actual | `app/(dashboard)/admin/page.tsx` usa tabs: pagos, membresías, nutrición, exportaciones, configuración |

## Decisión de arquitectura

El ESP32 NO debe tener permisos amplios ni lógica de negocio. Debe identificarse con un token revocable y enviar una credencial leída. El servidor valida todo.

| Tema | Decisión |
|---|---|
| Fuente de verdad | Backend/Supabase, no firmware |
| Identidad del dispositivo | Tabla `access_devices` con token hasheado |
| Identidad del socio | Tabla `member_access_credentials` con UID/token hasheado |
| Registro final | Reutilizar `check_ins`, ampliando `method` a `device`/`nfc` |
| Auditoría | Tabla/eventos de intentos para aceptados y rechazados |
| Panel admin | Nueva pestaña `Accesos` dentro de `/admin` |

## Modelo propuesto

### `access_devices`

Dispositivos físicos habilitados para un gym.

Campos mínimos:

- `id uuid`
- `gym_id uuid`
- `name text`
- `device_uid text unique` — ejemplo: `gymflow-esp32-checkin-001`
- `token_hash text` — nunca guardar token plano
- `status text` — `active`, `disabled`
- `last_seen_at timestamptz`
- `created_at timestamptz`

### `member_access_credentials`

Credenciales NFC/tarjeta asociadas a socios.

Campos mínimos:

- `id uuid`
- `gym_id uuid`
- `member_id uuid`
- `credential_hash text`
- `kind text` — `nfc`, `serial_test`
- `label text`
- `status text` — `active`, `disabled`, `lost`
- `created_at timestamptz`

### `access_events`

Auditoría de intentos desde dispositivo.

Campos mínimos:

- `id uuid`
- `gym_id uuid`
- `device_id uuid null`
- `member_id uuid null`
- `credential_hash text null`
- `result text` — `accepted`, `rejected`, `expired`, `unknown_credential`, `disabled_device`
- `reason text null`
- `created_at timestamptz`

## Endpoint propuesto

`POST /api/access/check-in`

Request esperado:

```json
{
  "deviceId": "gymflow-esp32-checkin-001",
  "credential": "12345",
  "input": "serial"
}
```

Headers:

- `Authorization: Bearer <device_token>`

Respuesta aceptada:

```json
{
  "ok": true,
  "action": "checkin",
  "memberName": "Nombre del socio"
}
```

Respuesta rechazada:

```json
{
  "ok": false,
  "reason": "membership_expired"
}
```

## Reutilización del check-in actual

La función actual `registerMemberCheckIn(qrCode, gymId)` mezcla tres cosas:

1. Buscar socio por QR.
2. Validar membresía/rol.
3. Abrir/cerrar check-in.

Para soportar ESP32 sin duplicar bugs, conviene extraer la lógica común a una función server-side pura/compartida, por ejemplo:

- `resolveCheckInForProfile({ memberId, gymId, method })`
- `registerMemberCheckIn()` queda como adaptador QR.
- `/api/access/check-in` queda como adaptador dispositivo/NFC.

## Panel admin propuesto

Nueva pestaña: `Accesos` en `app/(dashboard)/admin/page.tsx`.

Debe permitir:

- Ver dispositivos registrados.
- Registrar/desactivar dispositivo.
- Ver último contacto (`last_seen_at`).
- Asignar una tarjeta/llavero NFC a un socio.
- Desactivar credenciales perdidas.
- Ver últimos intentos aceptados/rechazados.

## Fases recomendadas

### Fase 1 — Sin NFC, usando Serial

Objetivo: que la app ya acepte el flujo del ESP32 con `CHECKIN:12345`.

- Crear tablas y endpoint.
- Registrar un dispositivo de prueba.
- Asociar credencial de prueba `12345` a un socio.
- Probar con puente local o request manual.

### Fase 2 — NFC real

Objetivo: reemplazar `12345` por UID leído desde PN532/RC522.

- Firmware lee UID NFC.
- Envía UID al backend.
- Backend no cambia salvo `input: "nfc"`.

### Fase 3 — Producción

Objetivo: dispositivo autónomo por WiFi.

- Token por dispositivo.
- Rotación/revocación desde admin.
- Métricas de conexión.
- Manejo offline si hace falta.

## Seguridad mínima

- No hardcodear secretos en el firmware definitivo.
- No guardar UID/token plano en DB; guardar hash.
- Rechazar dispositivos no registrados o desactivados.
- Registrar intentos rechazados para auditoría.
- Mantener RLS para el panel admin.
- Si se usa `SECURITY DEFINER`, revocar `PUBLIC`/`anon` y permitir solo lo necesario.

## Archivos a tocar cuando se implemente

- `supabase/migrations/<fecha>_access_devices.sql`
- `types/database.ts`
- `app/api/access/check-in/route.ts`
- `app/actions/check-in.ts`
- `lib/check-in.ts` o equivalente para lógica compartida
- `components/admin/AccessDevicesPanel.tsx`
- `app/(dashboard)/admin/page.tsx`
- Tests en `lib/*.test.ts` y/o `app/actions/*.test.ts`

## Checklist de verificación

- [ ] `npx tsc --noEmit` pasa.
- [ ] Tests relevantes pasan.
- [ ] Admin ve solo dispositivos/credenciales de su gym.
- [ ] Device activo puede registrar check-in.
- [ ] Device desactivado no puede registrar check-in.
- [ ] Credencial desconocida queda auditada.
- [ ] Socio vencido queda rechazado y auditado.
- [ ] No se imprimen tokens ni secretos en logs.
