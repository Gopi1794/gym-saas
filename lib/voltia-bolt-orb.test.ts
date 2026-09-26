import { describe, expect, it } from "vitest"
import type { Dot, ModeOpts } from "thinking-orbs/engine"
import {
  BOLT_OUTLINE,
  CYCLE,
  FLASH_AT,
  LAP,
  LOOP_PERIOD,
  boltPath,
  flashLevel,
  outlineArcs,
  pointAtArc,
  sparkArc,
  timeAtPhase,
  voltiaBoltFrame,
} from "./voltia-bolt-orb"

const SIZES = [20, 32, 64]
const REDUCED_MOTION_T = 0.6 // the instant thinking-orbs paints under prefers-reduced-motion
// The last moment of a cycle: the flash and its sparks are over, the spark has not started.
const CALM = 2.19

const at = (size: number, phase: number, cycle = 0, opts: ModeOpts = {}) =>
  voltiaBoltFrame(size, timeAtPhase(phase, cycle), opts)

function distToOutline(size: number, x: number, y: number): number {
  const { verts } = boltPath(size)
  let best = Infinity
  verts.forEach(([ax, ay], i) => {
    const [bx, by] = verts[(i + 1) % verts.length]
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2
    const f = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2))
    best = Math.min(best, Math.hypot(x - (ax + f * (bx - ax)), y - (ay + f * (by - ay))))
  })
  return best
}

const offOutline = (size: number, dots: Dot[]) =>
  dots.filter((d) => distToOutline(size, d.x, d.y) > 0.02 * size).length

// Total visible ink: bigger, more opaque and less faded dots add up.
const brightness = (dots: Dot[]) => dots.reduce((sum, d) => sum + (d.a ?? 1) * (1 - d.white) * d.r ** 2, 0)

// finalizeFrame z-sorts, so the spark head (z = 2) is always the last dot.
const headOf = (dots: Dot[]) => dots[dots.length - 1]

const fields = (d: Dot) => [d.x, d.y, d.r, d.white, d.a ?? 1]

// Same dots up to float noise, whatever their order (z ties may sort either way).
const sameDots = (a: Dot[], b: Dot[]) =>
  a.length === b.length &&
  a.every((d) => b.some((e) => fields(d).every((n, i) => Math.abs(n - fields(e)[i]) < 1e-9)))

// Instants spread over one full loop, flash windows included.
const samples = (step: number) => Array.from({ length: Math.round(LOOP_PERIOD / step) }, (_, i) => i * step)

describe("boltPath", () => {
  it("traces the Voltia logo bolt, centered and with proportions preserved", () => {
    for (const size of SIZES) {
      const { verts } = boltPath(size)
      const xs = verts.map(([x]) => x)
      const ys = verts.map(([, y]) => y)
      const scale = (Math.max(...ys) - Math.min(...ys)) / 24
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(size / 2, 6)
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(size / 2, 6)
      expect(Math.min(...xs, ...ys)).toBeGreaterThan(0.03 * size)
      expect(Math.max(...xs, ...ys)).toBeLessThan(0.97 * size)
      // The logo is 12 wide by 24 tall.
      expect((Math.max(...xs) - Math.min(...xs)) / scale).toBeCloseTo(12, 6)
      // Same vertices, in the same order, as the logo path.
      verts.forEach(([x, y], i) => {
        expect((x - size / 2) / scale + 8).toBeCloseTo(BOLT_OUTLINE[i][0], 6)
        expect((y - size / 2) / scale + 12).toBeCloseTo(BOLT_OUTLINE[i][1], 6)
      })
    }
  })

  it("scales proportionally with size", () => {
    const small = boltPath(32)
    const big = boltPath(64)
    small.verts.forEach(([x, y], i) => {
      expect(big.verts[i][0]).toBeCloseTo(x * 2, 6)
      expect(big.verts[i][1]).toBeCloseTo(y * 2, 6)
    })
    expect(big.total).toBeCloseTo(small.total * 2, 6)
  })

  it("walks the outline by arc fraction and wraps around", () => {
    const path = boltPath(32)
    expect(pointAtArc(path, 0)).toEqual(path.verts[0])
    expect(pointAtArc(path, path.cum[2] / path.total)[0]).toBeCloseTo(path.verts[2][0], 6)
    expect(pointAtArc(path, 1.25)[0]).toBeCloseTo(pointAtArc(path, 0.25)[0], 6)
    expect(pointAtArc(path, -0.75)[1]).toBeCloseTo(pointAtArc(path, 0.25)[1], 6)
  })

  it("places an outline dot on every vertex and spaces them evenly", () => {
    const path = boltPath(32)
    const arcs = outlineArcs(path, 36)
    for (let i = 0; i < path.verts.length; i++) {
      expect(arcs.some((u) => Math.abs(u - path.cum[i] / path.total) < 1e-9)).toBe(true)
    }
    const gaps = arcs.map((u, i) => ((arcs[(i + 1) % arcs.length] - u + 1) % 1) * path.total)
    const mean = path.total / arcs.length
    expect(gaps.every((gap) => gap > mean * 0.6 && gap < mean * 1.5)).toBe(true)
  })
})

