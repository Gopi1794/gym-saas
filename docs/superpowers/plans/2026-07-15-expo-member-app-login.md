# App Móvil de Socios (Expo) — Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el repo Expo `gym-saas-mobile` desde cero con login, persistencia de sesión segura, biometría opcional y gate de membresía vencida, listo para EAS build.

**Architecture:** Proyecto Expo Router + TypeScript, cliente Supabase con adapter de storage encriptado (`LargeSecureStore`), lógica de negocio (gate de membresía, parsing de deep link, preferencia biométrica) extraída a funciones puras testeables con Jest, orquestada por un `AuthContext` de React que expone sesión/loading/signIn/signOut al árbol de la app.

**Tech Stack:** Expo SDK (latest), Expo Router, TypeScript, `@supabase/supabase-js`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js` + `react-native-get-random-values`, `expo-local-authentication`, Jest (`jest-expo` preset) + `@testing-library/react-native`.

## Global Constraints

- Repo separado en `c:\wamp64\www\gym-saas-mobile`, git propio, **no** anidado dentro de `gym-saas`.
- RLS de Supabase es el único guardián para lecturas del propio usuario — el cliente pega directo a Supabase, sin API routes intermedias.
- Sin flujo de registro/alta — solo login de cuentas creadas por el admin.
- Persistencia de sesión debe usar el patrón `LargeSecureStore` (SecureStore para la clave de encriptación + AsyncStorage para el blob), no `expo-secure-store` puro (límite ~2048 bytes en Android).
- Biometría es opt-in, nunca bloquea el acceso si falla o no está disponible.
- Membresía vencida (`role: 'member'` + `membership_expires_at` vencida o null) bloquea el acceso por completo, con `signOut()` inmediato.
- Colores/tipografía de marca: rojo `#D50000`, Anton/Bebas Neue para títulos, Inter para texto de cuerpo.
- Testing: TDD para toda lógica pura (gate de membresía, deep link, storage adapter, preferencia biométrica). UI de login testeada con `@testing-library/react-native`. Biometría y deep links reales solo se validan a mano en build de EAS (development build, no Expo Go).

---

## Task 1: Scaffold del proyecto Expo

**Files:**
- Create: `c:\wamp64\www\gym-saas-mobile\` (proyecto completo vía CLI)
- Create: `c:\wamp64\www\gym-saas-mobile\app.json`
- Create: `c:\wamp64\www\gym-saas-mobile\eas.json`
- Create: `c:\wamp64\www\gym-saas-mobile\jest.config.js`
- Create: `c:\wamp64\www\gym-saas-mobile\.env.example`

**Interfaces:**
- Produces: estructura base Expo Router (`app/` como carpeta de rutas) que consumen todas las tareas siguientes.

- [ ] **Step 1: Crear el proyecto**

```bash
cd c:\wamp64\www
npx create-expo-app@latest gym-saas-mobile --template blank-typescript
cd gym-saas-mobile
```

- [ ] **Step 2: Instalar dependencias de routing, Supabase, storage y biometría**

```bash
npx expo install expo-router expo-secure-store expo-local-authentication expo-linking expo-constants expo-status-bar react-native-screens react-native-safe-area-context
npm install @supabase/supabase-js @react-native-async-storage/async-storage aes-js react-native-get-random-values
npm install --save-dev jest-expo @testing-library/react-native @types/aes-js
```

- [ ] **Step 3: Configurar Expo Router como entrypoint**

Editar `package.json`, agregar/confirmar:

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "test": "jest"
  }
}
```

- [ ] **Step 4: Configurar `app.json`** (scheme para deep links, bundle identifiers)

```json
{
  "expo": {
    "name": "GymFlow Socios",
    "slug": "gym-saas-mobile",
    "scheme": "gymflowmember",
    "ios": {
      "bundleIdentifier": "com.gymflow.member",
      "associatedDomains": ["applinks:voltia-fitness.com"]
    },
    "android": {
      "package": "com.gymflow.member",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "voltia-fitness.com", "pathPrefix": "/reset-password" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```

- [ ] **Step 5: Configurar `jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ],
}
```

- [ ] **Step 6: Crear `.env.example`** (Expo requiere prefijo `EXPO_PUBLIC_` para vars accesibles en el cliente)

