export const WORKOUT_SESSION_VISIBILITY_EVENT = "voltia:workout-session-visibility"

export function emitWorkoutSessionVisibility(active: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(WORKOUT_SESSION_VISIBILITY_EVENT, {
    detail: active,
  }))
}
