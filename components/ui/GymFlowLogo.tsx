import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Altura del ícono en px */
  size?: number
  /** Clase de tamaño de texto Tailwind (default: text-2xl) */
  textSize?: string
  /** Mostrar tagline "Potencia Tu Entrenamiento" debajo del wordmark */
  showTagline?: boolean
}

export function VoltiaLogo({ className, size = 28, textSize = "text-2xl", showTagline = false }: Props) {
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      {/* Fila: rayo + wordmark */}
      <span className="inline-flex items-center gap-2">
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="voltia-bolt" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#EF4444" />
              <stop offset="45%"  stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#450000" />
            </linearGradient>
          </defs>
          <path d="M10 0 L6 11 L8 11 L4 24 L8.5 14 L6.5 14 Z" fill="#6B0000" opacity="0.5" />
          <path d="M10 0 L2 13 L8 13 L4 24 L14 11 L8 11 Z" fill="url(#voltia-bolt)" />
        </svg>

        <span
          className={cn("font-display tracking-tight leading-none select-none", textSize)}
          style={{ letterSpacing: "-0.02em" }}
        >
          <span className="text-zinc-900 dark:text-zinc-50">Vol</span>
          <span className="text-red-900 dark:text-red-600">tia</span>
        </span>
      </span>

      {showTagline && (
        <span className="pl-1 text-[10px] font-medium tracking-widest text-zinc-500 dark:text-zinc-400 uppercase select-none">
          Potencia Tu Entrenamiento
        </span>
      )}
    </span>
  )
}

export { VoltiaLogo as GymFlowLogo }
