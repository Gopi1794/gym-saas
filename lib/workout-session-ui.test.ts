import { describe, expect, it } from "vitest"
import {
  emitWorkoutSessionVisibility,
  WORKOUT_SESSION_VISIBILITY_EVENT,
} from "./workout-session-ui"

describe("workout session UI visibility", () => {
  it("notifies the mobile navigation when a session starts and ends", () => {
    const details: boolean[] = []
    const listener = (event: Event) => {
      details.push((event as CustomEvent<boolean>).detail)
    }

    window.addEventListener(WORKOUT_SESSION_VISIBILITY_EVENT, listener)
    emitWorkoutSessionVisibility(true)
    emitWorkoutSessionVisibility(false)
    window.removeEventListener(WORKOUT_SESSION_VISIBILITY_EVENT, listener)

    expect(details).toEqual([true, false])
  })
})