```
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

- [ ] **Step 7: Inicializar git y EAS**

```bash
git init
git add -A
git commit -m "chore: scaffold expo project with router, supabase and testing deps"
npx eas init
```

---

## Task 2: `LargeSecureStore` — adapter de storage encriptado

**Files:**
- Create: `lib/supabase/largeSecureStore.ts`
- Test: `lib/supabase/largeSecureStore.test.ts`

**Interfaces:**
- Produces: `largeSecureStore` (instancia default export) con métodos `getItem(key: string): Promise<string | null>`, `setItem(key: string, value: string): Promise<void>`, `removeItem(key: string): Promise<void>` — implementa la interfaz `SupabaseAuthStorageAdapter` que consume Task 3.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// lib/supabase/largeSecureStore.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import largeSecureStore from "./largeSecureStore"

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

describe("largeSecureStore", () => {
  const mockAsyncStorage: Record<string, string> = {}
  const mockSecureStore: Record<string, string> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(mockAsyncStorage).forEach((k) => delete mockAsyncStorage[k])
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k])

    ;(AsyncStorage.setItem as jest.Mock).mockImplementation(async (k, v) => {
      mockAsyncStorage[k] = v
    })
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation(async (k) => mockAsyncStorage[k] ?? null)
    ;(AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k) => {
      delete mockAsyncStorage[k]
    })
    ;(SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k, v) => {
      mockSecureStore[k] = v
    })
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k) => mockSecureStore[k] ?? null)
    ;(SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k) => {
      delete mockSecureStore[k]
    })
  })

  it("roundtrips a value through setItem and getItem", async () => {
    await largeSecureStore.setItem("supabase-session", "hello world session data")
    const result = await largeSecureStore.getItem("supabase-session")
    expect(result).toBe("hello world session data")
  })

  it("never stores plaintext in AsyncStorage", async () => {
    await largeSecureStore.setItem("supabase-session", "plaintext-secret")
    expect(mockAsyncStorage["supabase-session"]).not.toContain("plaintext-secret")
  })

  it("returns null when nothing is stored", async () => {
    const result = await largeSecureStore.getItem("missing-key")
    expect(result).toBeNull()
  })

  it("removeItem clears both stores", async () => {
    await largeSecureStore.setItem("supabase-session", "value")
    await largeSecureStore.removeItem("supabase-session")
    expect(await largeSecureStore.getItem("supabase-session")).toBeNull()
    expect(mockSecureStore["supabase-session"]).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- largeSecureStore`
Expected: FAIL con "Cannot find module './largeSecureStore'"

- [ ] **Step 3: Implementar `largeSecureStore.ts`**

```typescript
// lib/supabase/largeSecureStore.ts
import "react-native-get-random-values"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as aesjs from "aes-js"

class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8))
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1))
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey))

    return aesjs.utils.hex.fromBytes(encryptedBytes)
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key)
    if (!encryptionKeyHex) return null

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1))
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value))

    return aesjs.utils.utf8.fromBytes(decryptedBytes)
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key)
    if (!encrypted) return null
    return await this.decrypt(key, encrypted)
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value)
    await AsyncStorage.setItem(key, encrypted)
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(key)
  }
}

export default new LargeSecureStore()
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- largeSecureStore`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/largeSecureStore.ts lib/supabase/largeSecureStore.test.ts
git commit -m "feat: add encrypted session storage adapter for expo"
```

---

## Task 3: Cliente Supabase

**Files:**
- Create: `lib/supabase/client.ts`

**Interfaces:**
- Consumes: `largeSecureStore` (default export) de Task 2.
- Produces: `supabase` (named export), instancia de `SupabaseClient<Database>` que consumen todas las tareas de auth siguientes.

No hay lógica pura para TDD acá — es configuración. Se valida con un smoke test manual en Step 3.

- [ ] **Step 1: Implementar el cliente**

```typescript
// lib/supabase/client.ts
import "react-native-url-polyfill/auto"
import { createClient } from "@supabase/supabase-js"
import largeSecureStore from "./largeSecureStore"
import type { Database } from "../../types/database"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: largeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

- [ ] **Step 2: Instalar el polyfill de URL que requiere supabase-js en RN**

```bash
npx expo install react-native-url-polyfill
```

