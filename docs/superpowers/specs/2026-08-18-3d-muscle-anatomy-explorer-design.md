# Explorador de anatomía 3D — diseño

**Fecha:** 2026-08-18
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El trainer/member puede ver una card de volumen muscular por cada músculo trabajado en un plan de entrenamiento (`PlanEditor.tsx`, feature del 2026-08-18). Se pidió agregar una vista interactiva de anatomía: tocar un músculo abre una exploración 3D del cuerpo rotable, con un punto pulsante por músculo que al tocarlo muestra su descripción anatómica (Origen/Inserción/Función) y los ejercicios recomendados.

Dos pantallas de referencia visual se diseñaron en Figma (mesa de trabajo `2cKbjOuDcZvHmIcoUSGgjF`, frames `muscle-anatomy-default` id `30:5` y `muscle-anatomy-expanded` id `30:65`): una versión plana (imagen 2D) con puntos pulsantes, y el bottom sheet de detalle con ejercicios.

Durante el brainstorming se pidió explícitamente que el cuerpo sea un objeto 3D rotable en vez de una imagen plana. Se corrió un spike de factibilidad antes de specear (ver "Spike de factibilidad 3D" abajo) que confirmó que es viable.

## Objetivos

- Reemplazar la ilustración plana del mockup por un modelo 3D real y rotable del cuerpo, con los 19 músculos que ya usa la app (`MuscleZone` en `PlanEditor.tsx`).
- Tocar un músculo (desde la card existente, o desde un punto dentro del explorador) centra la cámara en él, lo resalta, y muestra Origen/Inserción/Función + ejercicios recomendados reales de la base.
- Mantener la experiencia liviana en mobile (el criterio de éxito más concreto: el modelo final debe pesar 2-3MB, nunca más de 5MB).

## No objetivos (fuera de alcance de esta v1)

- Badge de dificultad en las cards de ejercicio (la tabla `exercises` no tiene ese campo; se decidió no agregarlo ahora).
- Contenido de referencia editable desde un panel de admin (queda hardcodeado en código, ver "Modelo de datos").
- Soporte para otros idiomas del contenido anatómico.

## Spike de factibilidad 3D — hallazgos

