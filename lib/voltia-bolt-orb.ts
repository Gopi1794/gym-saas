import { finalizeFrame } from "thinking-orbs/engine"
import type { Dot, ModeFrame } from "thinking-orbs/engine"

export type Point = readonly [number, number]

/** The Voltia logo bolt (components/ui/GymFlowLogo.tsx, viewBox 0 0 14 24). */
export const BOLT_OUTLINE: readonly Point[] = [
  [10, 0],
  [2, 13],
  [8, 13],
  [4, 24],
  [14, 11],
  [8, 11],
]

// Timeline in seconds. Every cycle: the spark runs one lap (charge), the whole
// outline flashes and throws sparks (discharge), the sparks fade, the next lap starts.
export const CYCLE = 2.2
export const LAP = 1.6
export const FLASH_AT = LAP - 0.04
const RIPPLE = 0.04 // the flash travels from the tip around the outline
const ATTACK = 0.04
const HOLD = 0.08
const DECAY = 0.14
// The pseudo-random parts (jitter, burst) differ per cycle but repeat every
// VARIANTS cycles, which keeps the whole animation periodic.
const VARIANTS = 4
export const LOOP_PERIOD = CYCLE * VARIANTS

// thinking-orbs paints frame(0.6) instead of animating under prefers-reduced-motion.
const REDUCED_MOTION_T = 0.6
// Shifts the timeline so that instant sits on the plateau where the whole outline is lit.
const PHASE_OFFSET = FLASH_AT + ATTACK + (RIPPLE + HOLD) / 2 - REDUCED_MOTION_T

/** The `t` at which cycle number `cycle` is `phase` seconds in. */
export const timeAtPhase = (phase: number, cycle = 0) => cycle * CYCLE + phase - PHASE_OFFSET

const PAD = 0.07 // fraction of the canvas left empty on every side
const BASE_COUNT = 36 // outline dots at size 32
const TAIL_DOTS = 9 // dots trailing the spark head
const TAIL_STEP = 0.026 // gap between them, as a fraction of the perimeter
const JITTER = 0.008 // flash jitter amplitude, as a fraction of size
const JITTER_STEP = 1 / 24
const BURST_COUNT = 10

// Ink per state. `white` fades toward the background (0 = full ink), so resting
// dots stay readable on both light and dark themes.
const REST = { r: 0.8, white: 0.13, a: 0.74 }
const LIT = { r: 1.35, white: 0, a: 1 }
const HEAD_R = 1.8
const HALO = { r: 2.6, a: 0.22 }
const BLOOM = { r: 2.4, a: 0.16 } // soft glow around the outline during the flash

export interface BoltPath {
  verts: Point[]
  /** Cumulative arc length at each vertex; the last entry is the perimeter. */
  cum: number[]
  total: number
}

const frac = (x: number) => x - Math.floor(x)
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const smooth = (x: number) => {
  const c = clamp(x, 0, 1)
  return c * c * (3 - 2 * c)
}

// Same formula as thinking-orbs' hashD; that helper only ships in the main entry,
// which pulls React into this pure module.
function hash01(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return h - Math.floor(h)
}

/** The bolt outline in canvas pixels, centered and scaled to fit `size`. */
export function boltPath(size: number): BoltPath {
  const scale = (size * (1 - 2 * PAD)) / 24
  const verts = BOLT_OUTLINE.map(
    ([x, y]): Point => [size / 2 + (x - 8) * scale, size / 2 + (y - 12) * scale]
  )
  const cum = [0]
  verts.forEach(([ax, ay], i) => {
    const [bx, by] = verts[(i + 1) % verts.length]
    cum.push(cum[i] + Math.hypot(bx - ax, by - ay))
  })
  return { verts, cum, total: cum[cum.length - 1] }
}

/** Point at arc fraction `u` (wraps around) along the outline. */
export function pointAtArc(path: BoltPath, u: number): Point {
  const d = frac(u) * path.total
  let i = 0
  while (i < path.verts.length - 1 && d > path.cum[i + 1]) i++
  const len = path.cum[i + 1] - path.cum[i]
  const f = len ? (d - path.cum[i]) / len : 0
  const [ax, ay] = path.verts[i]
  const [bx, by] = path.verts[(i + 1) % path.verts.length]
  return [lerp(ax, bx, f), lerp(ay, by, f)]
}

/**
 * Arc fractions of the resting dots: evenly spaced, with a dot on every vertex so
 * the corners stay sharp.
 */
export function outlineArcs(path: BoltPath, count: number): number[] {
  const spacing = path.total / count
  const arcs: number[] = []
  path.verts.forEach((_, i) => {
    const len = path.cum[i + 1] - path.cum[i]
    const steps = Math.max(1, Math.round(len / spacing))
    for (let k = 0; k < steps; k++) arcs.push((path.cum[i] + (len * k) / steps) / path.total)
  })
  return arcs
}

/** Flash intensity 0..1 for `q` seconds after the flash reached a dot. */
export function flashLevel(q: number): number {
  if (q <= 0 || q >= ATTACK + HOLD + DECAY) return 0
  return smooth(q / ATTACK) * (1 - smooth((q - ATTACK - HOLD) / DECAY))
}

/** Spark head position, as an arc fraction, `p` seconds into the cycle. */
export function sparkArc(p: number): number {
  const x = clamp(p / LAP, 0, 1)
  return x + 0.3 * (smooth(x) - x) // eases in and out of the tip
}

