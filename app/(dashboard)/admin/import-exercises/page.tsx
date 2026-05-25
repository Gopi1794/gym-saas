import type { Metadata } from "next"
import ImportExercisesPanel from "@/components/exercises/ImportExercisesPanel"

export const metadata: Metadata = { title: "Importar ejercicios" }

export default function ImportExercisesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Gestión de ejercicios</h1>
        <p className="text-sm text-zinc-500 mt-1">Importá o exportá el catálogo de ejercicios en CSV.</p>
      </div>
      <ImportExercisesPanel />
    </div>
  )
}
