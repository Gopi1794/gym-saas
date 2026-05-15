"use client"

import { useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { ExerciseWithFavorite } from "@/types"
import { CATEGORY_ICONS, StrengthIcon } from "./CategoryIcons"

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "text-emerald-400",
  intermediate: "text-amber-400",
  advanced: "text-red-400",
}

const DIFFICULTY_BG: Record<string, string> = {
  beginner: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  intermediate: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  advanced: "border-red-500/30 bg-red-500/10 text-red-400",
}

interface ExerciseCardProps {
  exercise: ExerciseWithFavorite
  userId: string
  isAdmin?: boolean
}

export default function ExerciseCard({ exercise, userId, isAdmin }: ExerciseCardProps) {
  const [isFavorite, setIsFavorite] = useState(exercise.is_favorite)
  const [favLoading, setFavLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState(exercise.image_url)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation()
    if (favLoading) return
    setFavLoading(true)

    if (isFavorite) {
      await supabase
        .from("exercise_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("exercise_id", exercise.id)
      setIsFavorite(false)
    } else {
      await supabase
        .from("exercise_favorites")
        .insert({ user_id: userId, exercise_id: exercise.id })
      setIsFavorite(true)
    }
    setFavLoading(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const ext = file.name.split(".").pop()
    const path = `${exercise.id}.${ext}`
    const { error: storageError } = await supabase.storage
      .from("exercise-images")
      .upload(path, file, { upsert: true })
    if (storageError) {
      setUploadError(storageError.message)
    } else {
      const { data } = supabase.storage.from("exercise-images").getPublicUrl(path)
      const { error: dbError } = await supabase
        .from("exercises")
        .update({ image_url: data.publicUrl })
        .eq("id", exercise.id)
      if (dbError) {
        setUploadError(dbError.message)
      } else {
        setImageUrl(data.publicUrl)
        setImgError(false)
      }
    }
    setUploading(false)
  }

  const hasGif = !!imageUrl && !imgError

  // Parse description into steps if it has numbered sentences
  const instructions = exercise.description
    ? exercise.description.split(/(?<=\.)\s+/).filter(Boolean)
    : []

  return (
    <>
      {/* â”€â”€ Card â”€â”€ */}
      <div
        onClick={() => setOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-card via-card to-brand-950/15 backdrop-blur-md transition-all hover:border-brand-700/30 hover:to-brand-950/25 hover:shadow-lg hover:shadow-brand-950/10"
      >
        {/* GIF / Fallback */}
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-muted via-card to-brand-950/20">
          {hasGif ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl!}
              alt={exercise.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted/70 via-card to-brand-950/25">
              {(() => { const Icon = CATEGORY_ICONS[exercise.category] ?? StrengthIcon; return <Icon size={56} /> })()}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" />

          {/* Favorite */}
          <button
            onClick={toggleFavorite}
            disabled={favLoading}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className={cn(
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-base backdrop-blur-sm transition-transform active:scale-90",
              favLoading && "opacity-50"
            )}
          >
            {isFavorite ? "â¤ï¸" : "ðŸ¤"}
          </button>

          {/* Difficulty pill */}
          <div className="absolute bottom-2 left-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium capitalize backdrop-blur-sm",
                DIFFICULTY_BG[exercise.difficulty]
              )}
            >
              {exercise.difficulty}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="mb-1 truncate font-semibold capitalize text-zinc-50">
            {exercise.name}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-zinc-700 text-xs capitalize text-zinc-400"
            >
              {exercise.category}
            </Badge>
          </div>

          {exercise.muscle_groups.length > 0 && (
            <p className="mt-2 truncate text-xs capitalize text-zinc-500">
              {exercise.muscle_groups.slice(0, 3).join(" Â· ")}
            </p>
          )}
        </div>
      </div>

      {/* â”€â”€ Detail Modal â”€â”€ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize text-zinc-50">
              {exercise.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* GIF large */}
            {hasGif && (
              <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl!}
                  alt={exercise.name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-zinc-700 capitalize text-zinc-300"
              >
                {exercise.category}
              </Badge>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                  DIFFICULTY_BG[exercise.difficulty]
                )}
              >
                {exercise.difficulty}
              </span>
            </div>

            {/* Muscles */}
            {exercise.muscle_groups.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Muscles
                </p>
                <div className="flex flex-wrap gap-2">
                  {exercise.muscle_groups.map((m, i) => (
                    <span
                      key={m}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs capitalize",
                        i === 0
                          ? "bg-gradient-to-r from-brand-950/35 to-brand-700/10 text-brand-300"
                          : "bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            {instructions.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  How to perform
                </p>
                <ol className="space-y-3">
                  {instructions.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700/20 text-xs font-bold text-brand-500">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-zinc-300">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Admin image upload */}
            {isAdmin && (
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  {uploading ? "Subiendoâ€¦" : imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </Button>
                {uploadError && (
                  <p className="text-xs text-red-400">{uploadError}</p>
                )}
              </div>
            )}

            {/* Favorite button */}
            <Button
              onClick={(e) => toggleFavorite(e)}
              variant="outline"
              className={cn(
                "w-full border-zinc-700",
                isFavorite
                  ? "border-brand-700/30 bg-gradient-to-r from-brand-950/30 to-brand-700/10 text-brand-300 hover:to-brand-700/20"
                  : "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              {isFavorite ? "â¤ï¸ Quitar de favoritos" : "ðŸ¤ Agregar a favoritos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

