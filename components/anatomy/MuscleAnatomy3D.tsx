"use client"

import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { CameraControls, useGLTF, Html, Text } from "@react-three/drei"
import * as THREE from "three"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { getAnatomyPointPosition, MUSCLE_ANATOMY, type MuscleAnatomyEntry, type MuscleZone } from "@/lib/muscle-anatomy"
import { getExerciseRecommendationForZone, type Exercise } from "@/lib/muscle-exercises"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MuscleIcon } from "@/components/planes/MuscleIcon"

const MODEL_PATH = "/models/muscles.glb"

interface MuscleAnatomy3DProps {
  exercises: Exercise[]
  onClose: () => void
}

function setMaterialOpacity(object: { material?: THREE.Material | THREE.Material[] } | null, opacity: number) {
  if (!object?.material) return
  const materials = Array.isArray(object.material) ? object.material : [object.material]
  for (const material of materials) {
    material.transparent = true
    material.opacity = opacity
  }
}

function setGroupMaterialOpacity(group: THREE.Group | null, opacity: number) {
  group?.traverse((object) => {
    if ("material" in object) {
      setMaterialOpacity(object as THREE.Mesh, opacity)
    }
  })
}

function AnatomyFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
      <MuscleIcon zone="chest" className="h-40 w-32" />
      <p className="max-w-sm text-center text-sm text-zinc-400">
        No se pudo cargar el modelo 3D. Podés volver al plan y usar la vista de músculos.
      </p>
      <button onClick={onClose} className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200">
        Volver
      </button>
    </div>
  )
}

class AnatomyErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("No se pudo cargar el explorador de anatomía", error, info)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function MuscleMarker({ entry, onSelect, showCallout }: { entry: MuscleAnatomyEntry; onSelect: (zone: MuscleZone) => void; showCallout: boolean }) {
  const markerRootRef = useRef<THREE.Group>(null)
  const calloutRef = useRef<THREE.Group>(null)
  const dotRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const labelRef = useRef<THREE.Group>(null)
  const textRef = useRef<THREE.Mesh>(null)
  const dotOpacityRef = useRef(1)
  const calloutOpacityRef = useRef(1)
  const { camera } = useThree()
  const [x, y, z] = getAnatomyPointPosition(entry.zone)
  const surfaceOffset = entry.facing === "back" ? -0.065 : 0.065
  const markerPosition: [number, number, number] = [x, y, z + surfaceOffset]
  const horizontalOffset = x < 0 ? -0.085 : 0.085
  const labelPosition: [number, number, number] = [markerPosition[0] + horizontalOffset, markerPosition[1], markerPosition[2]]

  useFrame(({ clock }, delta) => {
    if (!ringRef.current || !markerRootRef.current) return
    const pulse = 1 + ((Math.sin(clock.elapsedTime * 3 + entry.pointPosition[1] * 10) + 1) * 0.14)
    ringRef.current.scale.setScalar(pulse)
    labelRef.current?.lookAt(camera.position)

    const worldPosition = markerRootRef.current.getWorldPosition(new THREE.Vector3())
    const worldRotation = markerRootRef.current.getWorldQuaternion(new THREE.Quaternion())
    const facingNormal = new THREE.Vector3(0, 0, entry.facing === "back" ? -1 : 1).applyQuaternion(worldRotation)
    const directionToCamera = camera.position.clone().sub(worldPosition).normalize()
    const facesCamera = facingNormal.dot(directionToCamera) > 0.08
    dotOpacityRef.current = THREE.MathUtils.damp(dotOpacityRef.current, facesCamera ? 1 : 0, 9, delta)
    calloutOpacityRef.current = THREE.MathUtils.damp(calloutOpacityRef.current, facesCamera && showCallout ? 1 : 0, 9, delta)

    setMaterialOpacity(dotRef.current, dotOpacityRef.current)
    setMaterialOpacity(ringRef.current, dotOpacityRef.current * 0.75)
    setGroupMaterialOpacity(calloutRef.current, calloutOpacityRef.current * 0.75)
    setMaterialOpacity(textRef.current, calloutOpacityRef.current)
    markerRootRef.current.visible = Math.max(dotOpacityRef.current, calloutOpacityRef.current) > 0.01
  })

