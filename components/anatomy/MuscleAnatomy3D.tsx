"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { CameraControls, useGLTF, Html } from "@react-three/drei"
import * as THREE from "three"
import { X } from "lucide-react"
import { MUSCLE_ANATOMY, type MuscleZone } from "@/lib/muscle-anatomy"
import { getExercisesForZone, type Exercise } from "@/lib/muscle-exercises"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MuscleIcon } from "@/components/planes/MuscleIcon"

const MODEL_PATH = "/models/muscles.glb"
const HIGHLIGHT_COLOR = new THREE.Color("#ef4444")

interface MuscleAnatomy3DProps {
  initialZone: MuscleZone
  exercises: Exercise[]
  onClose: () => void
}

function Body({
  selectedZone,
  onSelect,
  isIdle,
}: {
  selectedZone: MuscleZone | null
  onSelect: (zone: MuscleZone) => void
  isIdle: boolean
}) {
  const { scene: cachedScene } = useGLTF(MODEL_PATH)
  // useGLTF cachea y reutiliza el mismo grafo de escena entre montajes: mutar
  // sus materiales in-place (como hace el highlight de abajo) deja "pegado"
  // el color rojo entre una apertura del explorador y la siguiente. Clonamos
  // la jerarquía una vez por instancia del componente para que cada montaje
  // mute su propia copia, no la compartida.
  const scene = useMemo(() => cachedScene.clone(true), [cachedScene])
  const groupRef = useRef<THREE.Group>(null)

  // Mapa nombre de nodo -> zona, para resolver un click en cualquier mesh a su zona.
  const nodeNameToZone = useMemo(() => {
    const map = new Map<string, MuscleZone>()
    for (const entry of Object.values(MUSCLE_ANATOMY)) {
      for (const name of entry.nodeNames) map.set(name, entry.zone)
    }
    return map
  }, [])

  // Guarda el material original de cada mesh la primera vez que se toca,
  // para poder devolverlo al des-seleccionar sin perder el material real.
  const originalMaterials = useRef(new Map<string, THREE.Material | THREE.Material[]>())

  useFrame((_, delta) => {
    if (isIdle && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  // Efecto imperativo (muta materiales de three.js directamente, no hay valor
  // memoizado que usar) — useMemo no garantiza no repetirse ni corre después
  // del commit, así que va en useEffect.
  useEffect(() => {
    function applyHighlight(mesh: THREE.Mesh, zone: MuscleZone) {
      // Se indexa por uuid, no por name: cuando el mismo mesh de glTF (con
      // más de un primitivo) es referenciado por dos nodos —el lado
      // izquierdo y el derecho de un músculo, que es el caso de los 15
      // meshes multi-primitivo de este modelo—, el loader clona el Group
      // para el segundo nodo y el clone conserva el name de sus hijos tal
      // cual. El Group en sí queda con un name distinto por lado, pero sus
      // hijos Mesh no, así que dos meshes de lados opuestos pueden compartir
      // el mismo name. El uuid en cambio nunca se copia al clonar: tres.js
      // genera uno nuevo por instancia, así que es la única clave segura acá.
      if (!originalMaterials.current.has(mesh.uuid)) {
        originalMaterials.current.set(mesh.uuid, mesh.material)
      }
      const isSelected = zone === selectedZone
      if (isSelected) {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
        mat.color = HIGHLIGHT_COLOR
        mesh.material = mat
      } else {
        mesh.material = originalMaterials.current.get(mesh.uuid)!
      }
    }

    scene.traverse(obj => {
      const zone = nodeNameToZone.get(obj.name)
      if (!zone) return
      if (obj instanceof THREE.Mesh) {
        // Caso simple: el nodo del músculo es directamente un Mesh.
        applyHighlight(obj, zone)
      } else if (obj instanceof THREE.Group) {
        // Un mesh de glTF con más de un primitivo se carga como Group (uno
        // de los 50 nodos curados tiene 2 primitivos, no 1): el nombre del
        // músculo queda en el Group, no en sus hijos Mesh reales. Bajamos un
        // nivel y coloreamos cada hijo Mesh, indexando por su propio nombre
        // (auto-generado por el loader, pero estable y único).
        for (const child of obj.children) {
          if (child instanceof THREE.Mesh) applyHighlight(child, zone)
        }
      }
    })
  }, [scene, selectedZone, nodeNameToZone])

  return (
    <group
      ref={groupRef}
      onClick={event => {
        event.stopPropagation()
        // Un click puede caer en el Mesh del nodo directamente (caso simple)
        // o en un hijo Mesh de un Group cuando el nodo del músculo tiene más
        // de un primitivo (ver comentario en el useEffect de arriba) — subimos
        // por los padres hasta encontrar un nombre que resuelva a una zona,
        // sin pasar del <group> al que está atado este handler.
        let obj: THREE.Object3D | null = event.object
        let zone: MuscleZone | undefined
        while (obj && obj !== groupRef.current) {
          zone = nodeNameToZone.get(obj.name)
          if (zone) break
          obj = obj.parent
        }
        if (zone) onSelect(zone)
      }}
    >
      <primitive object={scene} />
      {Object.values(MUSCLE_ANATOMY).map(entry => (
        <Html key={entry.zone} position={entry.pointPosition} center distanceFactor={1.2}>
          <button
            onClick={e => {
              e.stopPropagation()
              onSelect(entry.zone)
            }}
            className="relative grid h-4 w-4 place-items-center"
            aria-label={`Ver ${entry.displayName}`}
          >
            <span className="absolute h-4 w-4 animate-ring-ping rounded-full bg-red-500" />
            <span className="relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          </button>
        </Html>
      ))}
    </group>
  )
}

function CameraRig({ targetZone, controlsRef }: { targetZone: MuscleZone | null; controlsRef: React.RefObject<CameraControls> }) {
  // useEffect, no useMemo: los refs recién quedan asignados después del
  // commit. En el primer render, controlsRef.current todavía es null durante
  // la fase de render — con useMemo ese primer encuadre se perdía en
  // silencio (el guard de abajo cortaba, y como el memo solo reevalúa si
  // cambia targetZone, nunca se reintentaba hasta la siguiente selección).
  useEffect(() => {
    if (!controlsRef.current) return
    if (targetZone) {
      const [x, y, z] = MUSCLE_ANATOMY[targetZone].pointPosition
      const distance = 0.4
      controlsRef.current.setLookAt(x, y, z + distance, x, y, z, true)
    } else {
      controlsRef.current.setLookAt(0, 0.2, 1.4, 0, 0.2, 0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetZone])

  return null
}

export function MuscleAnatomy3D({ initialZone, exercises, onClose }: MuscleAnatomy3DProps) {
  const [selectedZone, setSelectedZone] = useState<MuscleZone | null>(initialZone)
  const [minimized, setMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const controlsRef = useRef<CameraControls>(null)

  const isIdle = minimized && !isDragging

  function handleSelect(zone: MuscleZone) {
    setSelectedZone(zone)
    setMinimized(false)
  }

  function handleMinimize() {
    setMinimized(true)
  }

  if (webglFailed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
        <MuscleIcon zone={initialZone} className="h-40 w-32" />
        <p className="text-center text-sm text-zinc-400">
          Tu dispositivo no puede mostrar el modelo 3D. Mostrando la vista simple.
        </p>
        <button onClick={onClose} className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-heading text-sm uppercase tracking-wide text-zinc-400">Anatomía</p>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100"
          aria-label="Cerrar explorador de anatomía"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <Canvas
          camera={{ position: [0, 0.2, 1.4], fov: 40 }}
          onCreated={() => {}}
          onError={() => setWebglFailed(true)}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 2, 2]} intensity={1.2} />
          <Body selectedZone={selectedZone} onSelect={handleSelect} isIdle={isIdle} />
          <CameraRig targetZone={minimized ? null : selectedZone} controlsRef={controlsRef} />
          <CameraControls
            ref={controlsRef}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI - Math.PI / 4}
          />
        </Canvas>

        {selectedZone && (
          <MuscleDetailSheet
            entry={MUSCLE_ANATOMY[selectedZone]}
            exercises={getExercisesForZone(selectedZone, exercises)}
            minimized={minimized}
            onClose={onClose}
            onMinimize={handleMinimize}
          />
        )}
      </div>
    </div>
  )
}

useGLTF.preload(MODEL_PATH)
