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
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer"
import path from "path"
import fs from "fs"
import { MUSCLE_ANATOMY } from "../lib/muscle-anatomy"

const sourceDir = process.env.ANATOMY_SOURCE_DIR
if (!sourceDir) {
  console.error("Falta ANATOMY_SOURCE_DIR (carpeta con Startup.gltf + model.bin)")
  process.exit(1)
}

// Los 19 nodos trackeados: interactivos (click, highlight, sheet de detalle).
const TRACKED_NAMES = new Set(
  Object.values(MUSCLE_ANATOMY).flatMap(entry => entry.nodeNames)
)

// Ademas de los 19 grupos trackeados, conservamos el resto del sistema
// muscular como relleno puramente visual — para que el cuerpo se vea
// completo y conectado en vez de 19 piezas sueltas flotando en el vacio.
// Estos nodos decorativos NO se agregan a MUSCLE_ANATOMY ni a ningun mapa
// de interaccion: MuscleAnatomy3D.tsx resuelve highlight/click por
// `nodeNameToZone.get(name)`, que devuelve undefined para cualquier nombre
// no trackeado y simplemente no hace nada — no hace falta tocar ese
// componente para que queden no-interactivos por default.
//
// Criterio para "es tejido muscular real" (confirmado explorando el arbol
// completo de Startup.gltf, no asumido a priori):
//   - el nombre contiene "muscle" (case-insensitive)
//   - el nodo tiene mesh propio (geometria real, no un grupo contenedor)
//   - el sufijo es EXACTAMENTE .l, .r, .el, .er, .ol u .or (sin digitos)
//
// Por que ese patron de sufijo y no simplemente "contiene muscle":
//   - Los nodos "*.g" (ej. "Muscles of abdomen.g") SI tienen un mesh propio,
//     pero es un placeholder/icono de outliner de Z-Anatomy (cientos de
//     vertices) muy por debajo de sus hijos reales (decenas de miles) — no
//     es geometria anatomica, es UI interna del modelo fuente. Sus hijos
//     reales son justamente los nodos ".l"/".r"/etc que este patron captura.
//   - Los sufijos alfanumericos con digito (".o1l", ".e2r", etc, 136 nodos)
//     son fragmentos diminutos de insercion/origen osea de un musculo (su
//     padre es un HUESO puntual, ej. "Tibialis anterior muscle.e1l" cuelga
//     de "First metatarsal bone.l"), no el cuerpo del musculo — el cuerpo
//     principal es el nodo SIN digito (".l"/".el"/".ol"). Incluir tambien
//     los fragmentos duplicaria geometria sobre el mismo punto de insercion.
//   - "Groove for X muscle...bone" (12 nodos) es hueso — la palabra "muscle"
//     aparece en su descripcion anatomica ("surco para el tendon del
//     musculo X"), pero termina en sufijo .s/.t/.i, que este patron no
//     matchea, asi que quedan excluidos sin necesitar una regla aparte.
//
// El patron de sufijo NO alcanza para excluir todo lo no-muscular: hay 44
// nodos que pasan nombre+mesh+sufijo pero son tejido ADYACENTE a un musculo,
// no el musculo en si — Z-Anatomy nombra nervios/bolsas/tendones por el
// musculo al que acompañan (ej. "Nerve to piriformis muscle.l", geometria de
// cordon, hasta 2392 vertices — nada despreciable, se ve tan fuera de lugar
// como un hueso suelto si queda con material de musculo). Se excluyen por
// palabra clave, sin tocar el resto del criterio:
//   - "nerve"          -> "Nerve to mylohyoid muscle.l/r", etc.
//   - "bursa"           -> "Subtendinous bursa of...", "Trochanteric bursa
//                          of...", "Sciatic bursa of...", etc.
//   - "tendon sheath"   -> "Tendon sheath of tibialis posterior muscle.l/r"
//   - "tendon of"       -> tendones nombrados por el musculo que traccionan,
//                          no el vientre muscular en si.
const DECORATIVE_SUFFIX = /\.(el|er|ol|or|l|r)$/
const NON_MUSCLE_TISSUE = /\b(nerve|bursa|tendon sheath|tendon of)\b/i
function isDecorativeMuscleNode(node: import("@gltf-transform/core").Node): boolean {
  const name = node.getName()
  return /muscle/i.test(name) && !NON_MUSCLE_TISSUE.test(name) && !!node.getMesh() && DECORATIVE_SUFFIX.test(name)
}

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

  // Fase 1: para cada nodo de musculo a conservar (trackeado o decorativo),
  // hornear su transformacion MUNDIAL (no la local, que es relativa a un
  // hueso/grupo padre que vamos a borrar) y re-parentarlo directo a la
  // escena. Tiene que pasar ANTES de borrar nada, porque getWorldMatrix()
  // depende de la jerarquia original todavia intacta.
  let trackedKept = 0
  let decorativeKept = 0
  const keptNames = new Set<string>()
  for (const node of root.listNodes()) {
    const name = node.getName()
    const isTracked = TRACKED_NAMES.has(name)
    if (!isTracked && !isDecorativeMuscleNode(node)) continue
    const worldMatrix = node.getWorldMatrix()
    node.setMatrix(worldMatrix)
    scene.addChild(node)
    keptNames.add(name)
    if (isTracked) trackedKept++
    else decorativeKept++
  }
  console.log(`Nodos trackeados conservados: ${trackedKept} / esperados: ${TRACKED_NAMES.size}`)
  console.log(`Nodos decorativos conservados (relleno visual, no interactivo): ${decorativeKept}`)

  if (trackedKept < TRACKED_NAMES.size) {
    console.error("Faltan nodos trackeados esperados — revisar MUSCLE_ANATOMY.nodeNames contra el modelo fuente.")
    process.exit(1)
  }

  // Fase 2: ahora que los nodos a conservar ya estan desenganchados de sus
  // padres originales, es seguro borrar todo lo demas (huesos, organos,
  // etiquetas de texto de Z-Anatomy, nodos de grupo vacios, fragmentos de
  // insercion osea de los musculos decorativos).
  let removed = 0
  for (const node of root.listNodes()) {
    const name = node.getName()
    if (keptNames.has(name)) continue
    node.dispose()
    removed++
  }
  console.log(`Nodos eliminados: ${removed}`)

  await document.transform(prune(), dedup())
  console.log(`Triangulos antes de simplify(): ${countTriangles(document)}`)

  // ratio: con SOLO los 19 grupos trackeados (50 nodos) el detalle completo
  // (ratio 1.0, sin decimar) ya entraba comodo en 2-3MB. Al sumar el resto
  // del sistema muscular como relleno visual (578 nodos en total: 50
  // trackeados + 528 decorativos, tras excluir nervios/bolsas/tendones que
  // Z-Anatomy nombra por el musculo al que acompañan pero no son musculo en
  // si — ver isDecorativeMuscleNode()), la geometria se multiplica ~4.3x
  // (165584 -> 710007 triangulos antes de simplify). Con el set de 622/572
  // nodos sin esa exclusion, ratio 1.0 daba 4.11MB (dentro del maximo de
  // 5MB, pero por encima del target); probado 1.0, 0.7, 0.62 y 0.6 (2.96MB)
  // — 0.6 fue el mayor ratio que entraba en el target. Con la exclusion ya
  // aplicada (menos geometria total) ratio 0.6 da 2.89MB — se mantiene el
  // mismo valor: sigue siendo el punto que maximiza detalle dentro del
  // presupuesto 2-3MB, con mas margen ahora que antes.
  await document.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.01 }),
    meshopt({ encoder: MeshoptEncoder }),
  )
  console.log(`Triangulos despues de simplify(): ${countTriangles(document)}`)

  // Color: confirmado (investigacion aparte, ver .superpowers/sdd/.../
  // investigacion-color-material.md) que Z-Anatomy nunca exporto color
  // anatomico real para el tejido muscular — sus materiales ("Origin-
  // Adduction", "Internal rotator", etc.) codifican ROL BIOMECANICO
  // (puntos de origen/insercion, tipo de accion), no apariencia visual, y
  // los 2 materiales que sobreviven a dedup() son blancos puros
  // ([1,1,1,1]) tanto en el .glb curado como ya en el Startup.gltf fuente
  // sin curar — no es algo que el pipeline haya perdido, nunca existio.
  //
  // Se asigna un rojo anatomico apagado UNIFORME a los materiales
  // sobrevivientes (la referencia del usuario es un cuerpo cohesivo, sin
  // distincion visual entre grupos musculares) — deliberadamente mas
  // oscuro/desaturado que HIGHLIGHT_COLOR (#ef4444, rojo vivo) en
  // MuscleAnatomy3D.tsx, para que el contraste entre "musculo en reposo"
  // y "musculo seleccionado" sea claro. Solo 4 floats por material — no
  // agrega textura ni afecta el tamano del .glb de forma relevante.
  //
  // Ademas: los materiales heredan del Startup.gltf fuente un
  // emissiveFactor [1,1,1] (blanco, intensidad maxima) — ya presente antes
  // de este fix, nadie lo habia notado. En MeshStandardMaterial de
  // three.js (lo que usa MuscleAnatomy3D.tsx sin overrides) el color final
  // es baseColor + specular + emissive·intensity: el emissive se SUMA sin
  // iluminar, asi que un emissive blanco a maxima intensidad compite con y
  // probablemente domina sobre cualquier baseColorFactor, empujando el
  // render hacia blanco/palido despues del tone-mapping por defecto de
  // R3F — coincide exactamente con el sintoma original ("blanco/palido,
  // homogeneo"). Se apaga junto con la asignacion de color base, para que
  // el resultado final dependa solo de baseColorFactor + la iluminacion
  // de la escena, como se espera.
  const MUSCLE_BASE_COLOR: [number, number, number, number] = [0.545, 0.180, 0.180, 1] // #8B2E2E
  const NO_EMISSIVE: [number, number, number] = [0, 0, 0]
  for (const material of document.getRoot().listMaterials()) {
    material.setBaseColorFactor(MUSCLE_BASE_COLOR)
    material.setEmissiveFactor(NO_EMISSIVE)
  }
  console.log(`Color base asignado a ${document.getRoot().listMaterials().length} materiales: rgb(${MUSCLE_BASE_COLOR.slice(0, 3).map(c => Math.round(c * 255)).join(", ")}) (#8B2E2E), emissiveFactor apagado [0,0,0]`)

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

  await verifyOutput(outPath)
}

