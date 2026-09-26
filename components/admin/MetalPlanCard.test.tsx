import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MetalPlanCard, type MetalPlan } from "./MetalPlanCard"

const mocks = vi.hoisted(() => ({
  theme: { resolvedTheme: undefined as string | undefined },
  metalFxProps: [] as Record<string, unknown>[],
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mocks.theme.resolvedTheme }),
}))

vi.mock("metal-fx", () => ({
  MetalFx: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
    mocks.metalFxProps.push(props)
    return (
      <div data-testid="metal-fx" data-metal-plan={props["data-metal-plan"] as string}>
        {children}
      </div>
    )
  },
}))

function stubReducedMotion(matches: boolean) {
  const listeners = new Set<() => void>()
  const state = { matches }
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return state.matches
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    change(next: boolean) {
      state.matches = next
      listeners.forEach(listener => listener())
    },
  }
}

const lastProps = () => mocks.metalFxProps[mocks.metalFxProps.length - 1]

function renderCard(plan: MetalPlan = "premium") {
  return render(
    <MetalPlanCard plan={plan}>
      <div>Plan card body</div>
    </MetalPlanCard>,
  )
}

describe("MetalPlanCard", () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    mocks.theme.resolvedTheme = "dark"
    mocks.metalFxProps.length = 0
    stubReducedMotion(false)
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it("renders the card inside the metal wrapper", () => {
    renderCard()

    expect(screen.getByTestId("metal-fx")).toContainElement(screen.getByText("Plan card body"))
  })

  it.each(["basic", "premium", "vip"] as const)("tags the wrapper with the %s plan", plan => {
    renderCard(plan)

    expect(lastProps()["data-metal-plan"]).toBe(plan)
    expect(lastProps().className).toEqual(expect.stringContaining("metal-plan"))
    expect(lastProps().className).toEqual(expect.stringContaining("w-full"))
  })

  it("matches the card's rounded-2xl corners with a thin ring and inner rim", () => {
    renderCard()

    expect(lastProps()).toMatchObject({ borderRadius: 16, ringCssPx: 3, innerShadow: true })
  })

  it("keeps the card's own border and shadow", () => {
    renderCard()

    expect(lastProps().normalizeHostStyles).toBe(false)
  })

  it.each([
    ["light", "light"],
    ["dark", "dark"],
    [undefined, "dark"],
  ] as const)("uses the %s app theme as the %s ring theme", (resolvedTheme, expected) => {
    mocks.theme.resolvedTheme = resolvedTheme

    renderCard()

    expect(lastProps().theme).toBe(expected)
  })

  it("keeps the effect running when reduced motion is not requested", () => {
    renderCard()

    expect(lastProps().paused).toBe(false)
  })

  it("pauses the effect when the user prefers reduced motion", () => {
    stubReducedMotion(true)

    renderCard()

    expect(lastProps().paused).toBe(true)
  })

  it("reacts when the reduced motion preference changes", () => {
    const motion = stubReducedMotion(false)
    renderCard()
    expect(lastProps().paused).toBe(false)

    act(() => motion.change(true))
    expect(lastProps().paused).toBe(true)

    act(() => motion.change(false))
    expect(lastProps().paused).toBe(false)
  })

  it("does not crash where matchMedia is unavailable", () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined

    renderCard()

    expect(lastProps().paused).toBe(false)
  })
})

describe("metal plan tint rules", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8")

  // A renamed data attribute or plan would silently drop the per-plan color.
  it.each(["basic", "premium", "vip"] as const)("defines a tint for the %s plan", plan => {
    expect(css).toContain(`.metal-plan[data-metal-plan="${plan}"]`)
  })

  it("tints the ring canvas through the plan's filter chain", () => {
    expect(css).toMatch(/\.metal-plan \.metal-fx-canvas\s*\{\s*filter: var\(--metal-hue\)/)
  })
})