  return (
    <group ref={markerRootRef}>
      <group ref={calloutRef}>
        <line>
          <bufferGeometry
            attach="geometry"
            onUpdate={(geometry) => geometry.setFromPoints([
              new THREE.Vector3(x, y, z),
              new THREE.Vector3(...markerPosition),
              new THREE.Vector3(...labelPosition),
            ])}
          />
          <lineBasicMaterial color="#ef4444" transparent opacity={0.75} depthTest />
        </line>
      </group>
      <group
        ref={labelRef}
        position={labelPosition}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(entry.zone)
        }}
      >
        <mesh ref={dotRef}>
          <sphereGeometry args={[0.018, 16, 16]} />
          <meshBasicMaterial color="#ef4444" transparent depthTest depthWrite={false} />
        </mesh>
        <mesh ref={ringRef} raycast={() => null}>
          <ringGeometry args={[0.025, 0.034, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.75} depthTest depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Text
          ref={textRef}
          position={[0, 0.042, 0]}
          fontSize={0.016}
          color="#fecaca"
          anchorX={horizontalOffset < 0 ? "right" : "left"}
          anchorY="bottom"
          outlineWidth={0.002}
          outlineColor="#02040a"
        >
          {entry.displayName}
        </Text>
      </group>
    </group>
  )
}