/**
 * Paso 5: releer el .glb YA ESCRITO (con el decoder de meshopt registrado,
 * como lo va a leer el browser) y verificar, para las 19 zonas de
 * MUSCLE_ANATOMY, que su `pointPosition` sigue coincidiendo con el nodo real.
 *
 * Por que releer el archivo final y no comparar contra el documento en
 * memoria: EXT_meshopt_compression cuantiza las posiciones de vertices y,
 * para compensar el shift de cuantizacion, gltf-transform reescribe la
 * matriz del NODO padre de cada malla (ver quantize() en
 * @gltf-transform/functions — "a transform is applied to the parent Node").
 * Eso mueve node.translation aunque el renderizado final sea identico. Si
 * pointPosition (usado como target de camara / punto pulsante en
 * MuscleAnatomy3D.tsx) no se recalcula contra el archivo YA comprimido,
 * queda desincronizado del modelo real sin que nada lo avise — exactamente
 * el bug que este chequeo esta aca para atrapar en corridas futuras.
 *
 * Por que "algun nodeNames[i]" y no siempre nodeNames[0]: para la mayoria
 * de las zonas pointPosition fue tomado del primer nodo (lado izquierdo),
 * pero para "traps" se tomo a mano el nodo "Descending part..." (idx 2) por
 * ser mas representativo visualmente del trapecio completo — no es un bug,
 * es una eleccion de diseno legitima que este chequeo tiene que respetar.
 */
