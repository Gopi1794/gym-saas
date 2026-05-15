"use client";

import { useState, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import ExerciseCard from "./ExerciseCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseWithFavorite, ExerciseCategory } from "@/types";
import {
  AllIcon,
  StrengthIcon,
  CardioIcon,
  HiitIcon,
  FlexibilityIcon,
  BalanceIcon,
} from "./CategoryIcons";

const CATEGORIES: {
  value: ExerciseCategory | "all";
  label: string;
  Icon: React.FC<{ size?: number }>;
}[] = [
  { value: "all", label: "Todo", Icon: AllIcon },
  { value: "strength", label: "Fuerza", Icon: StrengthIcon },
  { value: "cardio", label: "Cardio", Icon: CardioIcon },
  { value: "hiit", label: "HIIT", Icon: HiitIcon },
  { value: "flexibility", label: "Flexibilidad", Icon: FlexibilityIcon },
  { value: "balance", label: "Equilibrio", Icon: BalanceIcon },
];

const BASE_TAB =
  "shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-medium";

interface ExerciseGridProps {
  exercises: ExerciseWithFavorite[];
  userId: string;
  isAdmin?: boolean;
  userGender?: string | null;
}

function isFemaleGender(gender?: string | null) {
  if (!gender) return false;

  return ["female", "femenino", "mujer", "woman"].includes(
    gender.toLowerCase(),
  );
}

export default function ExerciseGrid({
  exercises,
  userId,
  isAdmin,
  userGender,
}: ExerciseGridProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const heroImage = isFemaleGender(userGender)
    ? "/card-mujer/card_mujer.png"
    : "/card-hombre/card_hombre.png";

  // Clip-path tab animation refs
  const innerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [clipPath, setClipPath] = useState("inset(0 100% 0 0 round 16px)");
  const activeIndex = CATEGORIES.findIndex((c) => c.value === category);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const btn = btnRefs.current[activeIndex];
    if (!inner || !btn) return;

    const totalWidth = inner.offsetWidth;
    const left = btn.offsetLeft;
    const right = totalWidth - left - btn.offsetWidth;
    setClipPath(`inset(0 ${right}px 0 ${left}px round 16px)`);
  }, [category, activeIndex]);

  const filtered = exercises.filter((ex) => {
    const matchesQuery = ex.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || ex.category === category;
    const matchesFavorites = !showFavorites || ex.is_favorite;
    return matchesQuery && matchesCategory && matchesFavorites;
  });

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-[#0c0000] shadow-[0_20px_60px_rgba(213,0,0,0.30)]">
        {/* Gradient: almost-black left → vibrant red right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0000] via-brand-800 to-brand-700" />
        {/* Radial depth on the right where the person is */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_90%_at_72%_50%,rgba(255,60,60,0.18),transparent_65%)]" />

        {/* Person image — white bg removed via multiply, fades on left edge */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          style={{
            maskImage: "linear-gradient(to right, transparent 0%, black 35%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 35%)",
            mixBlendMode: "multiply",
          }}
        >
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-contain object-right-bottom"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        <div className="relative z-10 max-w-xl px-6 py-8 sm:px-8 sm:py-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
            GymFlow Training
          </p>
          <h2 className="font-heading text-4xl font-normal tracking-wide text-white sm:text-5xl">
            Biblioteca de ejercicios
          </h2>
          <p className="mt-2 max-w-md text-sm text-zinc-300">
            Filtrá, guardá favoritos y encontrá rápido el movimiento correcto
            para cada rutina.
          </p>
        </div>
      </div>

      {/* Search + favorites */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-9"
            placeholder="Buscar ejercicios…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button
          onClick={() => setShowFavorites(!showFavorites)}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
            showFavorites
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : "border-white/10 bg-zinc-900/50 backdrop-blur-md text-zinc-400",
          )}
        >
          <span>❤</span> Favoritos
        </button>
      </div>

      {/* Category tabs — Emil Kowalski clip-path technique */}
      <div className="overflow-x-auto pb-1">
        <div ref={innerRef} className="relative inline-flex gap-2">
          {/* Base layer — inactive style */}
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.value}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              onClick={() => setCategory(cat.value)}
              className={cn(
                BASE_TAB,
                "border-white/10 bg-zinc-900/50 backdrop-blur-md text-zinc-400",
              )}
            >
              <cat.Icon size={28} />
              {cat.label}
            </button>
          ))}

          {/* Overlay layer — active style, clipped to the selected tab */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex gap-2"
            style={{
              clipPath,
              transition: "clip-path 220ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                tabIndex={-1}
                className={cn(
                  BASE_TAB,
                  "border-brand-700/60 bg-brand-700/10 text-brand-400 shadow-[0_0_12px_2px_rgba(139,92,246,0.25)]",
                )}
              >
                <cat.Icon size={28} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-zinc-500">
        {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Grid with stagger fade-up */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          Ningún ejercicio coincide con los filtros
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((exercise, index) => (
            <div
              key={exercise.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <ExerciseCard
                exercise={exercise}
                userId={userId}
                isAdmin={isAdmin}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