function sparkGain(p: number): number {
  if (p >= LAP) return 0
  return smooth(p / 0.15) * (1 - smooth((p - (LAP - 0.05)) / 0.05))
}

// Largest travel from (x, y) along (dx, dy) that keeps a dot inside [lo, hi].
function rayCap(x: number, y: number, dx: number, dy: number, lo: number, hi: number): number {
  let cap = Infinity
  if (dx > 1e-6) cap = Math.min(cap, (hi - x) / dx)
  else if (dx < -1e-6) cap = Math.min(cap, (lo - x) / dx)
  if (dy > 1e-6) cap = Math.min(cap, (hi - y) / dy)
  else if (dy < -1e-6) cap = Math.min(cap, (lo - y) / dy)
  return Math.max(0, cap)
}

function burstDots(path: BoltPath, size: number, rs: number, variant: number, sinceFlash: number): Dot[] {
  const dots: Dot[] = []
  const c = size / 2
  const margin = 1.6 * rs
  for (let j = 0; j < BURST_COUNT; j++) {
    const seed = variant * 31 + j
    const delay = hash01(seed, 4.1) * 0.05
    const life = 0.32 + hash01(seed, 5.3) * 0.23
    const q = (sinceFlash - delay) / life
    if (q <= 0 || q >= 1) continue

    // The first dots leave from the vertices, the rest from random points of the outline.
    const u = j < path.verts.length ? path.cum[j] / path.total : hash01(seed, 1.7)
    const [ox, oy] = pointAtArc(path, u)
    // The bolt is tall and narrow, so squash the vertical component: sparks fly sideways.
    const angle = Math.atan2((oy - c) * 0.35, ox - c) + (hash01(seed, 2.9) - 0.5)
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const reach = (0.12 + 0.16 * hash01(seed, 6.7)) * size
    const travel = Math.min(reach * (1 - (1 - q) ** 2), rayCap(ox, oy, dx, dy, margin, size - margin))
    dots.push({
      x: ox + dx * travel,
      y: oy + dy * travel,
      z: 1.2,
      r: (1.3 - 0.6 * q) * rs,
      white: 0.05 + 0.35 * q,
      a: (1 - q) ** 1.2,
    })
  }
  return dots
}

/**
 * thinking-orbs frame: dots trace the Voltia bolt. A spark runs the outline with a
 * comet tail, then the bolt flashes and throws sparks. `t` is in
 * seconds and the animation repeats every LOOP_PERIOD. `opts.density` scales the
 * dot count.
 */
export const voltiaBoltFrame: ModeFrame = (size, t, opts) => {
  const cycles = (t + PHASE_OFFSET) / CYCLE
  const cycleIndex = Math.floor(cycles)
  const p = (cycles - cycleIndex) * CYCLE
  const variant = ((cycleIndex % VARIANTS) + VARIANTS) % VARIANTS
  const sinceFlash = p - FLASH_AT

  const rs = (size / 32) ** 0.6
  const density = Math.max(0.25, opts.density ?? 1)
  const count = Math.max(12, Math.round(BASE_COUNT * density * Math.sqrt(size / 32)))
  const path = boltPath(size)
  const headArc = sparkArc(p)
  const gain = sparkGain(p)
  const jitter = JITTER * size
  const jitterStep = Math.floor(sinceFlash / JITTER_STEP)

  const dots: Dot[] = []
  outlineArcs(path, count).forEach((u, i) => {
    const level = flashLevel(sinceFlash - RIPPLE * 2 * Math.min(u, 1 - u))
    const seed = i + 17 * variant
    const [px, py] = pointAtArc(path, u)
    dots.push({
      x: px + (hash01(seed, jitterStep * 2) - 0.5) * 2 * jitter * level,
      y: py + (hash01(seed, jitterStep * 2 + 1) - 0.5) * 2 * jitter * level,
      z: level,
      r: lerp(REST.r, LIT.r, level) * rs,
      white: lerp(REST.white, LIT.white, level),
      a: lerp(REST.a, LIT.a, level),
    })
    if (i % 2 === 0 && level > 0.02) {
      dots.push({ x: px, y: py, z: -1, r: BLOOM.r * rs, white: 0, a: BLOOM.a * level })
    }
  })

  if (gain > 0.02) {
    const [hx, hy] = pointAtArc(path, headArc)
    dots.push({ x: hx, y: hy, z: -1, r: HALO.r * rs, white: 0, a: HALO.a * gain })
    dots.push({ x: hx, y: hy, z: 2, r: HEAD_R * rs, white: 0, a: gain })
    for (let k = 1; k <= TAIL_DOTS; k++) {
      const fade = 1 - k / (TAIL_DOTS + 1)
      const [tx, ty] = pointAtArc(path, headArc - k * TAIL_STEP)
      const r = lerp(REST.r, HEAD_R * 0.85, fade) * rs
      dots.push({ x: tx, y: ty, z: 2 - k / 100, r, white: 0, a: gain * fade ** 1.1 })
    }
  }

  if (sinceFlash > 0) dots.push(...burstDots(path, size, rs, variant, sinceFlash))

  for (const d of dots) {
    d.x = clamp(d.x, 0, size)
    d.y = clamp(d.y, 0, size)
  }
  return finalizeFrame(dots, [])
}
