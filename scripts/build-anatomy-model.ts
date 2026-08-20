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
import { EXTMeshoptCompression } from "@gltf-transform/extensions"
import { prune, dedup, simplify, meshopt } from "@gltf-transform/functions"
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer"
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

function countTriangles(document: import("@gltf-transform/core").Document): number {
  let total = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      const position = prim.getAttribute("POSITION")
      if (indices) {
        total += indices.getCount() / 3
      } else if (position) {
        total += position.getCount() / 3
      }
    }
  }
  return total
}

async function main() {
  await MeshoptEncoder.ready

  // El encoder real de EXT_meshopt_compression tiene que estar registrado en
  // el NodeIO ANTES de escribir — si no, la extension se agrega al documento
  // pero se descarta en silencio al momento de serializar (esto fue exactamente
  // el bug de la version anterior de este script con draco()).
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder })
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

  await document.transform(prune(), dedup())
  console.log(`Triangulos antes de simplify(): ${countTriangles(document)}`)

  // ratio: 1.0 = sin decimacion de poligonos. Con la compresion real de
  // meshopt (EXT_meshopt_compression) puesta, los 50 nodos filtrados ya
  // entran comodos en el presupuesto de 2-3MB (~1.2MB) SIN perder ni un
  // triangulo del modelo fuente de Z-Anatomy — no hay motivo para decimar
  // si el detalle completo ya entra en presupuesto. Probado tambien en
  // 0.5 (0.88MB, -41% triangulos) para comparar: no vale la pena resignar
  // detalle anatomico que el presupuesto no exige recortar.
  await document.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: 1.0, error: 0.01 }),
    meshopt({ encoder: MeshoptEncoder }),
  )
  console.log(`Triangulos despues de simplify(): ${countTriangles(document)}`)

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
