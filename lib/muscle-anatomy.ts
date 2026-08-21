export type MuscleZone = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "obliques" | "traps" | "rhomboids" | "lower_back" | "soleus" | "serratus" | "pec_minor" | "rear_delts" | "front_delts"
export type MuscleStatus = "low" | "slightly-low" | "optimal" | "high"

export const MUSCLE_META: Record<string, { zone: MuscleZone; range: [number, number] }> = {
  // Pecho
  pecho:             { zone: "chest",       range: [10, 20] },
  pectoral:          { zone: "chest",       range: [10, 20] },
  pectorales:        { zone: "chest",       range: [10, 20] },
  "pectoral menor":  { zone: "pec_minor",   range: [6,  12] },
  serratos:          { zone: "serratus",    range: [6,  12] },
  // Espalda
  espalda:           { zone: "back",        range: [10, 20] },
  dorsal:            { zone: "back",        range: [10, 20] },
  dorsales:          { zone: "back",        range: [10, 20] },
  "dorsal ancho":    { zone: "back",        range: [10, 20] },
  trapecio:          { zone: "traps",       range: [8,  16] },
  trapecios:         { zone: "traps",       range: [8,  16] },
  romboides:         { zone: "rhomboids",   range: [6,  14] },
  "espalda media":   { zone: "rhomboids",   range: [6,  14] },
  lumbar:            { zone: "lower_back",  range: [6,  12] },
  lumbares:          { zone: "lower_back",  range: [6,  12] },
  "erector espinal": { zone: "lower_back",  range: [6,  12] },
  // Hombros
  hombros:               { zone: "shoulders",  range: [10, 18] },
  deltoides:             { zone: "shoulders",  range: [10, 18] },
  "deltoides lateral":   { zone: "shoulders",  range: [10, 18] },
  "deltoides anterior":  { zone: "front_delts",range: [8,  16] },
  "deltoides posterior": { zone: "rear_delts", range: [8,  16] },
  // Brazos
  biceps:   { zone: "biceps",   range: [8, 16] },
  bíceps:   { zone: "biceps",   range: [8, 16] },
  triceps:  { zone: "triceps",  range: [8, 16] },
  tríceps:  { zone: "triceps",  range: [8, 16] },
  // Core
  abdomen:     { zone: "core",     range: [6, 14] },
  abdominales: { zone: "core",     range: [6, 14] },
  core:        { zone: "core",     range: [6, 14] },
  oblicuos:    { zone: "obliques", range: [6, 14] },
  // Piernas
  cuadriceps:     { zone: "quads",      range: [10, 20] },
  cuádriceps:     { zone: "quads",      range: [10, 20] },
  aductores:      { zone: "quads",      range: [8,  16] },
  isquiotibiales: { zone: "hamstrings", range: [8,  16] },
  femorales:      { zone: "hamstrings", range: [8,  16] },
  gluteos:        { zone: "glutes",     range: [8,  16] },
  glúteos:        { zone: "glutes",     range: [8,  16] },
  pantorrillas:   { zone: "calves",     range: [8,  16] },
  gemelos:        { zone: "calves",     range: [8,  16] },
  soleo:          { zone: "soleus",     range: [6,  14] },
  sóleo:          { zone: "soleus",     range: [6,  14] },
}

export function normalizeMuscle(muscle: string) {
  return muscle.trim().toLowerCase()
}

export function getMuscleMeta(muscle: string) {
  return MUSCLE_META[normalizeMuscle(muscle)] ?? { zone: "core" as MuscleZone, range: [8, 16] as [number, number] }
}

export function getMuscleStatus(sets: number, [min, max]: [number, number]): MuscleStatus {
  if (sets > max) return "high"
  if (sets >= min) return "optimal"
  if (sets >= Math.max(1, Math.round(min * 0.75))) return "slightly-low"
  return "low"
}

export function statusLabel(status: MuscleStatus) {
  return {
    low: "BAJO",
    "slightly-low": "LIGERAMENTE BAJO",
    optimal: "ÓPTIMO",
    high: "ALTO",
  }[status]
}

