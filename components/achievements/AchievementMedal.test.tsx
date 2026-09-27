import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import AchievementMedal from "./AchievementMedal"

function imgOf(container: HTMLElement) {
  return container.querySelector("img")
}

describe("AchievementMedal", () => {
  it("renders an image for a local path", () => {
    const { container } = render(<AchievementMedal icon="/medallas/medalla_hierro.png" />)
    const img = imgOf(container)
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute("src", "/medallas/medalla_hierro.png")
    expect(container).not.toHaveTextContent("/medallas")
  })

  it("renders an image for an http(s) URL", () => {
    const { container } = render(<AchievementMedal icon="https://cdn.example.com/medal.png" />)
    expect(imgOf(container)).toHaveAttribute("src", "https://cdn.example.com/medal.png")
  })

  it("treats the image as decorative", () => {
    const { container } = render(<AchievementMedal icon="/medallas/medalla_hierro.png" />)
    expect(imgOf(container)).toHaveAttribute("alt", "")
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
  })

  it("renders an emoji as text, not as an image", () => {
    const { container } = render(<AchievementMedal icon="🔥" />)
    expect(imgOf(container)).toBeNull()
    expect(container).toHaveTextContent("🔥")
  })

  it.each([null, undefined, "", "   "])("falls back to the trophy for %j", (icon) => {
    const { container } = render(<AchievementMedal icon={icon} />)
    expect(imgOf(container)).toBeNull()
    expect(container).toHaveTextContent("🏆")
  })

  it("falls back to the trophy when the image fails to load", () => {
    const { container } = render(<AchievementMedal icon="/medallas/missing.png" />)
    fireEvent.error(imgOf(container)!)
    expect(imgOf(container)).toBeNull()
    expect(container).toHaveTextContent("🏆")
    expect(container).not.toHaveTextContent("/medallas")
  })

  it("applies the requested size and can drop the tile", () => {
    const { container, rerender } = render(<AchievementMedal icon="🔥" size="lg" />)
    expect(container.firstElementChild).toHaveClass("h-16", "w-16", "ring-1")

    rerender(<AchievementMedal icon="🔥" size="sm" tile={false} />)
    expect(container.firstElementChild).toHaveClass("h-10", "w-10")
    expect(container.firstElementChild).not.toHaveClass("ring-1")
  })
})
