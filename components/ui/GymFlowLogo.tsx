import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Altura del ícono en px */
  size?: number
  /** Clase de tamaño de texto Tailwind (default: text-2xl) */
  textSize?: string
}

export function VoltiaLogo({ className, size = 28, textSize = "text-2xl" }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* Rayo — gradiente 3D igual al logo oficial */}
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
        {/* Sombra interior — cara oscura del rayo */}
        <path
          d="M10 0 L6 11 L8 11 L4 24 L8.5 14 L6.5 14 Z"
          fill="#6B0000"
          opacity="0.5"
        />
        {/* Forma principal del rayo */}
        <path
          d="M10 0 L2 13 L8 13 L4 24 L14 11 L8 11 Z"
          fill="url(#voltia-bolt)"
        />
      </svg>

      {/* Wordmark: "Vol" oscuro + "tia" rojo */}
      <span
        className={cn("font-display tracking-tight leading-none select-none", textSize)}
        style={{ letterSpacing: "-0.02em" }}
      >
        <span className="text-zinc-900 dark:text-zinc-50">Vol</span>
        <span className="text-red-900 dark:text-red-600">tia</span>
      </span>
    </span>
  )
}

export { VoltiaLogo as GymFlowLogo }
