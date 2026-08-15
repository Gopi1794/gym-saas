// Un draft mas viejo que esto ya no se ofrece como "continuar" — se trata
// como si no existiera. Comparacion de duracion real (ahora - updated_at),
// no de dia de calendario: evita que un entrenamiento arrancado a las 23hs
// cruce medianoche y parezca "de ayer" apenas dos horas despues.
export const DRAFT_STALE_HOURS = 24

export function isDraftStale(updatedAt: string, now: number = Date.now()): boolean {
  const ageHours = (now - new Date(updatedAt).getTime()) / (1000 * 60 * 60)
  return ageHours > DRAFT_STALE_HOURS
}
