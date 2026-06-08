/**
 * Crea los 6 usuarios demo via Supabase Admin API.
 * Correr con: npx tsx supabase/create_demo_users.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

// Node 20 no tiene WebSocket nativo — parcheamos antes de que Supabase lo pida
// eslint-disable-next-line @typescript-eslint/no-require-imports
;(globalThis as Record<string, unknown>).WebSocket ??= require("ws")

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

// tsx no carga .env.local automáticamente — lo hacemos acá
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8")
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
} catch { /* si no existe, sigue con las vars del sistema */ }

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_USERS = [
  { id: "a1000000-0000-0000-0000-000000000001", email: "lucas.martinez@gymflow.demo" },
  { id: "a1000000-0000-0000-0000-000000000002", email: "valentina.garcia@gymflow.demo" },
  { id: "a1000000-0000-0000-0000-000000000003", email: "matias.rodriguez@gymflow.demo" },
  { id: "a1000000-0000-0000-0000-000000000004", email: "sofia.herrera@gymflow.demo" },
  { id: "a1000000-0000-0000-0000-000000000005", email: "federico.lopez@gymflow.demo" },
  { id: "a1000000-0000-0000-0000-000000000006", email: "camila.torres@gymflow.demo" },
]

async function main() {
  console.log("Creando usuarios demo...\n")

  for (const u of DEMO_USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      id:              u.id,
      email:           u.email,
      password:        "Demo1234!",
      email_confirm:   true,
    })

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        console.log(`  ⚠  ${u.email} — ya existe, saltando`)
      } else {
        console.error(`  ✗  ${u.email} — ${error.message}`)
      }
    } else {
      console.log(`  ✓  ${u.email} — ${data.user.id}`)
    }
  }

  console.log("\nListo. Ahora corrés seed_demo.sql en el SQL Editor de Supabase.")
}

main()
