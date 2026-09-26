import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolvePreset } from "thinking-orbs"
import { voltiaBoltFrame } from "@/lib/voltia-bolt-orb"
import { ThinkingIndicator } from "./ThinkingIndicator"

const orb = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))

// jsdom has no canvas: replace the orb with a stub that records what it is given.
vi.mock("thinking-orbs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("thinking-orbs")>()),
  ThinkingOrb: (props: Record<string, unknown>) => {
    orb.props.push(props)
    return <canvas data-testid="orb" aria-hidden={props["aria-hidden"] as boolean | undefined} />
  },
}))

const lastOrbProps = () => orb.props[orb.props.length - 1]

describe("ThinkingIndicator", () => {
  beforeEach(() => {
    orb.props.length = 0
  })

  it("shows the word Pensando as a polite live status", () => {
    render(<ThinkingIndicator />)

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveTextContent("Pensando")
    expect(screen.getByText("Pensando")).toBeInTheDocument()
  })

  it("no longer shows the old working label", () => {
    render(<ThinkingIndicator />)

    expect(screen.queryByText(/trabajando/i)).not.toBeInTheDocument()
  })

  it("draws the Voltia bolt in brand red with the 32 px orb", () => {
    render(<ThinkingIndicator />)

    expect(lastOrbProps()).toMatchObject({ size: 32, color: "#ef4444" })
    expect(lastOrbProps().frame).toBe(voltiaBoltFrame)
  })

  it("feeds the frame seconds, cancelling the orb's baked preset speed", () => {
    render(<ThinkingIndicator />)

    const speed = lastOrbProps().speed as number
    expect(speed * resolvePreset("working", 32).speed).toBeCloseTo(1, 9)
  })

  it("keeps the canvas out of the accessibility tree", () => {
    render(<ThinkingIndicator />)

    expect(lastOrbProps()["aria-hidden"]).toBe(true)
    expect(screen.getByTestId("orb")).toHaveAttribute("aria-hidden", "true")
  })

  it("styles itself like an assistant bubble and accepts extra classes", () => {
    render(<ThinkingIndicator className="mt-2" />)

    const status = screen.getByRole("status")
    expect(status).toHaveClass("rounded-2xl", "rounded-bl-sm", "bg-zinc-100", "dark:bg-zinc-800", "w-fit", "mt-2")
    expect(status).toHaveClass("text-sm", "text-zinc-600", "dark:text-zinc-300")
  })
})