- [ ] **Step 3: Copiar los tipos generados desde el proyecto Supabase**

```bash
mkdir types
npx supabase gen types typescript --project-id <PROJECT_REF> > types/database.ts
```

(Usar el mismo `<PROJECT_REF>` que usa `gym-saas`. Este archivo se regenera, nunca se edita a mano.)

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts types/database.ts package.json package-lock.json
git commit -m "feat: configure supabase client with encrypted session storage"
```

---

## Task 4: Gate de membresía (lógica pura)

**Files:**
- Create: `lib/auth/membershipGate.ts`
- Test: `lib/auth/membershipGate.test.ts`

**Interfaces:**
- Produces: `isMembershipBlocked(profile: { role: string; membership_expires_at: string | null }): boolean` — consumida por Task 6 (`AuthContext`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// lib/auth/membershipGate.test.ts
import { isMembershipBlocked } from "./membershipGate"

describe("isMembershipBlocked", () => {
  it("blocks a member with an expired membership", () => {
    const blocked = isMembershipBlocked({
      role: "member",
      membership_expires_at: "2020-01-01T00:00:00.000Z",
    })
    expect(blocked).toBe(true)
  })

  it("does not block a member with an active membership", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const blocked = isMembershipBlocked({ role: "member", membership_expires_at: future })
    expect(blocked).toBe(false)
  })

  it("blocks a member with no membership_expires_at set", () => {
    const blocked = isMembershipBlocked({ role: "member", membership_expires_at: null })
    expect(blocked).toBe(true)
  })

  it("never blocks staff, regardless of membership_expires_at", () => {
    expect(isMembershipBlocked({ role: "admin", membership_expires_at: null })).toBe(false)
    expect(isMembershipBlocked({ role: "trainer", membership_expires_at: "2020-01-01T00:00:00.000Z" })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- membershipGate`
Expected: FAIL con "Cannot find module './membershipGate'"

- [ ] **Step 3: Implementar**

```typescript
// lib/auth/membershipGate.ts
type ProfileForGate = {
  role: string
  membership_expires_at: string | null
}

export function isMembershipBlocked(profile: ProfileForGate): boolean {
  if (profile.role === "admin" || profile.role === "trainer") {
    return false
  }

  if (!profile.membership_expires_at) {
    return true
  }

  return new Date(profile.membership_expires_at) <= new Date()
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- membershipGate`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/membershipGate.ts lib/auth/membershipGate.test.ts
git commit -m "feat: add pure membership expiry gate logic"
```

---

## Task 5: Preferencia y helper de biometría

**Files:**
- Create: `lib/auth/biometric.ts`
- Test: `lib/auth/biometric.test.ts`

**Interfaces:**
- Produces: `getBiometricPreference(): Promise<boolean>`, `setBiometricPreference(enabled: boolean): Promise<void>`, `authenticateWithBiometrics(): Promise<boolean>` — consumidas por Task 6 (`AuthContext`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// lib/auth/biometric.test.ts
import * as SecureStore from "expo-secure-store"
import * as LocalAuthentication from "expo-local-authentication"
import { getBiometricPreference, setBiometricPreference, authenticateWithBiometrics } from "./biometric"

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}))

describe("biometric preference", () => {
  beforeEach(() => jest.clearAllMocks())

  it("defaults to false when no preference is stored", async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    expect(await getBiometricPreference()).toBe(false)
  })

  it("returns true when preference was stored as enabled", async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue("true")
    expect(await getBiometricPreference()).toBe(true)
  })

  it("persists the preference as a string", async () => {
    await setBiometricPreference(true)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("biometric_enabled", "true")
  })
})

describe("authenticateWithBiometrics", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns false when the device has no biometric hardware", async () => {
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false)
    expect(await authenticateWithBiometrics()).toBe(false)
  })

  it("returns false when no biometrics are enrolled", async () => {
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false)
    expect(await authenticateWithBiometrics()).toBe(false)
  })

  it("returns true when authentication succeeds", async () => {
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
    expect(await authenticateWithBiometrics()).toBe(true)
  })

  it("returns false when the user cancels or fails", async () => {
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false })
    expect(await authenticateWithBiometrics()).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- biometric`
Expected: FAIL con "Cannot find module './biometric'"

