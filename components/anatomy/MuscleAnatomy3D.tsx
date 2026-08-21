"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { CameraControls, useGLTF, Html } from "@react-three/drei"
import * as THREE from "three"
import { X } from "lucide-react"
import { MUSCLE_ANATOMY, type MuscleZone } from "@/lib/muscle-anatomy"
import { getExercisesForZone, type Exercise } from "@/lib/muscle-exercises"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MuscleIcon } from "@/components/planes/MuscleIcon"

const MODEL_PATH = "/models/muscles.glb"

interface MuscleAnatomy3DProps {
  initialZone: MuscleZone
  exercises: Exercise[]
  onClose: () => void
}

function Body({ onSelect, isIdle }: { onSelect: (zone: MuscleZone) => void; isIdle: boolean }) {
  // El modelo (Male Full Body Ecorche, CC-BY-4.0 -- credito en el header de
  // MuscleAnatomy3D de abajo) tiene solo 16 mallas sin nombre anatomico util
  // (Object_N generico, ver scripts/build-ecorche2-model.ts) -- no hay forma
  // de mapear una zona trackeada a una malla especifica, asi que a diferencia
  // del modelo de Z-Anatomy que reemplaza, no hay highlight ni aislamiento de
  // pieza: el cuerpo se ve siempre completo, y los 19 marcadores pulsantes
  // (pointPosition) son la unica forma de seleccionar una zona. Por eso no
  // hace falta clonar la escena cacheada de useGLTF -- nada muta sus
  // materiales, asi que reusar la misma instancia entre re-aperturas del
  // explorador es seguro (el unico caso en que clonar seria necesario es
  // montar dos instancias de MuscleAnatomy3D a la vez, y el componente se usa
  // como overlay de pantalla completa unico, nunca dos a la vez).
  const { scene } = useGLTF(MODEL_PATH)
  const groupRef = useRef<THREE.Group>(null)
  // Referencias a los botones de cada marcador, para el fade manual en
  // onOcclude de abajo (drei no anima la ocultación: por defecto alterna
  // display:none/block de un frame a otro, ver comentario en el <Html>).
  const markerElRefs = useRef(new Map<MuscleZone, HTMLButtonElement>())

  useFrame((_, delta) => {
    if (isIdle && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {Object.values(MUSCLE_ANATOMY).map(entry => (
        <Html
          key={entry.zone}
          position={entry.pointPosition}
          center
          distanceFactor={1.2}
          // Occlude contra nuestro propio grupo (el <primitive> con las 16
          // mallas del modelo), no el string 'raycast'/true de drei (que
          // raycastea contra toda la escena de useThree() — en este canvas
          // no hay nada más, así que el costo es el mismo, pero acotarlo a
          // groupRef es más correcto: no depende de que nada más se agregue
          // a la escena más adelante y queda explícito qué es "el cuerpo").
          occlude={[groupRef]}
          onOcclude={hidden => {
            const btn = markerElRefs.current.get(entry.zone)
            if (!btn) return
            // drei no anima esto: por defecto hace el.style.display =
            // hidden ? 'none' : 'block' de un frame a otro. Con onOcclude
            // tomamos el control y hacemos un fade con la transition de
            // Tailwind de abajo en vez del pop abrupto.
            btn.style.opacity = hidden ? "0" : "1"
            btn.style.pointerEvents = hidden ? "none" : "auto"
          }}
        >
          <button
            ref={el => {
              if (el) markerElRefs.current.set(entry.zone, el)
              else markerElRefs.current.delete(entry.zone)
            }}
            onClick={e => {
              e.stopPropagation()
              onSelect(entry.zone)
            }}
            className="relative grid h-4 w-4 place-items-center transition-opacity duration-150"
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

// Vista general (cámara alejada, cuerpo completo) usada cuando no hay zona
// seleccionada o el usuario minimiza la ficha de detalle. En la versión con
// el modelo de Z-Anatomy, Y=0.2 quedaba a un 11.2% de altura del pie (bbox Y
// 0.0129 a 1.6777) -- un valor bajo, cerca del tobillo, no el centro del
// cuerpo, pero es lo que se shippeaba antes y no hay pedido de rediseñarlo.
// El modelo nuevo (bbox Y -1.0535 a 0.6113, misma ALTURA total 1.6648 mm
// gracias a la normalizacion de scripts/build-ecorche2-model.ts, pero pivote
// distinto -- ver nota en el reporte de Fase 1) no comparte el mismo origen
// vertical: reusar el mismo Y=0.2 literal ubicaria la camara cerca del
// pecho/cuello del modelo nuevo en vez de cerca del tobillo, encuadrando mal
// la vista general (cuerpo cortado a la altura del pecho hacia abajo). Se
// recalcula el mismo 11.2% de altura pero contra el bbox del modelo nuevo,
// con la misma tecnica de normalizacion proporcional usada para las 19
// pointPosition en lib/muscle-anatomy.ts -- no es un rediseño, es preservar
// el mismo encuadre relativo.
const GENERAL_VIEW_Y = -0.8664
const GENERAL_VIEW_Z = 1.4

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
      controlsRef.current.setLookAt(0, GENERAL_VIEW_Y, GENERAL_VIEW_Z, 0, GENERAL_VIEW_Y, 0, true)
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
        <div>
          <p className="font-heading text-sm uppercase tracking-wide text-zinc-400">Anatomía</p>
          {/* Atribución CC-BY-4.0 obligatoria del modelo 3D -- ver license.txt
              en la fuente descargada y el header de scripts/build-ecorche2-model.ts. */}
          <p className="text-[10px] text-zinc-600">&quot;Male Full Body Ecorche&quot; por Diego Luján García (CC-BY-4.0)</p>
        </div>
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
          // Posicion inicial nada mas -- CameraRig la pisa en el primer
          // efecto (initialZone siempre viene seteado), pero se mantiene
          // consistente con GENERAL_VIEW_Y/Z de abajo para no arrancar en un
          // punto arbitrario si ese primer efecto tardara en correr.
          camera={{ position: [0, GENERAL_VIEW_Y, GENERAL_VIEW_Z], fov: 40 }}
          onCreated={() => {}}
          onError={() => setWebglFailed(true)}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 2, 2]} intensity={1.2} />
          <Body onSelect={handleSelect} isIdle={isIdle} />
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
