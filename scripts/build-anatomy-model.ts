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
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.2, error: 0.01 }),
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
