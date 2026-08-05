import { parsePhoneNumberFromString } from "libphonenumber-js/min"

/**
 * Normaliza un teléfono argentino a E.164, asumiendo que siempre es un
 * celular — acá se usa para contacto por WhatsApp, no hay un teléfono fijo
 * de un socio que tenga sentido guardar.
 *
 * libphonenumber-js interpreta un número sin el "15" (prefijo de celular
 * para uso local) o el "9" (formato internacional) como fijo, no como
 * celular ambiguo — es el comportamiento correcto del plan de numeración
 * real, pero acá produce un E.164 sin el 9, que WhatsApp no reconoce como
 * ese celular. Se fuerza el 9 explícitamente en vez de confiar en el tipo
 * que detecta la librería, porque en este dominio (agenda de contactos de
 * un gym) todo número cargado es un celular, tenga o no el 15/9 tipeado.
 */
export function normalizePhoneAR(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, "AR")
  if (!parsed || !parsed.isValid() || parsed.country !== "AR") return null
  const national = parsed.nationalNumber
  const mobileNational = national.startsWith("9") ? national : `9${national}`
  return `+54${mobileNational}`
}

/** Formato nacional para mostrar en la UI (ej. "011 15-1234-5678"). */
export function formatPhoneAR(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164, "AR")
  return parsed?.formatNational() ?? e164
}

/** Dígitos listos para wa.me — E.164 sin el "+". */
export function whatsappNumber(e164: string): string {
  return e164.replace(/^\+/, "")
}
