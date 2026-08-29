// components/anatomy/MuscleDetailSheet.test.tsx
import { fireEvent, render, screen } from "@testing-library/react"
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
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized={false}
        onClose={vi.fn()}
        onToggle={vi.fn()}
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
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized={false}
        onClose={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText("Press de banca")).toBeInTheDocument()
  })

  it("explica como se completan los ejercicios cuando la zona esta vacia", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        recommendation={{ exercises: [], source: "none" }}
        minimized={false}
        onClose={vi.fn()}
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByText("Todavía no hay ejercicios asociados.")).toBeInTheDocument()
  })

  it("no renderiza contenido cuando esta minimizado", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized={true}
        onClose={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(screen.queryByText(MUSCLE_ANATOMY.chest.origen)).not.toBeInTheDocument()
  })

  it("permite volver a abrir la ficha minimizada", () => {
    const onToggle = vi.fn()
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized
        onClose={vi.fn()}
        onToggle={onToggle}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Mostrar ficha de Pectoral Mayor" }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it("se convierte en panel lateral a partir de escritorio", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized={false}
        onClose={vi.fn()}
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByTestId("muscle-detail-panel")).toHaveClass("lg:right-0", "lg:w-[min(26rem,35vw)]")
  })

  it("colapsa el drawer de escritorio a una pestaña", () => {
    render(
      <MuscleDetailSheet
        entry={MUSCLE_ANATOMY.chest}
        recommendation={{ exercises: EXERCISES, source: "direct" }}
        minimized
        onClose={vi.fn()}
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByTestId("muscle-detail-panel")).toHaveClass("lg:w-14")
  })
})
