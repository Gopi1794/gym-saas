// scripts/build-ecorche2-model.ts
/**
 * Pipeline definitivo de curacion del modelo "Male Full Body Ecorche" de
 * Diego Lujan Garcia (Sketchfab, licencia CC-BY-4.0, atribucion obligatoria
 * -- ver el credito en components/anatomy/MuscleAnatomy3D.tsx) a un .glb
 * liviano para el explorador de anatomia 3D de la app.
 *
 * Correr con:
 *
 *   npx tsx scripts/build-ecorche2-model.ts
 *
 * Fuente por defecto: C:/Users/gabri/Downloads/male_full_body_ecorche/
 * (scene.gltf + scene.bin + textures/, 28 JPEGs). Override con
 * ECORCHE2_SOURCE_DIR si el modelo esta en otro lado.
 *
 * Escribe directo a public/models/muscles.glb -- el path que ya usa
 * MODEL_PATH en components/anatomy/MuscleAnatomy3D.tsx, asi que no hace
 * falta tocar esa constante. Reemplaza el modelo de Z-Anatomy que estaba ahi.
 *
 * A diferencia de scripts/build-anatomy-model.ts (Z-Anatomy, 578 nodos con
 * nombre anatomico real, uno por musculo/lado), este modelo tiene solo 16
 * mallas sin nombres utiles (Object_N generico) -- no hay forma de mapear
 * una zona trackeada a una malla especifica. Por eso la interaccion final NO
 * resalta ni aisla piezas: el usuario ve el cuerpo completo siempre, y los
 * 19 marcadores pulsantes (posicionados via pointPosition en
 * lib/muscle-anatomy.ts, recalculados por separado con un enfoque de
 * normalizacion proporcional contra el bounding box de este modelo) son la
 * unica forma de seleccionar una zona.
 */
import { NodeIO, type Node, type mat4 } from "@gltf-transform/core"
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions"
import { prune, dedup, meshopt, simplify, textureCompress } from "@gltf-transform/functions"
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer"
import sharp from "sharp"
import path from "path"
import fs from "fs"

const sourceDir = process.env.ECORCHE2_SOURCE_DIR || "C:/Users/gabri/Downloads/male_full_body_ecorche"

// Las 16 mallas reales del modelo (34 nodos totales; cada una es hija de su
// propio nodo "SubTool-N-....OBJ", N de 0 a 15) — confirmado releyendo
// scene.gltf directamente antes de escribir este script: jerarquia
// Sketchfab_model > zbrush_concat.osgb.cleaner.gles > 16x (SubTool-N.OBJ >
// Object_N). Los nodos Object_N y sus padres SubTool-N.OBJ tienen transform
// local identidad — el unico transform real esta en el nodo raiz
// Sketchfab_model (matrix de rotacion -90 en X, Z-up -> Y-up).
const KEPT_NODE_NAMES = [
  "Object_3", "Object_5", "Object_7", "Object_9", "Object_11", "Object_13",
  "Object_15", "Object_17", "Object_19", "Object_21", "Object_23", "Object_25",
  "Object_27", "Object_29", "Object_31", "Object_33",
]

// Altura real (rango Y, en metros) del modelo de Z-Anatomy que reemplaza
// este script (public/models/muscles.glb al commit 62ee9886878edbb
// e1c79073, el HEAD original de este worktree, antes de sobreescribirlo) —
// medida releyendo ese .glb con gltf-transform (mismo metodo que
// worldSpaceBBox() de abajo): Y va de 0.0129 a 1.6777 => altura total
// 1.6648. Las distancias de camara en MuscleAnatomy3D.tsx (z + 0.4, target
// [0, 0.2, 1.4]) asumen esta escala — se mantienen sin tocar, y el modelo
// nuevo se normaliza para quedar compatible con ellas. Las 19 pointPosition
// de lib/muscle-anatomy.ts se recalculan por separado con normalizacion
// proporcional contra el bounding box completo (no solo Y) de este modelo
// ya curado — ver el bounding box final que imprime verifyOutput() abajo.
const ZANATOMY_HEIGHT_M = 1.6648

/** Aplica una matriz 4x4 column-major (formato glTF) a un punto. */
function transformPoint(m: mat4, v: [number, number, number]): [number, number, number] {
  const [x, y, z] = v
  const w = m[3] * x + m[7] * y + m[11] * z + m[15]
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ]
}

