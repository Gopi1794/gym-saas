"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import ExerciseCard from "./ExerciseCard";
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
  page: number;
  pageSize: number;
  total: number;
  initialQuery: string;
  initialCategory: ExerciseCategory | "all";
  initialShowFavorites: boolean;
}

export default function ExerciseGrid({
  exercises,
  userId,
  isAdmin,
  page,
  pageSize,
  total,
  initialQuery,
  initialCategory,
  initialShowFavorites,
}: ExerciseGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState(exercises);
  const [queryReady, setQueryReady] = useState(false);
  const category = initialCategory;
  const showFavorites = initialShowFavorites;

  useEffect(() => setItems(exercises), [exercises]);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (!queryReady) {
      setQueryReady(true);
      return;
    }
    const timeout = window.setTimeout(() => updateParams({ q: query.trim() || null, page: "1" }), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const heroImage = "/img_bliblioteca.png";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    updateParams({ page: String(nextPage) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      <div className="relative z-10 md:mt-10">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-red-500/20 bg-[#100202] shadow-[0_24px_70px_rgba(213,0,0,0.24)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#210202] via-[#b60000] to-[#310202]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_78%_45%,rgba(255,255,255,0.18),transparent_45%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />

          <div className="pointer-events-none absolute -bottom-5 -right-10 z-0 h-[320px] w-[268px] opacity-95 min-[430px]:-right-12 min-[430px]:h-[360px] min-[430px]:w-[302px] min-[1233px]:hidden">
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              className="scale-[1.28] object-contain object-bottom drop-shadow-[0_24px_34px_rgba(0,0,0,0.7)]"
            />
          </div>
          <div className="absolute inset-y-0 right-0 z-[1] w-2/3 bg-gradient-to-l from-transparent via-black/10 to-black/25 min-[1233px]:hidden" />

          <div className="relative z-10 flex min-h-[245px] items-stretch">
            <div className="flex-1 px-5 py-7 pr-4 sm:px-8 sm:py-9">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.48em] !text-white">
                Voltia Training
              </p>
              <h2 className="font-heading text-4xl font-normal uppercase leading-[0.95] tracking-wide !text-white sm:text-5xl">
                Biblioteca
                <br />
                de ejercicios
              </h2>
              <p className="mt-4 max-w-xs text-sm font-medium leading-relaxed !text-white">
                Más de{" "}
                <span className="font-bold !text-white">{total} ejercicios</span>{" "}
                para todos tus objetivos
              </p>

              <div className="mt-6 grid max-w-[340px] grid-cols-3 gap-1.5 rounded-2xl border border-red-300/25 bg-black/30 p-2 shadow-2xl shadow-black/35 backdrop-blur-xl">
                {[
                  { Icon: LayoutGrid, value: `${total}+`, label: "Ejercicios" },
                  { Icon: SlidersHorizontal, value: "Filtros", label: "avanzados" },
                  { Icon: FileText, value: "Instrucciones", label: "detalladas" },
                ].map((s) => (
                  <div
                    key={s.value}
                    className="flex items-center gap-1.5 rounded-xl px-1.5 py-1.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/10">
                      <s.Icon className="h-3 w-3 !text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold leading-tight !text-white">
                        {s.value}
                      </p>
                      <p className="truncate text-[9px] leading-tight !text-white">
                        {s.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 right-[2%] z-20 hidden h-[calc(100%+7rem)] w-[460px] min-[1233px]:block lg:right-[8%]">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-contain object-bottom drop-shadow-[0_28px_40px_rgba(0,0,0,0.65)]"
          />
        </div>
      </div>

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
          onClick={() => updateParams({ favorites: showFavorites ? null : "1", page: "1" })}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
            showFavorites
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : "border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-300 dark:border-white/10 dark:hover:border-white/20",
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

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-white to-transparent md:hidden dark:from-[#0A0A0A]" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-white to-transparent md:hidden dark:from-[#0A0A0A]" />

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="relative inline-flex gap-2 px-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => updateParams({ category: cat.value === "all" ? null : cat.value, page: "1" })}
                className={cn(
                  BASE_TAB,
                  "relative cursor-pointer transition-colors duration-200",
                  category === cat.value
                    ? "border-transparent text-[#ffffff]"
                    : "border-brand-700/40 text-zinc-400 hover:border-brand-700/70 hover:text-zinc-200",
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

      <p className="text-sm text-zinc-500">
        {total} ejercicio{total !== 1 ? "s" : ""}
      </p>

      {items.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          Ningún ejercicio coincide con los filtros
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((exercise, index) => (
            <div
              key={exercise.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <ExerciseCard
                exercise={exercise}
                userId={userId}
                isAdmin={isAdmin}
                onDelete={() =>
                  setItems((prev) => prev.filter((e) => e.id !== exercise.id))
                }
              />
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200"
          >
            Anterior
          </button>
          <span className="text-sm text-zinc-500">Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
