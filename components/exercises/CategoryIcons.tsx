const mkStroke = (color: string) => ({
  stroke: color, strokeWidth: 1.8, fill: "none",
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
})
const glow = (c1: string, c2: string) =>
  `drop-shadow(0 0 6px ${c1}) drop-shadow(0 0 12px ${c2})`

export function AllIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#c084fc")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#a855f7", "#7c3aed") }}>
      <circle cx="20" cy="20" r="3" fill="#c084fc" />
      <circle cx="8"  cy="8"  r="2.5" fill="#c084fc" />
      <circle cx="32" cy="8"  r="2.5" fill="#c084fc" />
      <circle cx="8"  cy="32" r="2.5" fill="#c084fc" />
      <circle cx="32" cy="32" r="2.5" fill="#c084fc" />
      <line x1="20" y1="20" x2="8"  y2="8"  {...s} />
      <line x1="20" y1="20" x2="32" y2="8"  {...s} />
      <line x1="20" y1="20" x2="8"  y2="32" {...s} />
      <line x1="20" y1="20" x2="32" y2="32" {...s} />
      <line x1="8"  y1="8"  x2="32" y2="8"  {...s} />
      <line x1="8"  y1="32" x2="32" y2="32" {...s} />
      <line x1="8"  y1="8"  x2="8"  y2="32" {...s} />
      <line x1="32" y1="8"  x2="32" y2="32" {...s} />
    </svg>
  )
}

export function StrengthIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#fbbf24")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#f59e0b", "#d97706") }}>
      <line x1="10" y1="20" x2="30" y2="20" {...s} strokeWidth={2.5} />
      <rect x="4"  y="14" width="6"  height="12" rx="2" {...s} />
      <rect x="30" y="14" width="6"  height="12" rx="2" {...s} />
      <rect x="9"  y="16" width="3" height="8" rx="1" {...s} />
      <rect x="28" y="16" width="3" height="8" rx="1" {...s} />
    </svg>
  )
}

export function CardioIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#60a5fa")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#3b82f6", "#2563eb") }}>
      <path d="M20 32 C20 32 6 22 6 14a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 8-14 18-14 18z" {...s} />
      <polyline points="10,20 14,20 16,14 18,26 21,16 23,22 26,20 30,20" {...s} strokeWidth={1.5} />
    </svg>
  )
}

export function HiitIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#f87171")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#ef4444", "#dc2626") }}>
      <circle cx="20" cy="23" r="12" {...s} />
      <rect x="16" y="9" width="8" height="3" rx="1.5" {...s} />
      <line x1="20" y1="9" x2="20" y2="11" {...s} strokeWidth={2.5} />
      <line x1="20" y1="23" x2="20" y2="15" {...s} strokeWidth={2} />
      <line x1="20" y1="23" x2="26" y2="23" {...s} strokeWidth={2} />
      <line x1="4" y1="18" x2="8"  y2="18" {...s} />
      <line x1="3" y1="22" x2="7"  y2="22" {...s} />
      <line x1="4" y1="26" x2="8"  y2="26" {...s} />
    </svg>
  )
}

export function FlexibilityIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#34d399")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#10b981", "#059669") }}>
      <circle cx="28" cy="8" r="3" {...s} />
      <path d="M28 11 C26 16 20 18 14 22 C10 25 8 29 10 33" {...s} />
      <path d="M22 16 C18 12 14 10 10 9" {...s} />
      <path d="M14 22 C12 28 8 32 5 34" {...s} />
      <path d="M10 33 C12 35 15 36 18 35" {...s} />
    </svg>
  )
}

export function BalanceIcon({ size = 40 }: { size?: number }) {
  const s = mkStroke("#a78bfa")
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ filter: glow("#8b5cf6", "#7c3aed") }}>
      <ellipse cx="20" cy="34" rx="11" ry="4"  {...s} />
      <ellipse cx="20" cy="26" rx="8"  ry="3.5" {...s} />
      <ellipse cx="20" cy="19" rx="5"  ry="3"   {...s} />
      <ellipse cx="20" cy="13" rx="3"  ry="2.2" {...s} />
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