- [ ] **Step 3: Implementar**

```typescript
// lib/auth/biometric.ts
import * as SecureStore from "expo-secure-store"
import * as LocalAuthentication from "expo-local-authentication"

const BIOMETRIC_PREFERENCE_KEY = "biometric_enabled"

export async function getBiometricPreference(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_PREFERENCE_KEY)
  return value === "true"
}

export async function setBiometricPreference(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_PREFERENCE_KEY, enabled ? "true" : "false")
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return false

  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  if (!isEnrolled) return false

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirmá tu identidad para continuar",
  })

  return result.success
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- biometric`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/biometric.ts lib/auth/biometric.test.ts
git commit -m "feat: add biometric preference storage and authentication helper"
```

---

## Task 6: `AuthContext` — orquesta sesión, membresía y biometría

**Files:**
- Create: `lib/auth/AuthContext.tsx`
- Test: `lib/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 3), `isMembershipBlocked` (Task 4), `getBiometricPreference` / `authenticateWithBiometrics` (Task 5).
- Produces: `AuthProvider` (component), `useAuth()` hook devolviendo `{ session: Session | null; loading: boolean; membershipBlocked: boolean; signIn: (email: string, password: string) => Promise<{ error: string | null }>; signOut: () => Promise<void> }` — consumido por Task 8 (login screen) y Task 9 (layout raíz).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// lib/auth/AuthContext.test.tsx
import React from "react"
import { render, waitFor, act } from "@testing-library/react-native"
import { Text } from "react-native"
import { AuthProvider, useAuth } from "./AuthContext"
import { supabase } from "../supabase/client"
import { authenticateWithBiometrics, getBiometricPreference } from "./biometric"

jest.mock("../supabase/client", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}))

jest.mock("./biometric", () => ({
  getBiometricPreference: jest.fn(),
  authenticateWithBiometrics: jest.fn(),
}))

function Probe() {
  const { session, loading, membershipBlocked } = useAuth()
  return (
    <Text testID="probe">
      {JSON.stringify({ hasSession: !!session, loading, membershipBlocked })}
    </Text>
  )
}

function mockProfileQuery(profile: { role: string; membership_expires_at: string | null }) {
  ;(supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  })
}

describe("AuthProvider", () => {
  beforeEach(() => jest.clearAllMocks())

  it("starts with loading=true and no session when nothing is stored", async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } })
    ;(getBiometricPreference as jest.Mock).mockResolvedValue(false)

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      const parsed = JSON.parse(getByTestId("probe").props.children)
      expect(parsed.loading).toBe(false)
      expect(parsed.hasSession).toBe(false)
    })
  })

  it("blocks navigation when biometrics are enabled but authentication fails", async () => {
    const fakeSession = { user: { id: "user-1" } }
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: fakeSession } })
    ;(getBiometricPreference as jest.Mock).mockResolvedValue(true)
    ;(authenticateWithBiometrics as jest.Mock).mockResolvedValue(false)

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      const parsed = JSON.parse(getByTestId("probe").props.children)
      expect(parsed.loading).toBe(false)
      expect(parsed.hasSession).toBe(false)
    })
  })

  it("marks membershipBlocked true for an expired member profile", async () => {
    const fakeSession = { user: { id: "user-1" } }
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: fakeSession } })
    ;(getBiometricPreference as jest.Mock).mockResolvedValue(false)
    mockProfileQuery({ role: "member", membership_expires_at: "2020-01-01T00:00:00.000Z" })

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      const parsed = JSON.parse(getByTestId("probe").props.children)
      expect(parsed.membershipBlocked).toBe(true)
    })
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- AuthContext`
Expected: FAIL con "Cannot find module './AuthContext'"

- [ ] **Step 3: Implementar**

```typescript
// lib/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "../supabase/client"
import { isMembershipBlocked } from "./membershipGate"
import { authenticateWithBiometrics, getBiometricPreference } from "./biometric"