describe("timeline helpers", () => {
  it("flashLevel is a short pulse: zero outside, full on the plateau", () => {
    expect(flashLevel(-0.1)).toBe(0)
    expect(flashLevel(0)).toBe(0)
    expect(flashLevel(0.1)).toBe(1)
    expect(flashLevel(0.3)).toBe(0)
    expect(flashLevel(0.02)).toBeGreaterThan(0)
    expect(flashLevel(0.02)).toBeLessThan(flashLevel(0.04))
    expect(flashLevel(0.2)).toBeLessThan(flashLevel(0.15))
  })

  it("sparkArc runs one full lap, monotonically", () => {
    expect(sparkArc(0)).toBe(0)
    expect(sparkArc(LAP)).toBeCloseTo(1, 9)
    const arcs = Array.from({ length: 161 }, (_, i) => sparkArc(i * 0.01))
    expect(arcs.every((u, i) => i === 0 || u > arcs[i - 1])).toBe(true)
  })
})

describe("voltiaBoltFrame", () => {
  it("is deterministic", () => {
    for (const size of SIZES) {
      expect(voltiaBoltFrame(size, 3.21, {})).toEqual(voltiaBoltFrame(size, 3.21, {}))
    }
  })

  it("repeats every LOOP_PERIOD", () => {
    expect(LOOP_PERIOD).toBeCloseTo(CYCLE * 4, 9)
    for (const size of SIZES) {
      const drift = samples(0.043).filter(
        (t) => !sameDots(voltiaBoltFrame(size, t + LOOP_PERIOD, {}).dots, voltiaBoltFrame(size, t, {}).dots)
      )
      expect(drift).toEqual([])
    }
  })

  it("varies the sparks between cycles", () => {
    const dots = [0, 1, 2, 3].map((cycle) => at(32, FLASH_AT + 0.25, cycle).dots)
    for (let i = 1; i < dots.length; i++) {
      expect(sameDots(dots[0], dots[i])).toBe(false)
    }
  })

  it("draws dots only (no lines) and never runs empty", () => {
    for (const size of SIZES) {
      const frames = samples(0.05).map((t) => voltiaBoltFrame(size, t, {}))
      expect(frames.every((f) => f.lines.length === 0 && f.dots.length > 0)).toBe(true)
    }
  })

  it("keeps the dot count stable and scales it with size and density", () => {
    const calm = [CALM, 2.18, 0.005].map((p) => at(32, p).dots.length)
    expect(new Set(calm).size).toBe(1)
    expect(calm[0]).toBe(outlineArcs(boltPath(32), 36).length)
    expect(calm[0]).toBeGreaterThanOrEqual(28)
    expect(calm[0]).toBeLessThanOrEqual(40)

    // While the spark runs, its head, glow and tail come on top of the outline.
    const spark = [0.2, 0.7, 1.2, 1.5].map((p) => at(32, p).dots.length)
    expect(new Set(spark).size).toBe(1)
    expect(spark[0]).toBeGreaterThan(calm[0])

    expect(at(64, CALM).dots.length).toBeGreaterThan(calm[0])
    expect(at(20, CALM).dots.length).toBeLessThan(calm[0])
    expect(at(32, CALM, 0, { density: 2 }).dots.length).toBeGreaterThan(calm[0])
    expect(at(32, CALM, 0, { density: 0.5 }).dots.length).toBeLessThan(calm[0])
  })

  it("keeps every dot inside the canvas at every instant", () => {
    for (const size of SIZES) {
      const invalid = samples(0.01)
        .flatMap((t) => voltiaBoltFrame(size, t, {}).dots)
        .filter(
          (d) =>
            !(d.x >= 0 && d.x <= size && d.y >= 0 && d.y <= size) ||
            !(d.r > 0) ||
            !((d.a ?? 1) > 0 && (d.a ?? 1) <= 1) ||
            !(d.white >= 0 && d.white <= 1)
        )
      expect(invalid).toEqual([])
    }
  })

  it("lays the resting dots and the spark on the bolt outline", () => {
    for (const size of SIZES) {
      const phases: [number, number][] = [[CALM, 0], [2.18, 1], [0.005, 2], [0.4, 3], [0.9, 0], [1.3, 1], [1.5, 2]]
      const strays = phases.flatMap(([phase, cycle]) =>
        at(size, phase, cycle).dots.filter((d) => distToOutline(size, d.x, d.y) > 1e-6)
      )
      expect(strays).toEqual([])
    }
  })

  it("runs a spark head along the outline", () => {
    for (const size of SIZES) {
      const path = boltPath(size)
      for (const phase of [0.4, 0.8, 1.2, 1.5]) {
        const head = headOf(at(size, phase).dots)
        const [hx, hy] = pointAtArc(path, sparkArc(phase))
        expect(head.x).toBeCloseTo(hx, 6)
        expect(head.y).toBeCloseTo(hy, 6)
        expect(head.white).toBe(0)
        expect(head.a).toBe(1)
      }
    }
  })

  it("fades the spark tail out behind the head", () => {
    const dots = at(32, 0.8).dots
    const head = headOf(dots)
    const tail = dots.filter((d) => d !== head && d.z > 1.5).sort((a, b) => b.z - a.z) // nearest to the head first
    expect(tail.length).toBeGreaterThan(3)
    expect(tail[0].r).toBeLessThan(head.r)
    expect(tail.every((d, i) => i === 0 || ((d.a ?? 1) < (tail[i - 1].a ?? 1) && d.r < tail[i - 1].r))).toBe(true)
  })

  it("lights the whole outline during the flash", () => {
    for (const size of SIZES) {
      const calm = at(size, CALM).dots
      const flash = at(size, FLASH_AT + 0.1).dots
      expect(brightness(flash)).toBeGreaterThan(brightness(calm) * 2)

      // Every outline dot reaches full level (z is the level; sparks sit above at z = 1.2).
      const lit = flash.filter((d) => d.z >= 0.99 && d.z <= 1)
      expect(lit).toHaveLength(calm.length)
      expect(lit.every((d) => (d.a ?? 1) > 0.999 && d.white < 0.001)).toBe(true)
      expect(Math.max(...calm.map((d) => d.a ?? 1))).toBeLessThan(0.8)
    }
  })

  it("throws sparks outward only around the flash window", () => {
    for (const size of SIZES) {
      for (const phase of [0.05, 0.8, FLASH_AT - 0.01, 2.17, CALM]) {
        expect(offOutline(size, at(size, phase).dots)).toBe(0)
      }
      const counts = [0, 1, 2, 3].flatMap((cycle) =>
        [0.12, 0.2, 0.3].map((since) => offOutline(size, at(size, FLASH_AT + since, cycle).dots))
      )
      expect(Math.min(...counts)).toBeGreaterThan(2)
    }
  })

  it("paints a complete, fully lit bolt at the reduced-motion instant", () => {
    for (const size of SIZES) {
      const dots = voltiaBoltFrame(size, REDUCED_MOTION_T, {}).dots
      const unlitVertices = boltPath(size).verts.filter(
        ([x, y]) =>
          !dots.some((d) => Math.hypot(d.x - x, d.y - y) < 0.02 * size && (d.a ?? 1) >= 0.95 && d.white <= 0.05)
      )
      expect(unlitVertices).toEqual([])
      expect(brightness(dots)).toBeGreaterThan(brightness(at(size, CALM).dots) * 2)
    }
  })

  it("scales the drawing proportionally with size", () => {
    const bbox = (dots: Dot[]) => [
      Math.min(...dots.map((d) => d.x)),
      Math.max(...dots.map((d) => d.x)),
      Math.min(...dots.map((d) => d.y)),
      Math.max(...dots.map((d) => d.y)),
    ]
    const small = bbox(at(32, CALM).dots)
    bbox(at(64, CALM).dots).forEach((edge, i) => expect(edge).toBeCloseTo(small[i] * 2, 6))
  })
})
