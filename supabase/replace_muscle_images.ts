/**
 * Reemplaza en el bucket público "muscles" las imágenes verificadas que salieron
 * del rediseño de la muscle card en Figma (ver PlanEditor.tsx, MUSCLE_ZONE_IMAGE).
 * Correr con: npx tsx supabase/replace_muscle_images.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Nota: las 19 imágenes fueron verificadas manualmente contra el músculo que
 * representan (incluye las 6 que se corrigieron en varias rondas en Figma:
 * Tríceps, Cuádriceps, Isquiotibiales, Lumbar, Sóleo, Pectoral Menor).
 */

// Node 20 no tiene WebSocket nativo — parcheamos antes de que Supabase lo pida
// eslint-disable-next-line @typescript-eslint/no-require-imports
;(globalThis as Record<string, unknown>).WebSocket ??= require("ws")

// tsx no carga .env.local automáticamente — lo hacemos acá
import { readFileSync } from "fs"
import { join } from "path"

try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8")
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
} catch { /* si no existe, sigue con las vars del sistema */ }

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Carpeta con las imágenes nuevas bajadas de Figma (ver sesión del 2026-08-18)
const SOURCE_DIR =
  "C:/Users/gabri/AppData/Local/Temp/claude/c--wamp64-www-gym-saas/144623c8-8056-44bb-82ab-83c89204d1c2/scratchpad/muscles_new"

// Las 19, verificadas contra el músculo real que representan
const VERIFIED_FILES = [
  "1.png",  // Hombros
  "2.png",  // Pecho
  "3.png",  // Tríceps
  "5.png",  // Core
  "6.png",  // Oblicuos
  "7.png",  // Deltoides Anterior
  "8.png",  // Pantorrillas
  "10.png", // Espalda
  "11.png", // Trapecio
  "14.png", // Cuádriceps
  "16.png", // Bíceps
  "20.png", // Romboides
  "22.png", // Isquiotibiales
  "23.png", // Lumbar
  "24.png", // Sóleo
  "25.png", // Serratos
  "26.png", // Pectoral Menor
  "27.png", // Deltoides Posterior
  "28.png", // Glúteos
]

async function main() {
  let ok = 0
  let failed = 0

  for (const file of VERIFIED_FILES) {
    const bytes = readFileSync(join(SOURCE_DIR, file))
    const { error } = await admin.storage
      .from("muscles")
      .upload(file, bytes, { contentType: "image/png", upsert: true })

    if (error) {
      console.error(`✗ ${file}: ${error.message}`)
      failed++
    } else {
      console.log(`✓ ${file}`)
      ok++
    }
  }

  console.log(`\nListo: ${ok} subidas, ${failed} con error.`)
  if (failed > 0) process.exit(1)
}

main()