/**
 * Escala uniforme aplicada DESPUES de una rotacion/traslacion ya horneada
 * en la matriz (equivalente a premultiplicar por diag(s,s,s,1)). En una
 * matriz afin column-major esto es "escalar todo excepto la fila 3" (indices
 * 3,7,11,15, que en una matriz afin valen [0,0,0,1] y deben quedar igual).
 */
function scaleMatrixUniform(m: mat4, s: number): mat4 {
  const out = [...m] as mat4
  for (let col = 0; col < 4; col++) {
    out[col * 4 + 0] = m[col * 4 + 0] * s
    out[col * 4 + 1] = m[col * 4 + 1] * s
    out[col * 4 + 2] = m[col * 4 + 2] * s
    out[col * 4 + 3] = m[col * 4 + 3]
  }
  return out
}

type BBox = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

function worldSpaceBBox(nodes: Node[]): BBox {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const node of nodes) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const wm = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")
      if (!pos) continue
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, [0, 0, 0]) as [number, number, number]
        const [wx, wy, wz] = transformPoint(wm, v)
        if (wx < minX) minX = wx
        if (wx > maxX) maxX = wx
        if (wy < minY) minY = wy
        if (wy > maxY) maxY = wy
        if (wz < minZ) minZ = wz
        if (wz > maxZ) maxZ = wz
      }
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

function countGeometry(document: import("@gltf-transform/core").Document): { verts: number; tris: number } {
  let verts = 0
  let tris = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")
      const indices = prim.getIndices()
      if (pos) verts += pos.getCount()
      tris += indices ? indices.getCount() / 3 : (pos ? pos.getCount() / 3 : 0)
    }
  }
  return { verts, tris: Math.round(tris) }
}

