"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GymFlowLogo } from "@/components/ui/GymFlowLogo";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import {
  Camera,
  Edit3,
  Loader2,
  CreditCard,
  Hash,
  Dumbbell,
  Heart,
  Activity,
  Zap,
  Star,
  Target,
  Calendar,
  X,
  Lock,
} from "lucide-react";
import AchievementBadge from "@/components/achievements/AchievementBadge";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

interface ProfileViewProps {
  profile: Profile;
  email: string;
  totalCheckIns: number;
  totalFavorites: number;
  totalPlans: number;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  trainer: "Entrenador",
  member: "Miembro",
};

const MEMBERSHIP_LABEL: Record<string, string> = {
  basic: "BASIC FLOW",
  premium: "PREMIUM FLOW",
  vip: "VIP FLOW",
};

const TRAINING_TYPES: Record<
  string,
  { Icon: React.ElementType; label: string }[]
> = {
  basic: [
    { Icon: Dumbbell, label: "Fuerza" },
    { Icon: Activity, label: "Cardio" },
  ],
  premium: [
    { Icon: Dumbbell, label: "Fuerza" },
    { Icon: Zap, label: "HIIT" },
    { Icon: Activity, label: "Cardio" },
  ],
  vip: [
    { Icon: Dumbbell, label: "Fuerza" },
    { Icon: Zap, label: "HIIT" },
    { Icon: Heart, label: "Resistencia" },
  ],
};

type Medal = {
  id: string;
  label: string;
  glow: string;
  required: number;
  image: string;
  condition: string;
  description: string;
};
const MEDALS: Medal[] = [
  {
    id: "hierro",
    label: "Hierro",
    glow: "shadow-amber-500/60",
    required: 0,
    image: "/medallas/medalla_hierro.png",
    condition: "Medalla inicial",
    description:
      "Tu primera marca dentro de GymFlow. Arrancaste el camino, ahora toca sostenerlo.",
  },
  {
    id: "cardio",
    label: "Cardio",
    glow: "shadow-rose-500/60",
    required: 5,
    image: "/medallas/medalla_cardio.png",
    condition: "5 asistencias",
    description:
      "Primer bloque de constancia. No es magia: es repetición, presencia y entrenamiento real.",
  },
  {
    id: "movilidad",
    label: "Movilidad",
    glow: "shadow-emerald-500/60",
    required: 15,
    image: "/medallas/medalla_movilidad.png",
    condition: "15 asistencias",
    description:
      "Ya no estás probando: estás construyendo hábito. La movilidad también es progreso.",
  },
  {
    id: "fuerza",
    label: "Fuerza",
    glow: "shadow-brand-500/60",
    required: 30,
    image: "/medallas/medalla_fuerza.png",
    condition: "30 asistencias",
    description:
      "Fuerza no es solo peso. Es disciplina repetida hasta que el cuerpo aprende.",
  },
  {
    id: "constancia",
    label: "Constancia",
    glow: "shadow-brand-700/60",
    required: 50,
    image: "/medallas/medalla_consistencia.png",
    condition: "50 asistencias",
    description:
      "La medalla que importa: aparecer incluso cuando no tenés ganas. Ahí se separa el impulso del compromiso.",
  },
];

function computeLevel(checkIns: number) {
  return { level: Math.floor(checkIns / 5) + 1, xpInLevel: checkIns % 5 };
}

function generateId(createdAt: string, id: string) {
  const year = new Date(createdAt).getFullYear();
  const short = id.replace(/-/g, "").slice(0, 3).toUpperCase();
  return `GF-${year}-${short}`;
}

