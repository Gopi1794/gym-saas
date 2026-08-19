// components/anatomy/MuscleDetailSheet.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { MuscleDetailSheet } from "./MuscleDetailSheet"
import { MUSCLE_ANATOMY } from "@/lib/muscle-anatomy"
import type { Exercise } from "@/lib/muscle-exercises"

const EXERCISES: Exercise[] = [
  { id: "1", name: "Press de banca", category: "Fuerza", image_url: null, muscle_groups: ["Pecho"], is_timed: false },
]

describe("MuscleDetailSheet", () => {
  it("muestra el nombre, categoria y datos anatomicos del musculo", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={false}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.getByText("Pectoral Mayor")).toBeInTheDocument()
    expect(screen.getByText(MUSCLE_ANATOMY.chest.category)).toBeInTheDocument()
    expect(screen.getByText(MUSCLE_ANATOMY.chest.origen)).toBeInTheDocument()
  })

  it("muestra solo los ejercicios que le pasan como prop", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={false}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.getByText("Press de banca")).toBeInTheDocument()
  })

  it("no renderiza contenido cuando esta minimizado", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        exercises={EXERCISES}
        minimized={true}
        onClose={vi.fn()}
        onMinimize={vi.fn()}
      />
    )
    expect(screen.queryByText(MUSCLE_ANATOMY.chest.origen)).not.toBeInTheDocument()
  })
})