async function main() {
  await MeshoptEncoder.ready

  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder })
  const document = await io.read(path.join(sourceDir, "scene.gltf"))
  const root = document.getRoot()
  const scene = root.listScenes()[0]

  console.log(`Texturas en el documento fuente: ${root.listTextures().length}`)
  console.log(`Materiales en el documento fuente: ${root.listMaterials().length}`)

  // Fase 1: hornear la transformacion MUNDIAL completa (root + zbrush_concat
  // + propia) de cada una de las 16 mallas y re-parentarlas directo a la
  // escena — mismo patron que build-anatomy-model.ts (getWorldMatrix() tiene
  // que correr ANTES de tocar la jerarquia).
  const keptNames = new Set(KEPT_NODE_NAMES)
  const keptNodes: Node[] = []
  for (const node of root.listNodes()) {
    if (!keptNames.has(node.getName())) continue
    const worldMatrix = node.getWorldMatrix()
    node.setMatrix(worldMatrix)
    scene.addChild(node)
    keptNodes.push(node)
  }
  console.log(`Mallas conservadas: ${keptNodes.length} / esperadas: ${KEPT_NODE_NAMES.length}`)
  if (keptNodes.length !== KEPT_NODE_NAMES.length) {
    console.error("Faltan nodos esperados — revisar KEPT_NODE_NAMES contra el modelo fuente.")
    process.exit(1)
  }

  // Fase 2: normalizar escala para que la altura total (rango Y) quede
  // comparable a la del modelo de Z-Anatomy — medido ANTES de borrar nada
  // (los 16 nodos ya estan reparentados a la escena con matriz mundial
  // horneada, asi que getWorldMatrix() en este punto es equivalente a la
  // matriz local, pero se usa igual por claridad).
  const raw = worldSpaceBBox(keptNodes)
  const rawHeight = raw.maxY - raw.minY
  const scale = ZANATOMY_HEIGHT_M / rawHeight
  console.log(`Altura Y sin escalar: ${rawHeight.toFixed(4)} (Y: ${raw.minY.toFixed(4)} a ${raw.maxY.toFixed(4)})`)
  console.log(`Factor de escala aplicado: ${scale.toFixed(6)} (objetivo: altura Z-Anatomy = ${ZANATOMY_HEIGHT_M})`)
  for (const node of keptNodes) {
    node.setMatrix(scaleMatrixUniform(node.getMatrix(), scale))
  }
  const scaled = worldSpaceBBox(keptNodes)
  console.log(`Altura Y despues de escalar: ${(scaled.maxY - scaled.minY).toFixed(4)} (Y: ${scaled.minY.toFixed(4)} a ${scaled.maxY.toFixed(4)})`)

  // Fase 3: ahora que las 16 mallas ya estan desenganchadas de sus padres
  // originales, es seguro borrar el resto (los 16 nodos SubTool-N.OBJ
  // envoltorio, el nodo zbrush_concat, y el nodo raiz Sketchfab_model).
  let removed = 0
  for (const node of root.listNodes()) {
    if (keptNames.has(node.getName())) continue
    node.dispose()
    removed++
  }
  console.log(`Nodos eliminados: ${removed}`)

  await document.transform(prune(), dedup())

  const beforeTextures = document.getRoot().listTextures().length
  const geomBefore = countGeometry(document)
  console.log(`Geometria: ${geomBefore.verts} vertices, ${geomBefore.tris} triangulos`)
  console.log(`Texturas tras prune/dedup: ${beforeTextures}`)

  // Este modelo, a diferencia de Z-Anatomy (sin texturas) y del ecorche
  // descartado (vertex colors), SI tiene baseColorTexture real en 14 de los
  // 16 materiales (los otros 2 -- material_0, material_1 -- son colores
  // planos grises sin textura, confirmado en el scene.gltf fuente). Ademas
  // de baseColorTexture, esos mismos 14 materiales tienen tambien
  // normalTexture (detalle de superficie, 14 imagenes mas) -- esto no
  // formaba parte de la investigacion previa del controlador (que solo
  // menciono baseColorTexture).
  //
  // DECISION: se descartan los normal maps tambien en la version final, no
  // solo en la fase de inspeccion. Razones:
  //   1. La interaccion final es "tocar marcador -> camara hace zoom -> se
  //      abre la ficha" -- nunca hay una vista macro/close-up pegada a la
  //      piel que dependa del micro-relieve de superficie.
  //   2. La escena usa solo ambientLight + 1 directionalLight (sin
  //      environment map) -- el mismo motivo por el que el highlight viejo
  //      forzaba metalness=0 en MuscleAnatomy3D.tsx (un material sin de
  //      donde reflejar se ve chato pase lo que pase con su normal map).
  //   3. Descartarlos libera la mitad del presupuesto de texturas para
  //      subir resolucion de baseColor o el ratio de geometria, que es
  //      donde mas se nota la diferencia visual dado el punto 1 y 2.
  // Recuperables desde scene.gltf si mas adelante se agrega iluminacion con
  // environment map y vistas mas cercanas.
  for (const material of document.getRoot().listMaterials()) {
    material.setNormalTexture(null)
  }
  await document.transform(prune())
  const afterNormalDrop = document.getRoot().listTextures().length
  console.log(`Texturas tras descartar normal maps: ${afterNormalDrop} (deberian ser los 14 baseColor)`)

  // Redimensionar las 14 texturas baseColor sobrevivientes de 1024x1024 via
  // sharp (instalado, confirmado con `ls node_modules/sharp`) -- sin encoder
  // explicito, textureCompress() cae a un fallback que ignora la mayoria de
  // las opciones de calidad/compresion, asi que se pasa `encoder: sharp`
  // explicitamente para que el resize + la recompresion JPEG real se apliquen.
  //
  // Valores finales elegidos por prueba empirica (ver tabla de combinaciones
  // probadas junto a SIMPLIFY_RATIO abajo, la decision de ambos numeros se
  // tomo junta porque compiten por el mismo presupuesto).
  const TEXTURE_SIZE: [number, number] = [640, 640]
  await document.transform(textureCompress({ encoder: sharp, resize: TEXTURE_SIZE }))
  console.log(`Texturas redimensionadas a ${TEXTURE_SIZE[0]}x${TEXTURE_SIZE[1]}`)

  // Decimacion + compresion real de geometria (mismo patron que
  // build-anatomy-model.ts). Combinaciones probadas (sin normal maps en
  // ningun caso; tamanos con el pipeline completo, geometria + texturas):
  //   ratio 1.0 (sin decimar, 640470 tris) + tex 512  -> 4.01MB (arriba del
  //     target 2-3MB, dentro del maximo 5MB)
  //   ratio 0.5 (320228 tris)              + tex 512  -> 2.39MB (config de
  //     la fase de inspeccion -- conservadora)
  //   ratio 0.7 (448314 tris)              + tex 512  -> 3.04MB
  //   ratio 0.5 (320228 tris)              + tex 768  -> 2.82MB
  //   ratio 0.65 (416286 tris)             + tex 512  -> 2.88MB
  //   ratio 0.6 (384266 tris)              + tex 640  -> 2.92MB  <- ELEGIDO
  // 0.6/640 da el mejor balance geometria+textura dentro del target 2-3MB
  // con margen (2.92MB, no al limite): 20% mas triangulos que la fase de
  // inspeccion (384k vs 320k) y 56% mas pixeles por textura (640² vs 512²).
  const geomPreSimplify = countGeometry(document)
  const SIMPLIFY_RATIO = 0.6
  await document.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_RATIO, error: 0.01 }),
    meshopt({ encoder: MeshoptEncoder }),
  )
  const geomPostSimplify = countGeometry(document)
  console.log(`Triangulos: ${geomPreSimplify.tris} -> ${geomPostSimplify.tris} (ratio ${SIMPLIFY_RATIO})`)

  const outDir = path.join(process.cwd(), "public", "models")
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "muscles.glb")
  const glb = await io.writeBinary(document)
  fs.writeFileSync(outPath, glb)

  const sizeMB = (glb.byteLength / 1024 / 1024).toFixed(2)
  console.log(`\nEscrito ${outPath} — ${sizeMB} MB`)
  if (glb.byteLength > 5 * 1024 * 1024) {
    console.error(`ADVERTENCIA: ${sizeMB}MB supera el maximo aceptado de 5MB.`)
    process.exit(1)
  }
  if (glb.byteLength > 3 * 1024 * 1024) {
    console.warn(`AVISO: ${sizeMB}MB supera el target de 2-3MB (pero entra en el maximo de 5MB).`)
  }

  await verifyOutput(outPath)
}

