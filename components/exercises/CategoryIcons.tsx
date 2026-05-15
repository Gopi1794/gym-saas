const GLOW = "drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 12px #7c3aed)"
const stroke = { stroke: "#c084fc", strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

export function AllIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      <circle cx="20" cy="20" r="3" fill="#c084fc" />
      <circle cx="8"  cy="8"  r="2.5" fill="#c084fc" />
      <circle cx="32" cy="8"  r="2.5" fill="#c084fc" />
      <circle cx="8"  cy="32" r="2.5" fill="#c084fc" />
      <circle cx="32" cy="32" r="2.5" fill="#c084fc" />
      <line x1="20" y1="20" x2="8"  y2="8"  {...stroke} />
      <line x1="20" y1="20" x2="32" y2="8"  {...stroke} />
      <line x1="20" y1="20" x2="8"  y2="32" {...stroke} />
      <line x1="20" y1="20" x2="32" y2="32" {...stroke} />
      <line x1="8"  y1="8"  x2="32" y2="8"  {...stroke} />
      <line x1="8"  y1="32" x2="32" y2="32" {...stroke} />
      <line x1="8"  y1="8"  x2="8"  y2="32" {...stroke} />
      <line x1="32" y1="8"  x2="32" y2="32" {...stroke} />
    </svg>
  )
}

export function StrengthIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      {/* bar */}
      <line x1="10" y1="20" x2="30" y2="20" {...stroke} strokeWidth={2.5} />
      {/* left weight */}
      <rect x="4"  y="14" width="6"  height="12" rx="2" {...stroke} />
      {/* right weight */}
      <rect x="30" y="14" width="6"  height="12" rx="2" {...stroke} />
      {/* collars */}
      <rect x="9"  y="16" width="3" height="8" rx="1" {...stroke} />
      <rect x="28" y="16" width="3" height="8" rx="1" {...stroke} />
    </svg>
  )
}

export function CardioIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      {/* heart */}
      <path d="M20 32 C20 32 6 22 6 14a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 8-14 18-14 18z" {...stroke} />
      {/* EKG line across heart */}
      <polyline points="10,20 14,20 16,14 18,26 21,16 23,22 26,20 30,20" {...stroke} strokeWidth={1.5} />
    </svg>
  )
}

export function HiitIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      {/* stopwatch body */}
      <circle cx="20" cy="23" r="12" {...stroke} />
      {/* crown */}
      <rect x="16" y="9" width="8" height="3" rx="1.5" {...stroke} />
      {/* button */}
      <line x1="20" y1="9" x2="20" y2="11" {...stroke} strokeWidth={2.5} />
      {/* hands */}
      <line x1="20" y1="23" x2="20" y2="15" {...stroke} strokeWidth={2} />
      <line x1="20" y1="23" x2="26" y2="23" {...stroke} strokeWidth={2} />
      {/* speed lines */}
      <line x1="4" y1="18" x2="8"  y2="18" {...stroke} />
      <line x1="3" y1="22" x2="7"  y2="22" {...stroke} />
      <line x1="4" y1="26" x2="8"  y2="26" {...stroke} />
    </svg>
  )
}

export function FlexibilityIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      {/* head */}
      <circle cx="28" cy="8" r="3" {...stroke} />
      {/* body arching */}
      <path d="M28 11 C26 16 20 18 14 22 C10 25 8 29 10 33" {...stroke} />
      {/* arm reaching up */}
      <path d="M22 16 C18 12 14 10 10 9" {...stroke} />
      {/* leg extended */}
      <path d="M14 22 C12 28 8 32 5 34" {...stroke} />
      {/* ground foot */}
      <path d="M10 33 C12 35 15 36 18 35" {...stroke} />
    </svg>
  )
}

export function BalanceIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: GLOW }}>
      {/* bottom stone - wide */}
      <ellipse cx="20" cy="34" rx="11" ry="4"  {...stroke} />
      {/* middle stone */}
      <ellipse cx="20" cy="26" rx="8"  ry="3.5" {...stroke} />
      {/* top stone - small */}
      <ellipse cx="20" cy="19" rx="5"  ry="3"   {...stroke} />
      {/* tiny top */}
      <ellipse cx="20" cy="13" rx="3"  ry="2.2" {...stroke} />
    </svg>
  )
}

export const CATEGORY_ICONS: Record<string, React.FC<{ size?: number }>> = {
  strength:    StrengthIcon,
  cardio:      CardioIcon,
  hiit:        HiitIcon,
  flexibility: FlexibilityIcon,
  balance:     BalanceIcon,
  all:         AllIcon,
}