export function statusPillClass(status: MuscleStatus) {
  return {
    low: "bg-red-100 dark:bg-red-500/15 text-red-500",
    "slightly-low": "bg-amber-100 dark:bg-amber-500/15 text-amber-500",
    optimal: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-500",
    high: "bg-orange-100 dark:bg-orange-500/15 text-orange-500",
  }[status]
}

/**
 * Verde en 0% -> rojo en 100%, pasando por amarillo, como un gauge.
 * Luminosidad baja (40%) a propósito: al 50% da amarillo, que en 50%L
 * pierde casi todo el contraste como texto sobre fondo blanco.
 */
export function progressColor(percent: number) {
  const t = Math.max(0, Math.min(1, percent / 100))
  return `hsl(${120 * (1 - t)}, 70%, 40%)`
}

export const MUSCLE_ZONE_IMAGE: Record<MuscleZone, string> = {
  shoulders:   "1.png",   // Deltoides lateral
  chest:       "2.png",   // Pectorales
  triceps:     "3.png",   // Tríceps
  core:        "5.png",   // Abdominales
  obliques:    "6.png",   // Oblicuos
  front_delts: "7.png",   // Deltoides anterior
  calves:      "8.png",   // Gemelos
  back:        "10.png",  // Dorsal ancho
  traps:       "11.png",  // Trapecio
  quads:       "14.png",  // Cuádriceps + Aductores
  biceps:      "16.png",  // Bíceps
  rhomboids:   "20.png",  // Romboides + Espalda media
  hamstrings:  "22.png",  // Isquiotibiales + Glúteos
  lower_back:  "23.png",  // Lumbar / Erector espinal
  soleus:      "24.png",  // Sóleo + Gemelos
  serratus:    "25.png",  // Serratos + Oblicuos
  pec_minor:   "26.png",  // Pectoral menor
  rear_delts:  "27.png",  // Deltoides posterior
  glutes:      "28.png",  // Glúteos
}

export type MuscleAnatomyEntry = {
  zone: MuscleZone
  displayName: string
  category: string
  origen: string
  insercion: string
  funcion: string
  nodeNames: string[]
  pointPosition: [number, number, number]
}

