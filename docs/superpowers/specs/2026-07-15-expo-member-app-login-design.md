# App móvil de socios (Expo) — Login y base del proyecto

**Fecha:** 2026-07-15
**Estado:** Aprobado

## Contexto

GymFlow hoy es una app Next.js (web) usada tanto por dueños/staff como por socios. Se decidió construir una app nativa separada (Expo/React Native) solo para la experiencia del socio (login, check-in QR, plan de entrenamiento, logging de sesión, perfil/XP), destinada a Google Play y App Store.

Este documento cubre el **primer subsistema**: login y la base del proyecto sobre la que se construirán las demás pantallas. Las pantallas restantes (home/QR, mi plan, logging de sesión, perfil/XP) se diseñan en specs separadas siguiendo el mismo molde.

## Decisiones de arquitectura (aplican a todo el proyecto, no solo login)

- **Repo separado**, no monorepo. El único acoplamiento real entre el repo Next.js y el repo Expo es `types/database.ts`, que es un artefacto generado (`supabase gen types typescript`) y se regenera de forma independiente en cada repo — no hay riesgo de drift porque nadie lo edita a mano.
- **RLS como guardián único** para operaciones de "el usuario lee/escribe sus propios datos" (perfil, plan, sesiones, XP, nutrición). El cliente Expo pega directo a Supabase con el anon key + sesión del usuario, sin pasar por API routes de Next.
- **Excepción:** operaciones que cruzan usuarios o requieren validación server-side que no puede vivir en un `CHECK` constraint (ej. check-in por QR, que hoy lee el perfil de *otro* usuario sin restricción de RLS estándar) se resuelven con funciones Postgres `SECURITY DEFINER` expuestas como RPC — no se portan tal cual desde los Server Actions de Next, que corren en un contexto de confianza que el cliente Expo no tiene.
- Proyecto Expo nuevo desde cero (`npx create-expo-app`, Expo Router, TypeScript), EAS configurado de nuevo para este proyecto — no hay boilerplate previo reutilizable.

## Componentes de este subsistema

### 1. Cliente Supabase con persistencia de sesión (`lib/supabase/client.ts`)

`expo-secure-store` puro no alcanza: en Android tiene un límite de ~2048 bytes por valor, y el objeto de sesión de Supabase (access token + refresh token) puede superarlo. Se implementa el patrón `LargeSecureStore` recomendado por Supabase para Expo:

- Se genera/recupera una clave de encriptación AES vía `expo-secure-store` (esto sí entra bien dentro del límite de tamaño).
- El blob de sesión (JSON) se encripta con esa clave y se persiste en `AsyncStorage`.
- Nunca hay texto plano en disco.

### 2. Pantalla de login

- Campos: email, contraseña, botón "Iniciar sesión", link "Olvidé mi contraseña".
- Estética idéntica al web existente: rojo #D50000 como color de marca, Anton/Bebas Neue para títulos, Inter para texto de cuerpo.
- Estados: loading (submit en curso), error genérico ("Email o contraseña incorrectos" — sin distinguir cuál campo falló, para no filtrar existencia de cuentas), sin conexión (mensaje distinto: "Sin conexión a internet").
- **Sin flujo de registro** — los socios se crean desde el panel admin (web). El login solo autentica cuentas existentes.

### 3. Biometría (Face ID / huella)

- Opt-in, no forzado. Después de un login exitoso con email/contraseña, se muestra un prompt: "¿Activar Face ID / huella para tu próximo acceso?".
- Si acepta, se guarda una preferencia (`biometric_enabled: true`) en `expo-secure-store`.
- En logins siguientes: si hay sesión persistida y la preferencia está activa, se pide autenticación biométrica (`expo-local-authentication`) **antes** de restaurar la sesión y navegar más allá del login.
- Si la biometría falla, se cancela, o el dispositivo no la soporta, cae al formulario manual de email/contraseña — nunca bloquea el acceso.

### 4. Gate de membresía vencida

- Tras autenticar con Supabase Auth, se consulta `profiles.membership_expires_at` y `profiles.role` del usuario logueado (propia fila, cubierto por RLS estándar).
- Si `role = 'member'` y la membresía está vencida: se cierra la sesión inmediatamente (`supabase.auth.signOut()`) y se muestra una pantalla bloqueante: "Tu membresía está vencida. Regularizá tu situación en el gimnasio." Sin acceso a ninguna otra pantalla de la app.
- Staff (`admin`, `trainer`) no pasa por este gate.

### 5. Recuperar contraseña vía deep link

- Se usa `supabase.auth.resetPasswordForEmail` con un `redirectTo` que apunta a un universal link / app link propio (ej. `https://voltia-fitness.com/reset-password`).
- Requiere alojar dos archivos estáticos en el dominio existente (repo Next.js, ya tiene DNS y Resend configurados): `.well-known/apple-app-site-association` y `.well-known/assetlinks.json`. Es la única dependencia cruzada entre ambos repos, y se limita a agregar 2 API routes estáticas en Next — no toca lógica de negocio.
- Al tocar el link del mail, si la app está instalada, abre directo en la pantalla de "nueva contraseña" vía Expo Router (deep link handling). Si no está instalada, el link cae a una página web mínima de fallback (fuera de alcance de este spec).

## Manejo de errores

- Credenciales inválidas → mensaje genérico, sin enumeración de usuarios.
- Sin conexión → mensaje distinto, sin reintento automático agresivo.
- Falla de biometría → fallback silencioso a login manual, sin bloqueo ni contador de intentos a nivel app (el OS ya maneja sus propios límites de intentos biométricos).
- Membresía vencida → sesión cerrada server-side (signOut), no es un estado que la UI deba "recordar" localmente.

## Testing

- Jest + Testing Library para lógica pura y testeable sin dispositivo: helper de restauración de sesión, lógica del gate de membresía, parsing de deep link.
- Biometría y deep links no son automatizables de forma confiable en este contexto — se validan a mano en dispositivo real vía build de EAS (development build, no Expo Go, porque `expo-local-authentication` y los universal links no funcionan completos en Expo Go).

## Fuera de alcance de este spec

- Home / check-in QR, mi plan, logging de sesión, perfil/XP — specs separadas.
- Página web de fallback para el deep link de reset cuando la app no está instalada.
- Onboarding / tutorial de primer uso.
