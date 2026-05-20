import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Altura del ícono en px */
  size?: number
  /** Clase de tamaño de texto Tailwind (default: text-2xl) */
  textSize?: string
}

export function GymFlowLogo({ className, size = 28, textSize = "text-2xl" }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* Rayo — ícono de marca */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M10 0 L2 13 L8 13 L4 24 L14 11 L8 11 Z"
          fill="#D50000"
        />
      </svg>

      {/* Wordmark */}
      <span
        className={cn("font-display tracking-tight leading-none select-none", textSize)}
        style={{ letterSpacing: "-0.02em" }}
      >
        <span className="text-white">Gym</span>
        <span className="text-brand-700">Flow</span>
      </span>
    </span>
  )
}