function Body({ onSelect, onClear, isIdle, selectedZone }: { onSelect: (zone: MuscleZone) => void; onClear: () => void; isIdle: boolean; selectedZone: MuscleZone | null }) {
  const { scene } = useGLTF(MODEL_PATH)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (selectedZone) groupRef.current?.rotation.set(0, 0, 0)
  }, [selectedZone])

  function handleSelect(zone: MuscleZone) {
    // Las coordenadas de MUSCLE_ANATOMY viven en la orientación frontal del
    // modelo. Antes de enfocar una zona, se restablece el giro automático
    // para que cámara y anatomía compartan el mismo sistema de referencia.
    groupRef.current?.rotation.set(0, 0, 0)
    onSelect(zone)
  }

  useFrame((_, delta) => {
    if (isIdle && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  return (
    <group ref={groupRef} onClick={onClear}>
      <primitive object={scene} />
      {Object.values(MUSCLE_ANATOMY).map((entry) => (
        <MuscleMarker key={entry.zone} entry={entry} onSelect={handleSelect} showCallout={!selectedZone || selectedZone === entry.zone} />
      ))}
    </group>
  )
}

function MuscleNavigator({ selectedZone, minimized, onSelect }: { selectedZone: MuscleZone | null; minimized: boolean; onSelect: (zone: MuscleZone) => void }) {
  if (!selectedZone) return null

  const zones = Object.keys(MUSCLE_ANATOMY) as MuscleZone[]
  const currentIndex = zones.indexOf(selectedZone)
  const previousZone = zones[(currentIndex - 1 + zones.length) % zones.length]
  const nextZone = zones[(currentIndex + 1) % zones.length]
  const rightInset = minimized ? "lg:right-14" : "lg:right-[min(26rem,35vw)]"

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-20 z-30 flex items-center justify-between px-4 lg:inset-y-0 lg:top-auto lg:z-10 ${rightInset}`}>
      <button
        type="button"
        onClick={() => onSelect(previousZone)}
        className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-zinc-700 bg-zinc-950/85 text-zinc-200 shadow-lg backdrop-blur hover:bg-zinc-800"
        aria-label={`Músculo anterior: ${MUSCLE_ANATOMY[previousZone].displayName}`}
        title={MUSCLE_ANATOMY[previousZone].displayName}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(nextZone)}
        className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-zinc-700 bg-zinc-950/85 text-zinc-200 shadow-lg backdrop-blur hover:bg-zinc-800"
        aria-label={`Músculo siguiente: ${MUSCLE_ANATOMY[nextZone].displayName}`}
        title={MUSCLE_ANATOMY[nextZone].displayName}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
// Centro del bounding box del modelo (Y -1.0535 a 0.6113) y distancia
// suficiente para ver el cuerpo completo en la vista general.
const GENERAL_VIEW_Y = -0.2218
const GENERAL_VIEW_Z = 2.4

function CameraRig({ targetZone, controlsRef }: { targetZone: MuscleZone | null; controlsRef: React.RefObject<CameraControls> }) {
  // useEffect, no useMemo: los refs recién quedan asignados después del
  // commit. En el primer render, controlsRef.current todavía es null durante
  // la fase de render — con useMemo ese primer encuadre se perdía en
  // silencio (el guard de abajo cortaba, y como el memo solo reevalúa si
  // cambia targetZone, nunca se reintentaba hasta la siguiente selección).
  useEffect(() => {
    if (!controlsRef.current) return
    if (targetZone) {
      const { facing } = MUSCLE_ANATOMY[targetZone]
      const [x, y, z] = getAnatomyPointPosition(targetZone)
      const distance = 0.85
      // BUG (encontrado y corregido acá): esto sumaba +distance sin signo,
      // así que la cámara SIEMPRE terminaba en z + 0.4 -- es decir, siempre
      // del mismo lado (+Z), mirando siempre en dirección -Z, sin importar
      // qué zona se seleccione. El vector de vista (target - cámara) da
      // (0,0,-distance) en TODOS los casos: la dirección de la cámara nunca
      // dependía del target, solo su posición se corría un poco. Por eso
      // "glúteos" (posterior) nunca giraba la cámara hacia atrás -- se
      // quedaba mirando siempre de frente, aunque el punto estuviera del
      // otro lado del cuerpo (y quedaba oculto por el occlude de <Html>).
      // Agrandar la separación de pointPosition en Z no alcanza para
      // arreglar esto: para cualquier magnitud de z, target - cámara sigue
      // dando (0,0,-distance). El fix real es que el offset tiene que tener
      // el signo del lado anatómico real (facing, en lib/muscle-anatomy.ts)
      // -- así la cámara se aleja hacia +Z para zonas frontales y hacia -Z
      // para zonas posteriores, y recién ahí "da la vuelta" de verdad.
      const zOffset = facing === "back" ? -distance : distance
      controlsRef.current.setLookAt(x, y, z + zOffset, x, y, z, true)
    } else {
      controlsRef.current.setLookAt(0, GENERAL_VIEW_Y, GENERAL_VIEW_Z, 0, GENERAL_VIEW_Y, 0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetZone])

  return null
}

export function MuscleAnatomy3D({ exercises, onClose }: MuscleAnatomy3DProps) {
  const [selectedZone, setSelectedZone] = useState<MuscleZone | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const controlsRef = useRef<CameraControls>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const isIdle = (minimized || !selectedZone) && !isDragging

  function handleSelect(zone: MuscleZone) {
    setSelectedZone(zone)
    setMinimized(false)
  }

  function toggleMinimized() {
    setMinimized((current) => !current)
  }

  function clearSelection() {
    setSelectedZone(null)
    setMinimized(false)
  }

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-0 backdrop-blur-sm dark:bg-black/70 lg:p-8">
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 text-slate-950 lg:h-[min(900px,calc(100vh-4rem))] lg:max-w-[1440px] lg:rounded-3xl lg:border lg:border-cyan-700/15 lg:shadow-[0_32px_120px_rgba(15,23,42,0.24)] dark:bg-[#030712] dark:text-zinc-50 dark:lg:border-cyan-300/10 dark:lg:shadow-[0_32px_120px_rgba(0,0,0,0.65)]" role="dialog" aria-modal="true" aria-labelledby="anatomy-title">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p id="anatomy-title" className="font-heading text-sm uppercase tracking-wide text-slate-600 dark:text-zinc-400">Anatomía</p>
          {/* Atribución CC-BY-4.0 obligatoria del modelo 3D -- ver license.txt
              en la fuente descargada y el header de scripts/build-ecorche2-model.ts. */}
          <p className="text-[10px] text-slate-500 dark:text-zinc-600">&quot;Male Full Body Ecorche&quot; por Diego Luján García (CC-BY-4.0)</p>
        </div>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white/70 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-label="Cerrar explorador de anatomía"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(14,116,144,0.20),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(127,29,29,0.16),transparent_28%),linear-gradient(180deg,#f8fcff_0%,#e6f4ff_58%,#f6f8ff_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(14,116,144,0.20),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(127,29,29,0.16),transparent_28%),linear-gradient(180deg,#050b18_0%,#02040a_100%)]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(8,145,178,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(8,145,178,0.16)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)] dark:opacity-20 dark:[background-image:linear-gradient(rgba(45,212,191,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.13)_1px,transparent_1px)]" />
          <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" />
        </div>

        <AnatomyErrorBoundary fallback={<AnatomyFallback onClose={onClose} />}>
          <Canvas
            // Posición inicial: CameraRig la ajusta a la zona elegida después del primer commit.
            camera={{ position: [0, GENERAL_VIEW_Y, GENERAL_VIEW_Z], fov: 40 }}
            fallback={<AnatomyFallback onClose={onClose} />}
            onPointerMissed={clearSelection}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 2, 2]} intensity={1.2} />
            <Suspense fallback={<Html center><p className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-200">Cargando anatomía…</p></Html>}>
              <Body onSelect={handleSelect} onClear={clearSelection} isIdle={isIdle} selectedZone={selectedZone} />
            </Suspense>
            <CameraRig targetZone={minimized ? null : selectedZone} controlsRef={controlsRef} />
            <CameraControls
              ref={controlsRef}
              onStart={() => setIsDragging(true)}
              onEnd={() => setIsDragging(false)}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI - Math.PI / 4}
            />
          </Canvas>
        </AnatomyErrorBoundary>

        <MuscleNavigator selectedZone={selectedZone} minimized={minimized} onSelect={handleSelect} />

        {selectedZone && (
          <MuscleDetailSheet
            entry={MUSCLE_ANATOMY[selectedZone]}
            recommendation={getExerciseRecommendationForZone(selectedZone, exercises)}
            minimized={minimized}
            onToggle={toggleMinimized}
          />
        )}
      </div>
    </div>
    </div>
  )
}

useGLTF.preload(MODEL_PATH)