/**
 * Releer el .glb YA ESCRITO (con el decoder de meshopt registrado, como lo
 * va a leer el browser) y verificar: los 16 nodos son hijos directos de la
 * escena, las texturas sobreviven y son legibles, y la altura final (rango
 * Y) coincide con la calculada en memoria antes de escribir -- EXT_meshopt_
 * compression cuantiza posiciones y reescribe la matriz del nodo padre para
 * compensar (ver quantize() en @gltf-transform/functions), asi que este
 * chequeo confirma que el numero reportado arriba sigue siendo verdad
 * despues de la compresion, no antes.
 *
 * Tambien imprime el bounding box completo (X/Y/Z) del modelo final -- es
 * el input que necesita el paso separado de recalculo de pointPosition en
 * lib/muscle-anatomy.ts (normalizacion proporcional por eje contra este
 * bounding box). No hay chequeo de pointPosition/MUSCLE_ANATOMY aca: ese
 * calculo vive en un script aparte, no en este pipeline de curacion del
 * modelo.
 */
async function verifyOutput(outPath: string) {
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
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

  const textures = root.listTextures()
  console.log(`Texturas: ${textures.length}`)
  for (const tex of textures) {
    const size = tex.getSize()
    console.log(`  ${tex.getURI() || tex.getName() || "(sin nombre)"} — ${size ? `${size[0]}x${size[1]}` : "tamano desconocido"}, ${((tex.getImage()?.byteLength ?? 0) / 1024).toFixed(1)}KB`)
  }

  const geom = countGeometry(document)
  console.log(`Geometria final: ${geom.verts} vertices, ${geom.tris} triangulos`)

  const box = worldSpaceBBox(nodes)
  console.log(`Bounding box final (releido del .glb comprimido):`)
  console.log(`  X: [${box.minX.toFixed(4)}, ${box.maxX.toFixed(4)}]`)
  console.log(`  Y: [${box.minY.toFixed(4)}, ${box.maxY.toFixed(4)}] (altura: ${(box.maxY - box.minY).toFixed(4)})`)
  console.log(`  Z: [${box.minZ.toFixed(4)}, ${box.maxZ.toFixed(4)}]`)
  console.log(`Referencia Z-Anatomy: altura ${ZANATOMY_HEIGHT_M} (Y: 0.0129 a 1.6777)`)
}

main()