type AuthContextValue = {
  session: Session | null
  loading: boolean
  membershipBlocked: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function checkMembership(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, membership_expires_at")
    .eq("id", userId)
    .single()

  if (!profile) return true

  return isMembershipBlocked(profile as { role: string; membership_expires_at: string | null })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [membershipBlocked, setMembershipBlocked] = useState(false)

  async function applySession(nextSession: Session | null) {
    if (!nextSession) {
      setSession(null)
      setMembershipBlocked(false)
      return
    }

    const blocked = await checkMembership(nextSession.user.id)
    if (blocked) {
      await supabase.auth.signOut()
      setSession(null)
      setMembershipBlocked(true)
      return
    }

    setMembershipBlocked(false)
    setSession(nextSession)
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const { data } = await supabase.auth.getSession()
      const storedSession = data.session

      if (storedSession) {
        const biometricEnabled = await getBiometricPreference()
        if (biometricEnabled) {
          const authenticated = await authenticateWithBiometrics()
          if (!authenticated) {
            if (isMounted) {
              setSession(null)
              setLoading(false)
            }
            return
          }
        }
      }

      await applySession(storedSession)
      if (isMounted) setLoading(false)
    }

    bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: "Email o contraseña incorrectos" }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, membershipBlocked, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- AuthContext`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/AuthContext.tsx lib/auth/AuthContext.test.tsx
git commit -m "feat: add auth context orchestrating session, membership gate and biometrics"
```

---

## Task 7: Deep link parsing para reset de contraseña (lógica pura)

**Files:**
- Create: `lib/auth/deepLink.ts`
- Test: `lib/auth/deepLink.test.ts`

**Interfaces:**
- Produces: `parseResetPasswordLink(url: string): { accessToken: string; refreshToken: string } | null` — consumida por Task 10 (`app/reset-password.tsx`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// lib/auth/deepLink.test.ts
import { parseResetPasswordLink } from "./deepLink"

describe("parseResetPasswordLink", () => {
  it("extracts tokens from a valid recovery link with query params", () => {
    const url = "gymflowmember://reset-password?access_token=abc123&refresh_token=xyz789&type=recovery"
    expect(parseResetPasswordLink(url)).toEqual({ accessToken: "abc123", refreshToken: "xyz789" })
  })

  it("extracts tokens from a universal link with a hash fragment", () => {
    const url = "https://voltia-fitness.com/reset-password#access_token=abc123&refresh_token=xyz789&type=recovery"
    expect(parseResetPasswordLink(url)).toEqual({ accessToken: "abc123", refreshToken: "xyz789" })
  })

  it("returns null when type is not recovery", () => {
    const url = "gymflowmember://reset-password?access_token=abc123&refresh_token=xyz789&type=signup"
    expect(parseResetPasswordLink(url)).toBeNull()
  })

  it("returns null when tokens are missing", () => {
    const url = "gymflowmember://reset-password?type=recovery"
    expect(parseResetPasswordLink(url)).toBeNull()
  })

  it("returns null for a malformed url", () => {
    expect(parseResetPasswordLink("not-a-url")).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- deepLink`
Expected: FAIL con "Cannot find module './deepLink'"

- [ ] **Step 3: Implementar**

```typescript
// lib/auth/deepLink.ts
export function parseResetPasswordLink(url: string): { accessToken: string; refreshToken: string } | null {
  let paramString: string

  try {
    if (url.includes("#")) {
      paramString = url.split("#")[1] ?? ""
    } else if (url.includes("?")) {
      paramString = url.split("?")[1] ?? ""
    } else {
      return null
    }
  } catch {
    return null
  }

  const params = new URLSearchParams(paramString)
  const type = params.get("type")
  const accessToken = params.get("access_token")
  const refreshToken = params.get("refresh_token")

  if (type !== "recovery" || !accessToken || !refreshToken) {
    return null
  }

  return { accessToken, refreshToken }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- deepLink`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/deepLink.ts lib/auth/deepLink.test.ts
git commit -m "feat: add pure parser for password recovery deep links"
```

---

## Task 8: Pantalla de login

**Files:**
- Create: `app/login.tsx`
- Test: `app/login.test.tsx`
- Create: `constants/theme.ts`

**Interfaces:**
- Consumes: `useAuth()` (Task 6, `signIn`).
- Produces: ruta `/login` que consume Task 9 (layout raíz) para el redirect post-login.

- [ ] **Step 1: Definir constantes de marca**

```typescript
// constants/theme.ts
export const colors = {
  brand: "#D50000",
  background: "#0A0A0A",
  text: "#FFFFFF",
  textMuted: "#A1A1AA",
  error: "#FF6B6B",
}

export const fonts = {
  heading: "Anton_400Regular",
  body: "Inter_400Regular",
}
```

- [ ] **Step 2: Escribir el test que falla**

```typescript
// app/login.test.tsx
import React from "react"
import { render, fireEvent, waitFor } from "@testing-library/react-native"
import LoginScreen from "./login"
import { useAuth } from "../lib/auth/AuthContext"

jest.mock("../lib/auth/AuthContext", () => ({
  useAuth: jest.fn(),
}))

describe("LoginScreen", () => {
  beforeEach(() => jest.clearAllMocks())

  it("calls signIn with the entered email and password", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({ signIn })

    const { getByPlaceholderText, getByText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText("Email"), "socio@test.com")
    fireEvent.changeText(getByPlaceholderText("Contraseña"), "supersecret")
    fireEvent.press(getByText("Iniciar sesión"))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("socio@test.com", "supersecret")
    })
  })

  it("shows an error message when signIn fails", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: "Email o contraseña incorrectos" })
    ;(useAuth as jest.Mock).mockReturnValue({ signIn })

    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText("Email"), "socio@test.com")
    fireEvent.changeText(getByPlaceholderText("Contraseña"), "wrong")
    fireEvent.press(getByText("Iniciar sesión"))

    expect(await findByText("Email o contraseña incorrectos")).toBeTruthy()
  })

  it("disables the submit button while loading", async () => {
    let resolveSignIn: (v: { error: string | null }) => void = () => {}
    const signIn = jest.fn(
      () =>
        new Promise<{ error: string | null }>((resolve) => {
          resolveSignIn = resolve
        })
    )
    ;(useAuth as jest.Mock).mockReturnValue({ signIn })

    const { getByPlaceholderText, getByText } = render(<LoginScreen />)
    fireEvent.changeText(getByPlaceholderText("Email"), "socio@test.com")
    fireEvent.changeText(getByPlaceholderText("Contraseña"), "supersecret")
    fireEvent.press(getByText("Iniciar sesión"))

    expect(getByText("Ingresando...")).toBeTruthy()
    resolveSignIn({ error: null })
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- app/login`
Expected: FAIL con "Cannot find module './login'"

- [ ] **Step 4: Implementar**

```tsx
// app/login.tsx
import React, { useState } from "react"
import { View, TextInput, Text, Pressable, StyleSheet } from "react-native"
import { router } from "expo-router"
import { useAuth } from "../lib/auth/AuthContext"
import { supabase } from "../lib/supabase/client"
import { colors } from "../constants/theme"

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.replace("/")
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Ingresá tu email para recuperar la contraseña")
      return
    }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://voltia-fitness.com/reset-password",
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GymFlow</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Ingresando..." : "Iniciar sesión"}</Text>
      </Pressable>

      <Pressable onPress={handleForgotPassword}>
        <Text style={styles.link}>Olvidé mi contraseña</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24, gap: 16 },
  title: { color: colors.brand, fontSize: 32, fontFamily: "Anton_400Regular", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#333", borderRadius: 8, padding: 12, color: colors.text },
  button: { backgroundColor: colors.brand, borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: colors.text, fontWeight: "600" },
  error: { color: colors.error, textAlign: "center" },
  link: { color: colors.textMuted, textAlign: "center", marginTop: 8 },
})
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test -- app/login`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add app/login.tsx app/login.test.tsx constants/theme.ts
git commit -m "feat: add login screen with email/password and forgot password"
```

---

## Task 9: Layout raíz — gating de navegación y pantalla de membresía vencida

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `app/membership-expired.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth()` (Task 6).
- Produces: ruta `/` (placeholder de home, fuera de alcance de este plan más allá del stub) y `/membership-expired`.

No hay lógica pura nueva acá — es composición de rutas, se valida con smoke test manual (Step 3) porque el ruteo real de Expo Router requiere el runtime completo.

- [ ] **Step 1: Implementar el layout raíz**

```tsx
// app/_layout.tsx
import React from "react"
import { Stack, Redirect } from "expo-router"
import { AuthProvider, useAuth } from "../lib/auth/AuthContext"
import { View, ActivityIndicator } from "react-native"
import { colors } from "../constants/theme"

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading, membershipBlocked } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  if (membershipBlocked) {
    return <Redirect href="/membership-expired" />
  }

  if (!session) {
    return <Redirect href="/login" />
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate>
        <Stack screenOptions={{ headerShown: false }} />
      </Gate>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Implementar la pantalla de membresía vencida y el stub de home**

```tsx
// app/membership-expired.tsx
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { colors } from "../constants/theme"

export default function MembershipExpiredScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Membresía vencida</Text>
      <Text style={styles.message}>Regularizá tu situación en el gimnasio para volver a acceder.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24, gap: 12 },
  title: { color: colors.brand, fontSize: 24, fontFamily: "Anton_400Regular", textAlign: "center" },
  message: { color: colors.text, textAlign: "center" },
})
```

```tsx
// app/index.tsx
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { colors } from "../constants/theme"

export default function HomeStub() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sesión iniciada. Home real fuera de alcance de este plan.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 },
  text: { color: colors.text, textAlign: "center" },
})
```

- [ ] **Step 3: Smoke test manual**

Run: `npx expo start` y abrir en un simulador/dispositivo.
Expected: sin sesión, la app redirige a `/login`. Después de un login válido, redirige a `/` (stub de home).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/index.tsx app/membership-expired.tsx
git commit -m "feat: gate navigation on session and membership status"
```

---

## Task 10: Pantalla de reset de contraseña (destino del deep link)

**Files:**
- Create: `app/reset-password.tsx`
- Test: `app/reset-password.test.tsx`

**Interfaces:**
- Consumes: `parseResetPasswordLink` (Task 7), `supabase` (Task 3).

Los links de recovery de Supabase llevan los tokens en el **fragment** de la URL (`#access_token=...`), no en query params — `useLocalSearchParams` de Expo Router no los resuelve de forma confiable ahí. Por eso esta pantalla lee la URL cruda con `expo-linking` y la parsea con `parseResetPasswordLink` (Task 7), en vez de depender del parsing automático de rutas.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// app/reset-password.test.tsx
import React from "react"
import { render, fireEvent, waitFor } from "@testing-library/react-native"
import * as Linking from "expo-linking"
import ResetPasswordScreen from "./reset-password"
import { supabase } from "../lib/supabase/client"

jest.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: jest.fn().mockResolvedValue({ error: null }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(),
  useURL: jest.fn(),
}))

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}))

describe("ResetPasswordScreen", () => {
  beforeEach(() => jest.clearAllMocks())

  it("updates the password using the tokens parsed from the deep link", async () => {
    ;(Linking.useURL as jest.Mock).mockReturnValue(
      "gymflowmember://reset-password?access_token=abc123&refresh_token=xyz789&type=recovery"
    )

    const { getByPlaceholderText, getByText } = render(<ResetPasswordScreen />)

    fireEvent.changeText(getByPlaceholderText("Nueva contraseña"), "nuevaClaveSegura123")
    fireEvent.press(getByText("Guardar nueva contraseña"))

    await waitFor(() => {
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "abc123",
        refresh_token: "xyz789",
      })
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "nuevaClaveSegura123" })
    })
  })

  it("shows an error and does not call supabase when the link has no valid tokens", async () => {
    ;(Linking.useURL as jest.Mock).mockReturnValue("gymflowmember://reset-password")

    const { getByPlaceholderText, getByText, findByText } = render(<ResetPasswordScreen />)

    fireEvent.changeText(getByPlaceholderText("Nueva contraseña"), "nuevaClaveSegura123")
    fireEvent.press(getByText("Guardar nueva contraseña"))

    expect(await findByText("Link inválido o vencido")).toBeTruthy()
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- app/reset-password`
Expected: FAIL con "Cannot find module './reset-password'"

- [ ] **Step 3: Implementar**

```tsx
// app/reset-password.tsx
import React, { useState } from "react"
import { View, TextInput, Text, Pressable, StyleSheet } from "react-native"
import { router } from "expo-router"
import * as Linking from "expo-linking"
import { supabase } from "../lib/supabase/client"
import { parseResetPasswordLink } from "../lib/auth/deepLink"
import { colors } from "../constants/theme"

export default function ResetPasswordScreen() {
  const url = Linking.useURL()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const tokens = url ? parseResetPasswordLink(url) : null

    if (!tokens) {
      setError("Link inválido o vencido")
      return
    }

    setSaving(true)
    setError(null)

    await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError("No se pudo actualizar la contraseña")
      return
    }

    router.replace("/login")
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nueva contraseña</Text>
      <TextInput
        style={styles.input}
        placeholder="Nueva contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Guardando..." : "Guardar nueva contraseña"}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24, gap: 16 },
  title: { color: colors.brand, fontSize: 24, fontFamily: "Anton_400Regular", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#333", borderRadius: 8, padding: 12, color: colors.text },
  button: { backgroundColor: colors.brand, borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: colors.text, fontWeight: "600" },
  error: { color: colors.error, textAlign: "center" },
})
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- app/reset-password`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/reset-password.tsx app/reset-password.test.tsx
git commit -m "feat: add password reset screen handling deep link tokens"
```

