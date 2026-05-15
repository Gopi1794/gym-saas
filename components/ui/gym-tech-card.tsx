import { cn } from "@/lib/utils"

function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${pts.join(" L")} Z`
}

// Radar/sonar rings — QR scanner + biometric vibes
const RadarBg = () => (
  <div className="hidden md:block pointer-events-none absolute -top-2 -right-2 z-0">
    <svg width="180" height="130" viewBox="0 0 180 130" fill="none">
      <circle cx="150" cy="30" r="28" stroke="rgba(213,0,0,0.09)" strokeWidth="1.5" />
      <circle cx="150" cy="30" r="56" stroke="rgba(213,0,0,0.06)" strokeWidth="1.5" />
      <circle cx="150" cy="30" r="86" stroke="rgba(213,0,0,0.04)" strokeWidth="1" />
      <line x1="150" y1="4"  x2="150" y2="56" stroke="rgba(213,0,0,0.06)" strokeWidth="1" />
      <line x1="124" y1="30" x2="176" y2="30" stroke="rgba(213,0,0,0.06)" strokeWidth="1" />
      <circle cx="150" cy="30" r="4" fill="rgba(213,0,0,0.30)" />
      {/* Animated ping rings */}
      <circle
        cx="150" cy="30" r="22"
        stroke="rgba(213,0,0,0.25)" strokeWidth="1.5" fill="none"
        className="animate-ring-ping [transform-box:fill-box] [transform-origin:center]"
      />
      <circle
        cx="150" cy="30" r="22"
        stroke="rgba(213,0,0,0.25)" strokeWidth="1.5" fill="none"
        className="animate-ring-ping [animation-delay:1.25s] [transform-box:fill-box] [transform-origin:center]"
      />
    </svg>
  </div>
)

// Hexagonal grid — carbon fiber / data-structure vibes
const HexBg = () => {
  const hexes = [
    { cx: 162, cy: 22, r: 20, delay: "0s",   dur: "3.4s" },
    { cx: 128, cy: 22, r: 20, delay: "0.6s", dur: "4s"   },
    { cx: 145, cy: 51, r: 20, delay: "1.2s", dur: "3s"   },
    { cx: 111, cy: 51, r: 20, delay: "0.4s", dur: "4.4s" },
    { cx: 162, cy: 80, r: 20, delay: "1.8s", dur: "3.6s" },
    { cx: 128, cy: 80, r: 20, delay: "0.9s", dur: "2.8s" },
  ]
  return (
    <div className="hidden md:block pointer-events-none absolute -top-2 -right-2 z-0">
      <svg width="185" height="110" viewBox="0 0 185 110" fill="none">
        {hexes.map(({ cx, cy, r, delay, dur }) => (
          <path
            key={`${cx}-${cy}`}
            d={hexPath(cx, cy, r)}
            stroke="rgba(213,0,0,0.15)"
            strokeWidth="1.5"
            fill="rgba(213,0,0,0.03)"
            className="animate-float-hex [transform-box:fill-box] [transform-origin:center]"
            style={{ animationDelay: delay, animationDuration: dur }}
          />
        ))}
      </svg>
    </div>
  )
}

// Circuit board traces — analytics / real-time data vibes
const CircuitBg = () => (
  <div className="hidden md:block pointer-events-none absolute -top-2 -right-2 z-0">
    <svg width="185" height="130" viewBox="0 0 185 130" fill="none">
      {/* Main horizontal trace */}
      <line x1="60" y1="55" x2="185" y2="55" stroke="rgba(213,0,0,0.10)" strokeWidth="1.5" />
      {/* Branch up */}
      <line x1="110" y1="55" x2="110" y2="12" stroke="rgba(213,0,0,0.10)" strokeWidth="1.5" />
      <line x1="110" y1="12" x2="160" y2="12" stroke="rgba(213,0,0,0.10)" strokeWidth="1.5" />
      {/* Branch down */}
      <line x1="150" y1="55" x2="150" y2="98" stroke="rgba(213,0,0,0.10)" strokeWidth="1.5" />
      <line x1="150" y1="98" x2="185" y2="98" stroke="rgba(213,0,0,0.10)" strokeWidth="1.5" />
      {/* Second branch */}
      <line x1="170" y1="55" x2="170" y2="30" stroke="rgba(213,0,0,0.08)" strokeWidth="1.5" />
      {/* Nodes */}
      <circle cx="110" cy="55" r="4" fill="rgba(213,0,0,0.35)"
        className="animate-ekg-pulse" style={{ animationDelay: "0s" }} />
      <circle cx="150" cy="55" r="4" fill="rgba(213,0,0,0.35)"
        className="animate-ekg-pulse" style={{ animationDelay: "0.8s" }} />
      <circle cx="170" cy="55" r="4" fill="rgba(213,0,0,0.35)"
        className="animate-ekg-pulse" style={{ animationDelay: "1.6s" }} />
      <circle cx="160" cy="12" r="3" fill="rgba(213,0,0,0.25)" />
      <circle cx="170" cy="30" r="3" fill="rgba(213,0,0,0.25)" />
      {/* Mini EKG waveform at bottom */}
      <polyline
        points="62,80 74,80 80,68 86,92 92,75 100,80 112,80"
        stroke="rgba(213,0,0,0.12)" strokeWidth="1.5" fill="none" strokeLinecap="round"
      />
    </svg>
  </div>
)

export type GymTechBg = "radar" | "hex" | "circuit"

export function GymTechCard({
  children,
  className,
  bgType = "radar",
}: {
  children: React.ReactNode
  className?: string
  bgType?: GymTechBg
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50", className)}>
      {/* Mobile: static red glow — no animations, no scroll blocking */}
      <div className="md:hidden pointer-events-none absolute inset-0 z-0 rounded-2xl bg-[radial-gradient(ellipse_70%_50%_at_85%_15%,rgba(213,0,0,0.14),transparent_70%)]" />
      {bgType === "radar"   && <RadarBg />}
      {bgType === "hex"     && <HexBg />}
      {bgType === "circuit" && <CircuitBg />}
      {children}
    </div>
  )
}