export const MUSCLE_ANATOMY: Record<MuscleZone, MuscleAnatomyEntry> = {
  chest: {
    zone: "chest",
    displayName: "Pectoral Mayor",
    category: "Pecho / Torso anterior",
    origen: "Clavícula, esternón y cartílagos costales de las primeras 6 costillas",
    insercion: "Cresta del tubérculo mayor del húmero",
    funcion: "Aducción, flexión y rotación interna del brazo",
    nodeNames: ["Pectoralis major muscle.el", "Pectoralis major muscle.er"],
    pointPosition: [0.19117328991300053, 0.2596288572274279, -0.0280995401831165],
  },
  pec_minor: {
    zone: "pec_minor",
    displayName: "Pectoral Menor",
    category: "Pecho / Torso anterior (capa profunda)",
    origen: "Costillas 3ª a 5ª, cerca de sus cartílagos costales",
    insercion: "Apófisis coracoides de la escápula",
    funcion: "Estabiliza y desciende la escápula; eleva las costillas en inspiración forzada",
    nodeNames: ["Pectoralis minor muscle.l", "Pectoralis minor muscle.r"],
    pointPosition: [0.10645347108252251, 0.26447317522581315, 0.02222302336427695],
  },
  biceps: {
    zone: "biceps",
    displayName: "Bíceps Braquial",
    category: "Brazo anterior",
    origen: "Cabeza larga: tubérculo supraglenoideo de la escápula. Cabeza corta: apófisis coracoides",
    insercion: "Tuberosidad del radio y fascia del antebrazo (aponeurosis bicipital)",
    funcion: "Flexión del codo y supinación del antebrazo",
    nodeNames: ["Biceps brachii muscle.el", "Biceps brachii muscle.er"],
    pointPosition: [0.23852370467854667, -0.004078375428357761, -0.03213833776062146],
  },
  triceps: {
    zone: "triceps",
    displayName: "Tríceps Braquial",
    category: "Brazo posterior",
    origen: "Cabeza larga: tubérculo infraglenoideo de la escápula. Cabezas lateral y medial: cara posterior del húmero",
    insercion: "Olécranon del cúbito",
    funcion: "Extensión del codo",
    nodeNames: ["Triceps brachii muscle.el", "Triceps brachii muscle.er"],
    pointPosition: [0.2177636843825489, 0.03439058930667627, -0.0696573767639129],
  },
  shoulders: {
    zone: "shoulders",
    displayName: "Deltoides Lateral",
    category: "Hombro",
    origen: "Cara lateral del acromion",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Abducción del brazo (elevación lateral)",
    nodeNames: ["Acromial part of deltoid muscle.l", "Acromial part of deltoid muscle.r"],
    pointPosition: [0.2002410237100315, 0.27600925883086846, -0.04456098667583781],
  },
  front_delts: {
    zone: "front_delts",
    displayName: "Deltoides Anterior",
    category: "Hombro",
    origen: "Tercio lateral de la clavícula",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Flexión y rotación interna del brazo",
    nodeNames: ["Clavicular part of deltoid muscle.l", "Clavicular part of deltoid muscle.r"],
    pointPosition: [0.14920043680772072, 0.2795725688289219, -0.01766903530052319],
  },
  rear_delts: {
    zone: "rear_delts",
    displayName: "Deltoides Posterior",
    category: "Hombro",
    origen: "Espina de la escápula",
    insercion: "Tuberosidad deltoidea del húmero",
    funcion: "Extensión y rotación externa del brazo",
    nodeNames: ["Scapular spinal part of deltoid muscle.l", "Scapular spinal part of deltoid muscle.r"],
    pointPosition: [0.1607223585902423, 0.2625813573155211, -0.08008353160973604],
  },
  back: {
    zone: "back",
    displayName: "Dorsal Ancho",
    category: "Espalda",
    origen: "Vértebras torácicas bajas, lumbares, sacro y cresta ilíaca",
    insercion: "Corredera bicipital del húmero",
    funcion: "Aducción, extensión y rotación interna del brazo",
    nodeNames: ["Latissimus dorsi muscle.l", "Latissimus dorsi muscle.r"],
    pointPosition: [0.0914293270985343, 0.07031896585667208, -0.08684695261885196],
  },
  traps: {
    zone: "traps",
    displayName: "Trapecio",
    category: "Espalda alta / Cuello",
    origen: "Base del cráneo y apófisis espinosas de las vértebras cervicales y torácicas",
    insercion: "Clavícula, acromion y espina de la escápula",
    funcion: "Eleva, retrae y rota la escápula según la porción activada",
    nodeNames: [
      "Ascending part of trapezius muscle.l", "Ascending part of trapezius muscle.r",
      "Descending part of trapezius muscle.l", "Descending part of trapezius muscle.r",
      "Transverse part of trapezius muscle.l", "Transverse part of trapezius muscle.r",
    ],
    pointPosition: [0.06750845231158487, 0.2007934798883313, -0.1208360623054095],
  },
  rhomboids: {
    zone: "rhomboids",
    displayName: "Romboides",
    category: "Espalda media",
    origen: "Apófisis espinosas de C7 a T5",
    insercion: "Borde medial de la escápula",
    funcion: "Retrae y eleva la escápula",
    nodeNames: [
      "Rhomboid major muscle.l", "Rhomboid major muscle.r",
      "Rhomboid minor muscle.l", "Rhomboid minor muscle.r",
    ],
    pointPosition: [0.04220324047857016, 0.28287329674397554, -0.11889971210714485],
  },
  serratus: {
    zone: "serratus",
    displayName: "Serrato Anterior",
    category: "Costado del torso",
    origen: "Cara externa de las costillas 1ª a 8ª/9ª",
    insercion: "Borde medial de la escápula (cara costal)",
    funcion: "Protrae la escápula y la estabiliza contra la caja torácica",
    nodeNames: ["Serratus anterior muscle.l", "Serratus anterior muscle.r"],
    pointPosition: [0.10601890356146759, 0.21885881189842427, -0.03700128757934948],
  },
  core: {
    zone: "core",
    displayName: "Recto Abdominal",
    category: "Abdomen",
    origen: "Cresta púbica y sínfisis del pubis",
    insercion: "Cartílagos costales de las costillas 5ª a 7ª y apófisis xifoides",
    funcion: "Flexión del tronco",
    nodeNames: ["Rectus abdominis muscle.l", "Rectus abdominis muscle.r"],
    pointPosition: [0.04127559212681953, -0.01238477028806173, 0.08194245339074568],
  },
  obliques: {
    zone: "obliques",
    displayName: "Oblicuo Externo",
    category: "Abdomen lateral",
    origen: "Cara externa de las costillas 5ª a 12ª",
    insercion: "Cresta ilíaca y línea alba",
    funcion: "Flexión lateral y rotación del tronco",
    nodeNames: ["External abdominal oblique muscle.l", "External abdominal oblique muscle.r"],
    pointPosition: [0.07264882103668419, 0.0044651350474187446, 0.02951290852116556],
  },
  quads: {
    zone: "quads",
    displayName: "Cuádriceps",
    category: "Muslo anterior",
    origen: "Ilion (recto femoral) y fémur (vastos)",
    insercion: "Tuberosidad tibial vía tendón rotuliano",
    funcion: "Extensión de la rodilla",
    nodeNames: ["Quadriceps femoris muscle.el", "Quadriceps femoris muscle.er"],
    pointPosition: [0.0848066707192115, -0.6078857383272713, 0.003268143580314631],
  },
  hamstrings: {
    zone: "hamstrings",
    displayName: "Isquiotibiales",
    category: "Muslo posterior",
    origen: "Tuberosidad isquiática",
    insercion: "Cabeza del peroné (bíceps femoral) y cara medial de la tibia (semitendinoso/semimembranoso)",
    funcion: "Flexión de la rodilla y extensión de la cadera",
    nodeNames: [
      "Biceps femoris muscle.el", "Biceps femoris muscle.er",
      "Semitendinosus muscle.l", "Semitendinosus muscle.r",
      "Semimembranosus muscle.l", "Semimembranosus muscle.r",
    ],
    pointPosition: [0.11860450372159914, -0.6569313040446222, -0.058232422567318656],
  },
  glutes: {
    zone: "glutes",
    displayName: "Glúteo Mayor",
    category: "Cadera",
    origen: "Ilion posterior, sacro y ligamento sacrotuberoso",
    insercion: "Tracto iliotibial y línea áspera del fémur",
    funcion: "Extensión y rotación externa de la cadera",
    nodeNames: ["Gluteus maximus muscle.l", "Gluteus maximus muscle.r"],
    pointPosition: [0.07383558542087043, -0.22194155662996384, -0.08049173000705545],
  },
  calves: {
    zone: "calves",
    displayName: "Gastrocnemio",
    category: "Pantorrilla",
    origen: "Cóndilos femorales medial y lateral",
    insercion: "Calcáneo vía tendón de Aquiles",
    funcion: "Flexión plantar del tobillo y flexión de la rodilla",
    nodeNames: [
      "Lateral head of gastrocnemius.l", "Lateral head of gastrocnemius.r",
      "Medial head of gastrocnemius.l", "Medial head of gastrocnemius.r",
    ],
    pointPosition: [0.10822884541400984, -0.7116374296833665, -0.0850114033492884],
  },
  soleus: {
    zone: "soleus",
    displayName: "Sóleo",
    category: "Pantorrilla profunda",
    origen: "Cara posterior de la tibia y el peroné",
    insercion: "Calcáneo vía tendón de Aquiles",
    funcion: "Flexión plantar del tobillo (independiente de la posición de la rodilla)",
    nodeNames: ["Soleus muscle.l", "Soleus muscle.r"],
    pointPosition: [0.08635249358525016, -0.7947675713808815, -0.06708535963431055],
  },
  lower_back: {
    zone: "lower_back",
    displayName: "Erector Espinal",
    category: "Espalda baja",
    origen: "Sacro, cresta ilíaca y apófisis espinosas lumbares",
    insercion: "Costillas, apófisis transversas y base del cráneo, según el fascículo",
    funcion: "Extensión de la columna vertebral",
    nodeNames: ["Erector spinae.ol", "Erector spinae.or"],
    pointPosition: [0.05340473743339608, -0.09336409777526378, -0.08047299929880149],
  },
}
