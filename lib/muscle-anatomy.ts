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