- **Modelo fuente:** [Z-Anatomy](https://www.z-anatomy.com/) (CC BY-SA 4.0, gratis). El usuario ya obtuvo una exportación completa a glTF vía un conversor externo (`ImageToStl.com`) — `Startup.gltf` + `model.bin`, 158MB, generado con `Khronos glTF Blender I/O v5.0.21`. No hace falta correr Blender de nuevo.
- **Estructura confirmada:** 7179 nodos, 3390 meshes, 171 materiales. Cada estructura anatómica es un nodo nombrado individualmente (ej. `Pectoralis major muscle.el`/`.er`, `Gluteus maximus muscle.el`/`.er`). Los sufijos `.j`/`.g`/`.t` son el sistema de etiquetas de texto interno de Z-Anatomy (leader lines, no geometría) y se descartan. Los sufijos `.el`/`.er` (o `.l`/`.r` según el músculo) son la malla real izquierda/derecha.
- **Herramienta de curación sin Blender:** `@gltf-transform/core` + `@gltf-transform/functions` (Node.js) permiten filtrar nodos por nombre, podar lo no referenciado, simplificar polígonos y comprimir (Draco/meshopt), todo sin abrir Blender — validado instalando el paquete y corriendo consultas reales contra el archivo de 158MB.
- **Librería de render:** React Three Fiber + `@react-three/drei` (`useGLTF`, `CameraControls` para el zoom animado, `OrbitControls` para el arrastre libre) — patrón estándar y bien documentado para exactamente este caso (mesh individual clickeable, recoloreable, cámara animada a un target).

### Mapeo músculo → nodos del modelo (confirmado vs. pendiente)

Confirmado por búsqueda directa en el árbol de nodos:

| Zona (`MuscleZone`) | Nodo(s) fuente en Z-Anatomy |
|---|---|
| chest | `Pectoralis major muscle` |
| pec_minor | `Pectoralis minor muscle` |
| biceps | `Biceps brachii muscle` |
| triceps | `Triceps brachii muscle` (Lateral/Medial/Long head — **no** confundir con `Triceps surae muscle`, que es la pantorrilla) |
| shoulders / front_delts / rear_delts | `Deltoid muscle` + partes (`Clavicular part of deltoid`, `Acromial part of deltoid`, `Scapular spinal part of deltoid`) — hay que mapear cada sub-parte a la zona correcta (anterior/lateral/posterior) |
| back | `Latissimus dorsi muscle` |
| traps | `Trapezius muscle` (con sub-partes ascending/descending/transverse) |
| rhomboids | `Rhomboid major muscle` + `Rhomboid minor muscle` |
| serratus | `Serratus anterior muscle` |
| core | `Rectus abdominis muscle` |
| quads | `Quadriceps femoris muscle` (o `Rectus femoris muscle` si se quiere más específico) |
| hamstrings | Combinación: `Biceps femoris muscle` + `Semitendinosus muscle` + semimembranosus (buscar) |
| glutes | `Gluteus maximus muscle` (evaluar si sumar medius) |
| calves | `Gastrocnemius` (lateral/medial head) |
| soleus | `Soleus muscle` |
| lower_back | `Erector spinae` (nodo combinado `.ol`/`.or`, evitar los ~25 fascículos individuales de `Longissimus thoracis`) |

Pendiente de confirmar durante implementación (no se encontraron en las búsquedas hechas durante el spike):

- **obliques** — la búsqueda de "External oblique"/"Internal oblique" no dio resultados; Z-Anatomy probablemente usa nomenclatura latina (`Obliquus externus abdominis`). Requiere una búsqueda dedicada sobre el árbol de nodos antes de armar el script de curación.

Este mapeo completo (con los índices de nodo exactos, no solo el nombre) se termina de armar como parte de la tarea de curación del asset, no en este documento.

## Arquitectura

```
PlanEditor.tsx (muscle card) ──tap──▶ MuscleAnatomy3D (overlay full-screen)
                                          │
                                          ├─ <Canvas> (react-three-fiber)
                                          │    ├─ useGLTF('/models/muscles.glb')
                                          │    ├─ CameraControls (zoom animado a target)
                                          │    ├─ OrbitControls (arrastre libre, pausa auto-rotate)
                                          │    └─ puntos pulsantes (Html/drei, animación ring-ping existente)
                                          │
                                          └─ MuscleDetailSheet (bottom sheet)
                                               ├─ nombre, categoría
                                               ├─ Origen / Inserción / Función
                                               └─ ejercicios recomendados (filtrados client-side)
```

**Extracción de código compartido:** `MuscleZone` y `MUSCLE_META` se sacan de `PlanEditor.tsx` a `lib/muscle-anatomy.ts`, porque ahora dos consumidores los necesitan (la card 2D y el explorador 3D). `PlanEditor.tsx` pasa a importarlos desde ahí en vez de definirlos localmente.

## Modelo de datos

Nuevo, en `lib/muscle-anatomy.ts`:

```ts
type MuscleAnatomyEntry = {
  zone: MuscleZone
  displayName: string        // "Pectoral Mayor"
  category: string           // "Pecho / Torso anterior"
  origen: string             // contenido real de kinesiología, redactado en esta implementación
  insercion: string
  funcion: string
  nodeNames: string[]        // nodos del .glb curado que forman este músculo
  pointPosition: [number, number, number] // ancla 3D: punto pulsante + target de cámara
}

export const MUSCLE_ANATOMY: Record<MuscleZone, MuscleAnatomyEntry> = { ... }
```

19 entradas, una por zona. El texto de Origen/Inserción/Función se redacta como parte de la implementación (contenido de kinesiología estándar, no user-generated).

**Ejercicios recomendados:** no hay fetch nuevo. Se reusa la lista de ejercicios que `PlanEditor` ya tiene cargada (con `muscle_groups`), filtrando client-side con la misma lógica de `normalizeMuscle`/`MUSCLE_META` que ya existe hoy para las cards. Sin round-trip de red adicional al abrir el sheet.

## Pipeline del asset 3D

Script único (no corre en cada build): `scripts/build-anatomy-model.ts`, usando `@gltf-transform/core` + `@gltf-transform/functions` (nuevas dependencias del proyecto).

1. Carga `Startup.gltf` + `model.bin` (158MB, ya en poder del usuario).
2. Por cada una de las 19 zonas, conserva solo los nodos de la tabla de mapeo (arriba).
3. Poda todo lo no referenciado (esqueleto, órganos, vasos, las ~7000 etiquetas de texto internas de Z-Anatomy).
4. Simplifica polígonos (meshoptimizer) a un presupuesto liviano por músculo.
5. Comprime (Draco o meshopt) y exporta a `public/models/muscles.glb`.
6. Verifica que el resultado pese entre 2-3MB (máximo aceptable: 5MB) antes de commitear.

`public/models/muscles.glb` se versiona junto con el código (no en Supabase Storage) — mismo origen que sirve el resto de la app (sin DNS/CORS extra), y evita que el asset y el código que referencia sus nombres de nodo se desincronicen entre sí.

## Flujo de interacción

1. **Selección** (desde la card 2D existente, o tocando un punto dentro del explorador): la cámara anima (`CameraControls`) hasta encuadrar ese músculo centrado en pantalla. El mesh correspondiente cambia a rojo (mismo color que ya usa el resto de la UI). El bottom sheet sube expandido con el contenido de esa zona.
2. **Cambio de músculo con el sheet abierto**: se toca otro punto pulsante (siempre visibles, con la animación `ring-ping` que ya existe en `tailwind.config.ts` — se reusa, no se inventa una nueva). La cámara re-encuadra el nuevo músculo con transición animada (nunca un corte instantáneo). El músculo anterior se despinta, el nuevo se pinta de rojo. El **contenido de texto del sheet hace crossfade** (Framer Motion `AnimatePresence`, patrón ya usado en el resto del código) entre la info del músculo anterior y la del nuevo — nunca un cambio brusco de texto.
3. **Minimizar el sheet** (arrastrándolo hacia abajo) **o cerrar con X**: mismo estado final. La cámara se aleja hasta mostrar el cuerpo completo, se quita el resaltado, y el cuerpo entra en auto-rotación suave (idle). El usuario puede tomar y girar el cuerpo con el dedo en cualquier momento — el arrastre manual pausa la auto-rotación mientras dura el gesto.
4. Desde el estado de cuerpo completo girando, tocar cualquier punto vuelve al paso 1.

## Manejo de errores

- **WebGL no disponible o falla la carga del `.glb`** (red o parseo): fallback a la ilustración plana actual (`MuscleIcon`) en vez de romper la pantalla completa.
- **Nodo faltante en el modelo curado** para alguna zona (bug de curación): esa zona puntual se omite del overview (sin punto pulsante) en vez de crashear toda la escena.

## Testing

- Unit tests (Vitest, convención ya establecida en el proyecto) para `lib/muscle-anatomy.ts`: las 19 zonas tienen todos los campos completos y no vacíos.
- Unit test para el filtro de ejercicios por zona (lógica pura, sin WebGL).
- El render 3D en sí (WebGL/Canvas) no es testeable de forma significativa con Vitest — verificación manual, mismo criterio que ya se aplica al resto de las features visuales de esta app.

## Nuevas dependencias

- Runtime: `three`, `@react-three/fiber`, `@react-three/drei`.
- Dev/build (una sola vez, para el script de curación): `@gltf-transform/core`, `@gltf-transform/functions`.
