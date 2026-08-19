"use client"

import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
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
  const { scene } = useGLTF(MODEL_PATH)
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

  useMemo(() => {
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      const zone = nodeNameToZone.get(obj.name)
      if (!zone) return
      if (!originalMaterials.current.has(obj.name)) {
        originalMaterials.current.set(obj.name, obj.material)
      }
      const isSelected = zone === selectedZone
      if (isSelected) {
        const mat = (obj.material as THREE.MeshStandardMaterial).clone()
        mat.color = HIGHLIGHT_COLOR
        obj.material = mat
      } else {
        obj.material = originalMaterials.current.get(obj.name)!
      }
    })
  }, [scene, selectedZone, nodeNameToZone])

  return (
    <group
      ref={groupRef}
      onClick={event => {
        event.stopPropagation()
        const zone = nodeNameToZone.get(event.object.name)
        // eslint-disable-next-line no-console
        console.log("__DEBUG_MESH_CLICK__", { objectName: event.object.name, objectType: event.object.type, matchedZone: zone ?? null })
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
  const { camera } = useThree()

  useMemo(() => {
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
