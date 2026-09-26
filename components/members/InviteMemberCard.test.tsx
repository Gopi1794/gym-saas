import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import InviteMemberCard from "./InviteMemberCard"

describe("InviteMemberCard", () => {
  it("shows the invite link of the gym", () => {
    render(<InviteMemberCard inviteCode="abc-123" />)

    expect(screen.getByText(/register\?gym=abc-123/)).toBeTruthy()
  })

  // A bare `grid` has an implicit `auto` column that cannot shrink below the unbreakable
  // invite link, so on phones the card grew wider than its container and got clipped.
  it("keeps a single shrinkable column on mobile so the long link cannot widen the card", () => {
    const { container } = render(<InviteMemberCard inviteCode="abc-123" />)

    const grid = container.querySelector(".grid.gap-6")

    expect(grid?.classList.contains("grid-cols-1")).toBe(true)
    expect(grid?.classList.contains("sm:grid-cols-2")).toBe(true)
  })

  it("truncates the link instead of wrapping it", () => {
    render(<InviteMemberCard inviteCode="abc-123" />)

    expect(screen.getByText(/register\?gym=abc-123/).classList.contains("truncate")).toBe(true)
  })
})