export default function ProfileView({
  profile,
  email,
  totalCheckIns,
  totalFavorites,
  totalPlans,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedMedal, setSelectedMedal] = useState<Medal | null>(null);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(
    (profile.gender as "male" | "female" | "other" | null) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const { level, xpInLevel } = computeLevel(totalCheckIns);
  const cardId = generateId(profile.created_at, profile.id);
  const membership = profile.membership_type ?? "basic";
  const training = TRAINING_TYPES[membership] ?? TRAINING_TYPES.basic;
  const memberSince = new Date(profile.created_at).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const nextMedal = MEDALS.find(
    (m) => m.required > 0 && totalCheckIns < m.required,
  );
  const nextObjective = nextMedal
    ? `${nextMedal.label} Avanzada`
    : "Leyenda del Gym";

  async function handleSave() {
    setLoading(true);
    await supabase
      .from("profiles")
      .update({ full_name: fullName, gender } as never)
      .eq("id", profile.id);
    setLoading(false);
    setEditing(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${profile.id}/avatar.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("avatar")
      .upload(path, file, { upsert: true });
    if (storageError) {
      console.error("[avatar] storage:", storageError);
      alert(`Error al subir imagen: ${storageError.message}`);
      setAvatarUploading(false);
      e.target.value = "";
      return;
    }

    const { data } = supabase.storage.from("avatar").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: url } as never)
      .eq("id", profile.id);
    if (dbError) {
      console.error("[avatar] db:", dbError);
      alert(`Error al guardar en perfil: ${dbError.message}`);
    } else {
      setAvatarUrl(url);
    }
    setAvatarUploading(false);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />
        {/* Radar animation — top left */}
        <div className="pointer-events-none absolute -top-2 -left-2 z-0">
          <svg width="540" height="390" viewBox="0 0 180 130" fill="none">
            <circle cx="30" cy="30" r="28" stroke="rgba(213,0,0,0.09)" strokeWidth="1.5" />
            <circle cx="30" cy="30" r="56" stroke="rgba(213,0,0,0.06)" strokeWidth="1.5" />
            <circle cx="30" cy="30" r="86" stroke="rgba(213,0,0,0.04)" strokeWidth="1" />
            <line x1="30" y1="4"  x2="30" y2="56" stroke="rgba(213,0,0,0.06)" strokeWidth="1" />
            <line x1="4"  y1="30" x2="56" y2="30" stroke="rgba(213,0,0,0.06)" strokeWidth="1" />
            <circle cx="30" cy="30" r="4" fill="rgba(213,0,0,0.30)" />
            <circle cx="30" cy="30" r="22" stroke="rgba(213,0,0,0.25)" strokeWidth="1.5" fill="none"
              className="animate-ring-ping [transform-box:fill-box] [transform-origin:center]" />
            <circle cx="30" cy="30" r="22" stroke="rgba(213,0,0,0.25)" strokeWidth="1.5" fill="none"
              className="animate-ring-ping [animation-delay:1.25s] [transform-box:fill-box] [transform-origin:center]" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/70 to-transparent" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-4 sm:gap-5">
                <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-800 p-[2px] shadow-[0_18px_50px_rgba(213,0,0,0.28)]">
                    <div className="h-full w-full overflow-hidden rounded-[1.35rem] bg-zinc-900">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-950 to-zinc-900 text-3xl font-black text-white">
                          {getInitials(profile.full_name)}
                        </div>
                      )}
                    </div>
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/95 text-brand-400 shadow-lg shadow-black/30 backdrop-blur transition-[transform,background-color,border-color] duration-150 hover:border-brand-500/50 hover:bg-brand-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Cambiar foto de perfil"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 pt-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-300">
                      Nivel {level}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-zinc-300">
                      {ROLE_LABEL[profile.role ?? "member"]}
                    </span>
                  </div>
                  <h2 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {profile.full_name ?? "Sin nombre"}
                  </h2>
                  <p className="mt-2 truncate text-sm text-zinc-400">{email}</p>

                  <div className="mt-5 max-w-md">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Progreso XP
                      </span>
                      <span className="font-bold text-brand-300">
                        {xpInLevel}/5 asistencias
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-700 via-brand-500 to-red-400 shadow-[0_0_18px_rgba(213,0,0,0.55)]"
                        style={{ width: `${(xpInLevel / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <Hash className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    ID miembro
                  </p>
                  <p className="font-mono text-sm font-semibold text-zinc-100">
                    {cardId}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Asistencias", value: totalCheckIns, Icon: Activity },
                { label: "Favoritos", value: totalFavorites, Icon: Heart },
                { label: "Planes", value: totalPlans, Icon: Star },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:bg-white/[0.055]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-400">{label}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700/15 text-brand-400">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black tabular-nums tracking-tight text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.15fr]">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900/45 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand-400" />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                    Membresía
                  </p>
                </div>
                <p className="text-lg font-black text-white">
                  {MEMBERSHIP_LABEL[membership]}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {training.map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300"
                    >
                      <Icon className="h-3.5 w-3.5 text-brand-400" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900/45 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-brand-400" />
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                      Próximo objetivo
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Desde {memberSince}
                  </span>
                </div>
                <p className="text-lg font-black text-white">{nextObjective}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {MEDALS.map((medal) => {
                    const earned = totalCheckIns >= medal.required;
                    const remaining = Math.max(
                      medal.required - totalCheckIns,
                      0,
                    );
                    return (
                      <button
                        key={medal.id}
                        type="button"
                        onClick={() => setSelectedMedal(medal)}
                        className={cn(
                          "group flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-[transform,background-color,border-color] duration-150 hover:-translate-y-0.5 active:scale-[0.98]",
                          earned
                            ? "border-white/10 bg-white/[0.04] text-zinc-200"
                            : "border-white/5 bg-white/[0.02] text-zinc-600 hover:text-zinc-400",
                        )}
                        aria-label={`Ver detalle de medalla ${medal.label}${earned ? "" : `. Faltan ${remaining} asistencias`}`}
                      >
                        <Image
                          src={medal.image}
                          alt={medal.label}
                          width={28}
                          height={28}
                          className={cn(
                            "object-contain transition-transform duration-150 group-hover:scale-105",
                            !earned && "grayscale opacity-35",
                          )}
                        />
                        <span className="text-xs font-semibold">
                          {medal.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="border-t border-zinc-200 dark:border-white/10 bg-zinc-950/55 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="mb-5 flex items-center justify-between">
              <GymFlowLogo size={18} textSize="text-base" />
              <button
                onClick={() => setShowInfo(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-black text-zinc-400 transition-[transform,color,border-color] duration-150 hover:border-brand-500/40 hover:text-brand-300 active:scale-95"
                aria-label="Información del sistema de XP"
              >
                !
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-center">
              <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <QRCodeSVG value={profile.qr_code} size={150} level="H" />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">
                Check-in rápido
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Escaneá este código al llegar al gym.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-400">
                <Calendar className="h-4 w-4 text-brand-400" />
                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  Miembro desde
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-100">
                {memberSince}
              </p>
            </div>
          </aside>
        </div>
      </div>
      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowInfo(false)}
          >
            {/* Scrim */}
            <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" />

            {/* Card */}
            <motion.div
              className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/8 bg-zinc-900 shadow-[0_0_80px_rgba(213,0,0,0.18)]"
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Circuit pattern overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23d50000' stroke-width='0.8'%3E%3Cpath d='M0 40h20M60 40h20M40 0v20M40 60v20M20 40h20v-20M60 40H40v20'/%3E%3Ccircle cx='20' cy='40' r='2' fill='%23d50000'/%3E%3Ccircle cx='60' cy='40' r='2' fill='%23d50000'/%3E%3Ccircle cx='40' cy='20' r='2' fill='%23d50000'/%3E%3Ccircle cx='40' cy='60' r='2' fill='%23d50000'/%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: "80px 80px",
                }}
              />
              {/* Corner accents */}
              <div className="pointer-events-none absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-brand-500/50 rounded-tl-2xl" />
              <div className="pointer-events-none absolute right-0 bottom-0 h-8 w-8 border-r-2 border-b-2 border-brand-700/40 rounded-br-2xl" />

              {/* Header */}
              <div className="relative flex items-center justify-between border-b border-white/5 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(213,0,0,0.9)]" />
                  <p className="font-heading text-xs tracking-[0.2em] text-brand-500">
                    SISTEMA DE XP Y MEDALLAS
                  </p>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-brand-500/40 hover:text-zinc-200 active:scale-95"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="relative p-5 space-y-5">
                {/* XP section */}
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    XP por sesión completada
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Sin saltar descansos", xp: 100, pct: 100 },
                      { label: "1 descanso salteado", xp: 85, pct: 85 },
                      { label: "2 salteados", xp: 70, pct: 70 },
                      { label: "3 salteados", xp: 55, pct: 55 },
                      { label: "4 o más salteados", xp: 50, pct: 50 },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 text-[11px] text-zinc-400">
                          {row.label}
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                              style={{ boxShadow: "0 0 6px rgba(213,0,0,0.6)" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.pct}%` }}
                              transition={{
                                delay: i * 0.06,
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                            />
                          </div>
                          <span className="font-heading text-xs text-brand-400 w-14 text-right">
                            {row.xp} XP
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5" />

                {/* Medals section */}
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Medallas y condiciones
                  </p>
                  <div className="space-y-2.5">
                    {[
                      {
                        img: "/medallas/medalla_fuerza.png",
                        name: "Fuerza",
                        condition: "10 sesiones de fuerza",
                      },
                      {
                        img: "/medallas/medalla_cardio.png",
                        name: "Cardio",
                        condition: "60 min de cardio",
                      },
                      {
                        img: "/medallas/medalla_hierro.png",
                        name: "Hierro",
                        condition: "1000 kg levantados",
                      },
                      {
                        img: "/medallas/medalla_movilidad.png",
                        name: "Movilidad",
                        condition: "5 sesiones flexibilidad",
                      },
                      {
                        img: "/medallas/medalla_consistencia.png",
                        name: "Consistencia",
                        condition: "Racha de 7 días",
                      },
                    ].map((row, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.1 + i * 0.05,
                          duration: 0.3,
                          ease: "easeOut",
                        }}
                      >
                        <Image
                          src={row.img}
                          alt={row.name}
                          width={28}
                          height={28}
                          className="object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200">
                            {row.name}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {row.condition}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <p className="text-center text-[10px] text-zinc-600">
                  El admin del gym puede ajustar estas condiciones.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medal detail modal */}
      {/* Medal detail modal */}
      <AnimatePresence>
        {selectedMedal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSelectedMedal(null)}
          >
            {/* BACKDROP */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            {/* PANEL */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{
                type: "spring",
                damping: 22,
                stiffness: 240,
              }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[420px]"
            >
              {/* OUTER RED GLOW */}
              <div className="absolute inset-0 rounded-[40px] bg-red-500/10 blur-3xl" />

              {/* MAIN CONTAINER */}
              <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-white shadow-[0_0_120px_rgba(255,0,0,0.18)] dark:bg-[#111111]">
                {/* TOP LIGHT */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

                {/* RED RADIAL */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.24),transparent_42%)]" />

                {/* INNER SHADOW */}
                <div className="pointer-events-none absolute inset-0 dark:shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />

                {/* SIDE LIGHTS */}
                <div className="absolute left-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_24px_rgba(255,0,0,0.9)]" />

                <div className="absolute right-0 top-1/2 h-32 w-[3px] -translate-y-1/2 bg-red-500 shadow-[0_0_24px_rgba(255,0,0,0.9)]" />

                {/* CLOSE */}
                <button
                  onClick={() => setSelectedMedal(null)}
                  className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#a1a1aa] backdrop-blur-md transition-all duration-150 hover:border-red-500/40 hover:text-[#ffffff] active:scale-95"
                  aria-label="Cerrar detalle de medalla"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* CONTENT */}
                <div className="relative z-10 flex flex-col items-center px-5 pb-6 pt-8 sm:px-8">
                  {/* MEDAL AREA */}
                  <div className="relative mb-5">
                    {/* ENERGY RING */}
                    <motion.div
                      animate={{
                        rotate: 360,
                      }}
                      transition={{
                        duration: 12,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-[-12px] rounded-full border border-red-500/20"
                    />

                    {/* ENERGY */}
                    <div className="absolute inset-[-24px] rounded-full bg-red-500/20 blur-3xl" />

                    {/* MEDAL */}
                    <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-[#3f3f46] dark:bg-gradient-to-b dark:from-[#27272a] dark:to-black dark:shadow-[inset_0_0_50px_rgba(255,255,255,0.05)]">
                      {/* INNER RED RING */}
                      <div className="absolute inset-3 rounded-full border border-red-500/30 shadow-[0_0_25px_rgba(255,0,0,0.45)]" />

                      {/* IMAGE */}
                      <Image
                        src={selectedMedal.image}
                        alt={selectedMedal.label}
                        width={110}
                        height={110}
                        className={cn(
                          "relative z-10 object-contain drop-shadow-[0_0_30px_rgba(255,0,0,0.35)]",
                          totalCheckIns < selectedMedal.required &&
                            "grayscale opacity-40",
                        )}
                      />

                      {/* LOCKED OVERLAY */}
                      {totalCheckIns < selectedMedal.required && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm">
                          <div className="rounded-full border border-white/10 bg-black/60 p-3">
                            <Lock className="h-6 w-6 text-[#d4d4d8]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STATUS */}
                  <div
                    className={cn(
                      "mb-4 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em]",
                      totalCheckIns >= selectedMedal.required
                        ? "border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_20px_rgba(255,0,0,0.2)]"
                        : "border-[#3f3f46] bg-[#27272a] text-[#a1a1aa]",
                    )}
                  >
                    {totalCheckIns >= selectedMedal.required
                      ? "DESBLOQUEADA"
                      : "BLOQUEADA"}
                  </div>

                  {/* TITLE */}
                  <h2 className="text-center text-3xl font-black tracking-tight text-[#ffffff]">
                    {selectedMedal.label}
                  </h2>

                  {/* CONDITION */}
                  <div className="mt-3 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-300">
                    {selectedMedal.condition}
                  </div>

                  {/* DESCRIPTION */}
                  <p className="mt-5 max-w-xs text-center text-sm leading-relaxed text-[#a1a1aa]">
                    {selectedMedal.description}
                  </p>

                  {/* PROGRESS */}
                  <div className="mt-6 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/30">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#71717a]">
                          Progreso
                        </p>

                        <p className="mt-0.5 text-xs text-[#71717a]">
                          Asistencias completadas
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-black tracking-tight text-[#ffffff]">
                          {Math.min(totalCheckIns, selectedMedal.required)}/
                          {selectedMedal.required}
                        </p>
                      </div>
                    </div>

                    {/* BAR */}
                    <div className="relative h-5 overflow-hidden rounded-full border border-red-500/20 bg-[#18181b]">
                      {/* BG GLOW */}
                      <div className="absolute inset-0 bg-red-500/10 blur-md" />

                      {/* FILL */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            (totalCheckIns / selectedMedal.required) * 100,
                            100,
                          )}%`,
                        }}
                        transition={{
                          duration: 1,
                        }}
                        className="relative h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-300 shadow-[0_0_35px_rgba(255,0,0,0.9)]"
                      >
                        {/* ELECTRIC SWEEP */}
                        <motion.div
                          animate={{
                            x: ["-100%", "220%"],
                          }}
                          transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute inset-0 w-1/3 skew-x-[-18deg] bg-white/20 blur-sm"
                        />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit name */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-200">Editar nombre</p>
          <button
            onClick={() => setEditing(!editing)}
            className="text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full"
              placeholder="Tu nombre completo"
            />
            <div className="grid grid-cols-3 gap-2">
              {(["male", "female", "other"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? null : g)}
                  className={[
                    "rounded-xl border py-2 text-xs font-semibold transition-all",
                    gender === g
                      ? "border-brand-500 bg-brand-700/20 text-brand-400"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500",
                  ].join(" ")}
                >
                  {g === "male" ? "Hombre" : g === "female" ? "Mujer" : "Otro"}
                </button>
              ))}
            </div>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-brand-700 text-white hover:bg-brand-800"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            {profile.full_name ?? "Sin nombre"} · {email}
          </p>
        )}
      </div>
    </div>
  );
}
