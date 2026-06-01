"use client";

import { useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseWithFavorite } from "@/types";
import { CATEGORY_ICONS, StrengthIcon } from "./CategoryIcons";

const CATEGORY_FALLBACK_BG: Record<string, string> = {
  strength: "from-amber-950/50 to-zinc-900",
  cardio: "from-blue-950/50 to-zinc-900",
  hiit: "from-red-950/50 to-zinc-900",
  flexibility: "from-teal-950/50 to-zinc-900",
  balance: "from-violet-950/50 to-zinc-900",
};

const CATEGORY_LABEL: Record<string, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  hiit: "HIIT",
  flexibility: "Flexibilidad",
  balance: "Equilibrio",
};

interface ExerciseCardProps {
  exercise: ExerciseWithFavorite;
  userId: string;
  isAdmin?: boolean;
  onDelete?: () => void;
}

export default function ExerciseCard({
  exercise,
  userId,
  isAdmin,
  onDelete,
}: ExerciseCardProps) {
  const [isFavorite, setIsFavorite] = useState(exercise.is_favorite);
  const [favLoading, setFavLoading] = useState(false);
  const [justFavorited, setJustFavorited] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState(exercise.image_url);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await supabase.from("exercises").delete().eq("id", exercise.id);
    setDeleting(false);
    setOpen(false);
    onDelete?.();
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (favLoading) return;
    setFavLoading(true);

    if (isFavorite) {
      await supabase
        .from("exercise_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("exercise_id", exercise.id);
      setIsFavorite(false);
      setJustFavorited(false);
    } else {
      await supabase
        .from("exercise_favorites")
        .insert({ user_id: userId, exercise_id: exercise.id });
      setIsFavorite(true);
      setJustFavorited(true);
      setAnimKey((k) => k + 1);
      setTimeout(() => setJustFavorited(false), 3100);
    }
    setFavLoading(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop();
    const filePath = `${exercise.id}.${ext}`;
    const { error: storageError } = await supabase.storage
      .from("exercise-images")
      .upload(filePath, file, { upsert: true });
    if (storageError) {
      setUploadError(storageError.message);
    } else {
      const { data } = supabase.storage
        .from("exercise-images")
        .getPublicUrl(filePath);
      const { error: dbError } = await supabase
        .from("exercises")
        .update({ image_url: data.publicUrl })
        .eq("id", exercise.id);
      if (dbError) {
        setUploadError(dbError.message);
      } else {
        setImageUrl(data.publicUrl);
        setImgError(false);
      }
    }
    setUploading(false);
  }

  const hasImage = !!imageUrl && !imgError;
  const CategoryIcon = CATEGORY_ICONS[exercise.category] ?? StrengthIcon;

  const instructions = exercise.description
    ? exercise.description.split(/(?<=\.)\s+/).filter(Boolean)
    : [];

  return (
    <>
      {/* Card */}
      <div
        onClick={() => setOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-900 transition-all duration-200 hover:border-brand-700/40 hover:shadow-lg hover:shadow-black/30 active:scale-[0.98]"
      >
        {/* Image / Fallback */}
        <div className="relative h-40 w-full overflow-hidden bg-zinc-800">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl!}
              alt={exercise.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className={`flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br ${CATEGORY_FALLBACK_BG[exercise.category] ?? "from-zinc-800 to-zinc-900"}`}
            >
              <CategoryIcon size={48} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {CATEGORY_LABEL[exercise.category] ?? exercise.category}
              </span>
            </div>
          )}

          {/* Gradient + blur overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/95 via-black/60 to-transparent backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_60%,transparent)]" />

          {/* Favorite — touch target 44×44 */}
          <button
            onClick={toggleFavorite}
            disabled={favLoading}
            aria-label={
              isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
            }
            className="absolute right-1.5 top-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-90"
          >
            {favLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : justFavorited ? (
              <DotLottieReact
                key={animKey}
                src="/animations/like.json"
                autoplay
                loop={false}
                style={{ width: 40, height: 40 }}
              />
            ) : (
              <Heart
                className={cn(
                  "h-4 w-4 transition-all duration-150",
                  isFavorite
                    ? "fill-red-500 text-red-500 scale-110"
                    : "fill-transparent text-[#a1a1aa] group-hover:text-[#ffffff]",
                )}
              />
            )}
          </button>

          {/* All info overlaid on the image */}
          <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5">
            <h3 className="mt-1 truncate text-sm font-semibold capitalize leading-tight text-[#ffffff]">
              {exercise.name}
            </h3>
            <p className="mt-0.5 text-xs capitalize text-[#d4d4d8]">
              {CATEGORY_LABEL[exercise.category] ?? exercise.category}
            </p>
            {exercise.muscle_groups.length > 0 && (
              <p className="mt-0.5 truncate text-xs capitalize text-[#a1a1aa]">
                {exercise.muscle_groups.slice(0, 3).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl [scrollbar-width:thin] [scrollbar-color:theme(colors.zinc.700)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-600">
          <DialogHeader>
            <DialogTitle className="capitalize text-zinc-50">
              {exercise.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Image or icon hero */}
            <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-800/60">
              {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl!}
                  alt={exercise.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-600">
                  <CategoryIcon size={64} />
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    {CATEGORY_LABEL[exercise.category] ?? exercise.category}
                  </span>
                </div>
              )}

              {/* Favorite button overlaid on modal image */}
              <button
                onClick={toggleFavorite}
                disabled={favLoading}
                aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                className="absolute right-2 top-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-90"
              >
                {favLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : justFavorited ? (
                  <DotLottieReact
                    key={animKey}
                    src="/animations/like.json"
                    autoplay
                    loop={false}
                    style={{ width: 40, height: 40 }}
                  />
                ) : (
                  <Heart
                    className={cn(
                      "h-4 w-4 transition-all duration-150",
                      isFavorite
                        ? "fill-red-500 text-red-500 scale-110"
                        : "fill-transparent text-zinc-400",
                    )}
                  />
                )}
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-zinc-700 capitalize text-zinc-300"
              >
                {CATEGORY_LABEL[exercise.category] ?? exercise.category}
              </Badge>
            </div>

            {/* Muscles */}
            {exercise.muscle_groups.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Músculos
                </p>
                <div className="flex flex-wrap gap-2">
                  {exercise.muscle_groups.map((m, i) => (
                    <span
                      key={m}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs capitalize",
                        i === 0
                          ? "bg-brand-700/15 text-brand-600 dark:text-brand-300 border border-brand-700/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700",
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
                  Cómo realizarlo
                </p>
                <ol className="space-y-3">
                  {instructions.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700/20 text-xs font-bold text-brand-500">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Admin image upload + delete */}
            {isAdmin && (
              <div className="space-y-2">
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
                  {uploading
                    ? "Subiendo…"
                    : imageUrl
                      ? "Cambiar imagen"
                      : "Subir imagen"}
                </Button>
                {uploadError && (
                  <p className="text-xs text-red-400">{uploadError}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting}
                    onClick={handleDelete}
                    className={cn(
                      "flex-1 gap-2 border-red-900/40 text-red-400 hover:bg-red-950/30",
                      confirmDelete && "bg-red-950/20",
                    )}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {confirmDelete
                      ? "¿Confirmar borrado?"
                      : "Eliminar ejercicio"}
                  </Button>
                  {confirmDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
