import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Dumbbell, Moon, ClipboardList } from "lucide-react";

type Exercise = {
  name: string;
  sets: number;
  reps: number;
  reps_max?: number | null;
  duration_seconds?: number | null;
};

interface Props {
  planName: string;
  dayName: string;
  exercises: Exercise[];
  gender?: string | null;
}

export default function TodayWorkoutCard({
  planName,
  dayName,
  exercises,
  gender,
}: Props) {
  const heroImage =
    gender === "female"
      ? "/card-mujer/card_mujer.png"
      : "/card-hombre/card_hombre.png";

  if (exercises.length === 0) {
    // No hay un concepto de "día de descanso planificado" aparte: esto es
    // simplemente que el entrenador no cargó ejercicios para hoy. Lleva a
    // /planes (el plan completo del socio) para que pueda ver el resto de
    // la semana aunque hoy esté vacío.
    return (
      <Link
        href="/planes"
        className="relative block overflow-hidden rounded-2xl border border-zinc-200 dark:border-none bg-white dark:bg-brand-950 p-6 active:scale-[0.99] transition-transform"
      >
        {/* Radial glow — solo dark, es donde vive la referencia */}
        <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_75%_75%,rgba(213,0,0,0.55),transparent_60%)]" />

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/15 dark:bg-black/30">
            <Moon className="h-5 w-5 text-brand-600 dark:text-white" />
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-white/70" />
        </div>

        <div className="relative z-10 mt-5 max-w-[65%]">
          <p className="text-sm font-medium text-brand-600 dark:text-white/60">
            Hoy · {dayName}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            Sin rutina hoy
          </p>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-white/70">
            El entrenador no programó ejercicios para hoy. Tocá para ver tu plan.
          </p>
        </div>

        <ClipboardList
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-4 -right-4 z-0 hidden h-32 w-32 text-white/10 dark:block"
        />
      </Link>
    );
  }

  return (
    <Link
      href="/exercises"
      className="block active:scale-[0.99] transition-transform"
    >
      {/* Wrapper — overflow visible so image can stick out above */}
      <div className="relative" style={{ paddingTop: 40 }}>
        {/* ── Card ── */}
        <div
          className="relative overflow-hidden rounded-2xl bg-brand-800"
          style={{ minHeight: 160 }}
        >
          {/* Gradient only covers the left half — right side stays clear for image & button */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/90 to-transparent" />
          <div className="relative z-10 flex h-full min-h-[160px] sm:min-h-[190px] p-5">
            {/* Left: text + exercises */}
            <div className="flex flex-col justify-between max-w-[60%]">
              <div>
                <span className="font-heading text-xs tracking-widest text-white/50">
                  Hoy · {dayName}
                </span>
                <h2 className="mt-1 font-display text-2xl text-white drop-shadow">
                  {planName}
                </h2>
                <p className="mt-0.5 font-heading text-xs tracking-wider text-brand-400">
                  {exercises.length} ejercicio
                  {exercises.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="mt-4 space-y-1.5">
                {exercises.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <Dumbbell className="h-3 w-3 shrink-0 text-brand-400" />
                    <span className="truncate text-sm capitalize text-white/90">
                      {ex.name}
                    </span>
                    <span className="shrink-0 font-heading text-xs tracking-wider text-white/50">
                      {ex.duration_seconds != null
                        ? `${ex.sets}×${ex.duration_seconds}s`
                        : ex.reps_max != null
                          ? `${ex.sets}×${ex.reps}–${ex.reps_max}`
                          : `${ex.sets}×${ex.reps}`}
                    </span>
                  </div>
                ))}
                {exercises.length > 3 && (
                  <p className="text-xs text-white/40">
                    +{exercises.length - 3} más
                  </p>
                )}
              </div>
            </div>
            {/* Arrow */}
            <div className="ml-auto flex items-start pb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                <ChevronRight className="h-5 w-5 text-brand-500" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Image div — sibling of card, overlaid on top ── */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-[62%] sm:w-[68%]"
          style={{ height: "calc(100% + 8px)" }}
        >
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-contain object-bottom"
          />
        </div>
      </div>
    </Link>
  );
}
