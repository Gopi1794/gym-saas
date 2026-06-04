import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Dumbbell, Moon } from "lucide-react";

type Exercise = { name: string; sets: number; reps: number; reps_max?: number | null; duration_seconds?: number | null };

interface Props {
  planName: string;
  dayName: string;
  exercises: Exercise[];
  hasPlan?: boolean;
  gender?: string | null;
}

export default function TodayWorkoutCard({
  planName,
  dayName,
  exercises,
  hasPlan = false,
  gender,
}: Props) {
  const heroImage =
    gender === "female"
      ? "/card-mujer/card_mujer.png"
      : "/card-hombre/card_hombre.png";
  const isRestDay = exercises.length === 0;

  if (isRestDay) {
    // Plan exists but no workout today → trainer hasn't scheduled this day
    const restHref = hasPlan ? "/planes" : "/exercises";
    const restTitle = hasPlan ? "Sin rutina hoy" : "Día de descanso";
    const restSubtitle = hasPlan
      ? "El entrenador no programó ejercicios para hoy. Tocá para ver tu plan."
      : "Recuperate, mañana volvemos 💪";

    return (
      <Link href={restHref} className="block">
        <div
          className="relative overflow-hidden rounded-2xl bg-brand-950"
          style={{ minHeight: 140 }}
        >
          <Image
            src="/dia-de-descanso.jpg"
            alt=""
            fill
            className="object-cover object-[38%_38%]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="relative z-10 flex h-full min-h-[140px] sm:min-h-[180px] items-center p-5">
            <div className="max-w-[60%]">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                Hoy · {dayName}
              </span>
              <h2 className="mt-1 text-xl font-bold text-white drop-shadow">
                {restTitle}
              </h2>
              <p className="mt-1 text-sm text-white/60">{restSubtitle}</p>
            </div>
            <div className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm sm:hidden">
              <Moon className="h-5 w-5 text-brand-500" />
            </div>
          </div>
        </div>
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