---

## Task 11: Archivos `.well-known` para universal/app links (repo `gym-saas`)

Esta tarea se ejecuta en el repo **`gym-saas`** (Next.js), no en `gym-saas-mobile` — es la única dependencia cruzada entre ambos repos.

**Files:**
- Create: `c:\wamp64\www\gym-saas\app\.well-known\apple-app-site-association\route.ts`
- Create: `c:\wamp64\www\gym-saas\app\.well-known\assetlinks.json\route.ts`

**Interfaces:**
- Produces: `GET https://voltia-fitness.com/.well-known/apple-app-site-association` y `GET https://voltia-fitness.com/.well-known/assetlinks.json`, requeridos por `app.json` (Task 1) para que el deep link de reset abra la app.

- [ ] **Step 1: Implementar el archivo de iOS**

```typescript
// app/.well-known/apple-app-site-association/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "TEAMID.com.gymflow.member",
            paths: ["/reset-password"],
          },
        ],
      },
    },
    { headers: { "Content-Type": "application/json" } }
  )
}
```

Nota: `TEAMID` se reemplaza por el Apple Team ID real una vez creada la cuenta de developer — hasta entonces este archivo no valida en iOS, pero no rompe nada (Android no lo usa).

- [ ] **Step 2: Implementar el archivo de Android**

