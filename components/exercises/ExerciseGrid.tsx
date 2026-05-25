"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import ExerciseCard from "./ExerciseCard";
import { useScreenSize } from "@/hooks/use-screen-size";
import { Input } from "@/components/ui/input";
import {
  Search,
  Heart,
  LayoutGrid,
  Dumbbell,
  Activity,
  Zap,
  Wind,
  Scale,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
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
  TabIcon: React.ComponentType<{ className?: string }>;
  CardIcon: React.FC<{ size?: number }>;
}[] = [
  { value: "all", label: "Todos", TabIcon: LayoutGrid, CardIcon: AllIcon },
  {
    value: "strength",
    label: "Fuerza",
    TabIcon: Dumbbell,
    CardIcon: StrengthIcon,
  },
  { value: "cardio", label: "Cardio", TabIcon: Activity, CardIcon: CardioIcon },
  { value: "hiit", label: "HIIT", TabIcon: Zap, CardIcon: HiitIcon },
  {
    value: "flexibility",
    label: "Flexibilidad",
    TabIcon: Wind,
    CardIcon: FlexibilityIcon,
  },
  {
    value: "balance",
    label: "Equilibrio",
    TabIcon: Scale,
    CardIcon: BalanceIcon,
  },
];

const BASE_TAB =
  "flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium";

interface ExerciseGridProps {
  exercises: ExerciseWithFavorite[];
  userId: string;
  isAdmin?: boolean;
}

export default function ExerciseGrid({
  exercises,
  userId,
  isAdmin,
}: ExerciseGridProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [items, setItems] = useState(exercises);
  const screenSize = useScreenSize();

  const heroImage = "/img_bliblioteca.png";

  const filtered = items.filter((ex) => {
    const matchesQuery = ex.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || ex.category === category;
    const matchesFavorites = !showFavorites || ex.is_favorite;
    return matchesQuery && matchesCategory && matchesFavorites;
  });

  return (
    <div className="space-y-5">

      {/* Hero banner — wrapper allows image to overflow above */}
      <div className="relative z-10 md:mt-12">
        {/* Card background — clipped independently */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0c0000] shadow-[0_20px_60px_rgba(213,0,0,0.30)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0000] via-brand-800 to-brand-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_90%_at_72%_50%,rgba(255,60,60,0.18),transparent_65%)]" />

          {/* Text + stats */}
          <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
              GymFlow Training
            </p>
            <h2 className="font-heading text-4xl font-normal tracking-wide text-[#ffffff] sm:text-5xl">
              Biblioteca de ejercicios
            </h2>
            <p className="mt-2 text-sm text-[#d4d4d8]">
              Más de {items.length} ejercicios para todos tus objetivos
            </p>

            {/* Stats — horizontal row */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {[
                {
                  Icon: LayoutGrid,
                  value: `${items.length}+`,
                  label: "Ejercicios",
                },
                {
                  Icon: SlidersHorizontal,
                  value: "Filtros avanzados",
                  label: "Encontrá lo que necesitás",
                },
                {
                  Icon: FileText,
                  value: "Instrucciones",
                  label: "Descripciones detalladas",
                },
              ].map((s) => (
                <div key={s.value} className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                    <s.Icon className="h-3.5 w-3.5 text-[#ffffff]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-[#ffffff]">
                      {s.value}
                    </p>
                    <p className="text-xs text-[#a1a1aa]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Image — feet at card bottom, body overflows upward. Hidden on mobile (card too narrow) */}
        <div className="pointer-events-none absolute bottom-0 right-[10%] z-20 h-[calc(100%+6rem)] w-[450px] hidden md:block">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-contain object-bottom"
          />
        </div>
      </div>

      {/* Search + favorites */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-9"
            placeholder="Buscar ejercicios..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFavorites(!showFavorites)}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
            showFavorites
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : "border-zinc-300 dark:border-white/10 text-zinc-400 hover:border-zinc-400 dark:hover:border-white/20 hover:text-zinc-300",
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              showFavorites && "fill-red-500 text-red-500",
            )}
          />
          Favoritos
        </button>
      </div>

      {/* Category tabs — Gooey animation */}
      <div className="relative">
        {/* Edge fade — left, mobile only */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-white dark:from-[#0A0A0A] to-transparent md:hidden" />
        {/* Edge fade — right, mobile only */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-white dark:from-[#0A0A0A] to-transparent md:hidden" />

      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative inline-flex gap-2 px-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                BASE_TAB,
                "relative cursor-pointer transition-colors duration-200",
                category === cat.value
                  ? "text-[#ffffff] border-transparent"
                  : "text-zinc-400 border-brand-700/40 hover:text-zinc-200 hover:border-brand-700/70",
              )}
            >
              {category === cat.value && (
                <motion.div
                  layoutId="exercise-tab-bg"
                  className="absolute inset-0 rounded-full bg-[rgba(213,0,0,0.85)]"
                  transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                />
              )}
              <cat.TabIcon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Count */}
      <p className="text-sm text-zinc-500">
        {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
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
                onDelete={() => setItems((prev) => prev.filter((e) => e.id !== exercise.id))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