async function verifyOutput(outPath: string) {
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
  const document = await io.read(outPath)
  const root = document.getRoot()
  const scene = root.listScenes()[0]
  const nodes = root.listNodes()

  console.log(`\nVerificacion final — nodos en el .glb: ${nodes.length}`)
  const directChildren = new Set(scene.listChildren())
  const notDirectChild = nodes.filter(n => !directChildren.has(n))
  if (notDirectChild.length > 0) {
    console.error(`ADVERTENCIA: ${notDirectChild.length} nodos NO son hijos directos de la escena:`, notDirectChild.map(n => n.getName()))
    process.exit(1)
  }
  console.log(`Todos los nodos (${nodes.length}) son hijos directos de la escena: OK`)

  const TOLERANCE_M = 0.001 // 1mm — mas que suficiente dado el patron de matches exactos observado
  let anyFailed = false
  for (const [zone, entry] of Object.entries(MUSCLE_ANATOMY)) {
    let bestDist = Infinity
    let bestNodeName = ""
    for (const nodeName of entry.nodeNames) {
      const node = nodes.find(n => n.getName() === nodeName)
      if (!node) continue
      const wm = node.getWorldMatrix()
      const pos: [number, number, number] = [wm[12], wm[13], wm[14]]
      const d = Math.hypot(pos[0] - entry.pointPosition[0], pos[1] - entry.pointPosition[1], pos[2] - entry.pointPosition[2])
      if (d < bestDist) {
        bestDist = d
        bestNodeName = nodeName
      }
    }
    const status = bestDist <= TOLERANCE_M ? "OK" : "FALLA"
    if (bestDist > TOLERANCE_M) anyFailed = true
    console.log(`  ${zone.padEnd(12)} ${status} — dist a "${bestNodeName}": ${(bestDist * 1000).toFixed(2)}mm`)
  }

  if (anyFailed) {
    console.error("\nADVERTENCIA: pointPosition desincronizado del modelo curado en al menos una zona — revisar lib/muscle-anatomy.ts contra este .glb antes de commitear.")
    process.exit(1)
  }
  console.log("\nLas 19 zonas: pointPosition coincide con el modelo curado (dentro de 1mm de tolerancia).")
}

main()
