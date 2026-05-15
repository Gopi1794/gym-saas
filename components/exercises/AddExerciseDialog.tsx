"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: "strength", label: "Fuerza" },
  { value: "cardio", label: "Cardio" },
  { value: "hiit", label: "HIIT" },
  { value: "flexibility", label: "Flexibilidad" },
  { value: "balance", label: "Equilibrio" },
] as const

const DIFFICULTIES = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
] as const

type Category = (typeof CATEGORIES)[number]["value"]
type Difficulty = (typeof DIFFICULTIES)[number]["value"]

export default function AddExerciseDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState<Category>("strength")
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner")
  const [muscles, setMuscles] = useState("")
  const [description, setDescription] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function reset() {
    setName("")
    setCategory("strength")
    setDifficulty("beginner")
    setMuscles("")
    setDescription("")
    setImageFile(null)
    setPreview(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const muscleGroups = muscles
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 6)

    const { data: exercise, error: insertError } = await supabase
      .from("exercises")
      .insert({
        name: name.trim().toLowerCase(),
        description: description.trim() || null,
        category,
        difficulty,
        muscle_groups: muscleGroups,
        image_url: null,
      })
      .select("id")
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    if (imageFile && exercise) {
      const ext = imageFile.name.split(".").pop()
      const path = `${exercise.id}.${ext}`
      const { error: storageError } = await supabase.storage
        .from("exercise-images")
        .upload(path, imageFile, { upsert: true })

      if (!storageError) {
        const { data } = supabase.storage.from("exercise-images").getPublicUrl(path)
        await supabase
          .from("exercises")
          .update({ image_url: data.publicUrl })
          .eq("id", exercise.id)
      }
    }

    setLoading(false)
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Agregar ejercicio
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Nuevo ejercicio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Nombre *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Sentadilla con barra"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    category === c.value
                      ? "bg-brand-700 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Dificultad</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    difficulty === d.value
                      ? "bg-brand-700 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Muscle groups */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Músculos (separados por coma)</label>
            <Input
              value={muscles}
              onChange={(e) => setMuscles(e.target.value)}
              placeholder="ej. Cuádriceps, Glúteos, Core"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Descripción / Instrucciones</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explicá cómo realizar el ejercicio paso a paso..."
              rows={4}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Imagen (opcional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="preview"
                  className="h-40 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = "" }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-zinc-300 hover:bg-black/80"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full border-dashed border-zinc-600 text-zinc-400 hover:bg-zinc-800"
              >
                Seleccionar imagen o GIF
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-400"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-brand-700 hover:bg-brand-800 text-white"
            >
              {loading ? "Guardando…" : "Guardar ejercicio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