```typescript
// app/.well-known/assetlinks.json/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.gymflow.member",
          sha256_cert_fingerprints: ["PENDIENTE_FINGERPRINT_EAS"],
        },
      },
    ],
    { headers: { "Content-Type": "application/json" } }
  )
}
```

Nota: `sha256_cert_fingerprints` se completa con el fingerprint real que devuelve `eas credentials` una vez generado el keystore de producción.

- [ ] **Step 3: Verificar manualmente**

Run: `curl https://voltia-fitness.com/.well-known/assetlinks.json` (una vez deployado)
Expected: JSON válido, status 200.

- [ ] **Step 4: Commit**

```bash
git add app/.well-known
git commit -m "feat(mobile-links): exponer archivos well-known para deep links de la app de socios"
```

---

## Task 12: EAS build de desarrollo y checklist de validación manual

**Files:**
- Modify: `eas.json`

**Interfaces:**
- Ninguna — tarea de configuración y checklist, sin código de producción nuevo.

- [ ] **Step 1: Configurar perfiles de build**

```json
// eas.json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 2: Generar development build**

```bash
eas build --profile development --platform all
```

- [ ] **Step 3: Checklist de validación manual en dispositivo real** (no automatizable)

- [ ] Login con credenciales válidas navega al stub de home.
- [ ] Login con credenciales inválidas muestra el error genérico.
- [ ] Tras el primer login, aparece el prompt de activar biometría; aceptar y volver a abrir la app pide Face ID/huella antes de restaurar sesión.
- [ ] Cancelar la biometría cae al formulario manual sin trabarse.
- [ ] Un usuario con `membership_expires_at` vencida es expulsado a `/membership-expired` y no puede navegar más allá.
- [ ] Tocar el link de "olvidé mi contraseña" del mail abre la app directo en `/reset-password` (requiere los archivos `.well-known` deployados de Task 11 y el build firmado con el keystore correcto).

- [ ] **Step 4: Commit**

```bash
git add eas.json
git commit -m "chore: configure eas build profiles for development and production"
```
