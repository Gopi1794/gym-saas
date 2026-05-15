"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import {
  Camera,
  Edit3,
  Loader2,
  Mail,
  CreditCard,
  Hash,
  User,
  Dumbbell,
  Heart,
  Activity,
  Zap,
  BarChart2,
  Star,
  Target,
  Calendar,
  X,
} from "lucide-react";
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
};
const MEDALS: Medal[] = [
  { id: "hierro",       label: "Hierro",       glow: "shadow-amber-500/60",  required: 0,  image: "/medallas/medalla_hierro.png" },
  { id: "cardio",       label: "Cardio",       glow: "shadow-rose-500/60",   required: 5,  image: "/medallas/medalla_cardio.png" },
  { id: "movilidad",    label: "Movilidad",    glow: "shadow-emerald-500/60",required: 15, image: "/medallas/medalla_movilidad.png" },
  { id: "fuerza",       label: "Fuerza",       glow: "shadow-brand-500/60",  required: 30, image: "/medallas/medalla_fuerza.png" },
  { id: "constancia",   label: "Constancia",   glow: "shadow-brand-700/60",  required: 50, image: "/medallas/medalla_consistencia.png" },
];

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function Sparkline({ color = "#d50000" }: { color?: string }) {
  const pts = [0.8, 0.3, 0.6, 0.2, 0.7, 0.4, 0.9]
    .map((v, i) => `${(i / 6) * 56},${20 - v * 18}`)
    .join(" ");
  return (
    <svg width="56" height="20" className="opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(
    (profile.gender as "male" | "female" | "other" | null) ?? null
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
    const ext = file.name.split(".").pop();
    const path = `${profile.id}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (storageError) {
      console.error("[avatar] storage:", storageError);
      alert(`Error al subir imagen: ${storageError.message}`);
      setAvatarUploading(false);
      e.target.value = "";
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
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
      {/* ══ TRAINER CARD ══ */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-700/30 bg-zinc-950 shadow-[0_0_60px_rgba(213,0,0,0.14),0_0_120px_rgba(255,34,34,0.08)]">
        {/* Circuit board pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23d50000' stroke-width='0.8'%3E%3Cpath d='M0 40h20M60 40h20M40 0v20M40 60v20M20 40h20v-20M60 40H40v20'/%3E%3Ccircle cx='20' cy='40' r='2' fill='%23d50000'/%3E%3Ccircle cx='60' cy='40' r='2' fill='%23d50000'/%3E%3Ccircle cx='40' cy='20' r='2' fill='%23d50000'/%3E%3Ccircle cx='40' cy='60' r='2' fill='%23d50000'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Logo watermark */}
        <div className="pointer-events-none absolute right-5 top-4 z-10" style={{ filter: "drop-shadow(0 0 8px rgba(213,0,0,0.7))" }}>
          <Image src="/logo-vector.png" alt="Flash Mega Gym" width={100} height={30} className="h-8 w-auto object-contain select-none" />
        </div>

        {/* Corner neon accents */}
        <div className="pointer-events-none absolute left-0 top-0 h-16 w-16 rounded-tl-2xl border-l-2 border-t-2 border-brand-500/60" />
        <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-tr-2xl border-r-2 border-t-2 border-brand-500/20" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 rounded-bl-2xl border-b-2 border-l-2 border-brand-700/60" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 rounded-br-2xl border-b-2 border-r-2 border-brand-700/20" />

        {/* ── GRID ── */}
        <div className="relative grid grid-cols-1 md:grid-cols-[220px_1fr_200px]">
          {/* LEFT: Identity */}
          <div className="flex flex-col items-center gap-4 border-r border-white/5 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-6">
            {/* Logo */}
            <div className="flex w-full items-center">
              <Image src="/logo-vector.png" alt="Flash Mega Gym" width={110} height={34} className="h-8 w-auto object-contain" />
            </div>

            {/* Hex avatar */}
            <div className="relative mt-2" style={{ width: 130, height: 130 }}>
              {/* Glow blob */}
              <div
                className="absolute inset-[-6px] blur-xl bg-gradient-to-br from-brand-500/50 to-brand-800/50"
                style={{ clipPath: HEX }}
              />
              {/* Gradient border */}
              <div
                className="absolute inset-[-2px] bg-gradient-to-br from-brand-400 to-brand-700"
                style={{ clipPath: HEX }}
              />
              {/* Photo */}
              <div
                className="absolute inset-0 overflow-hidden bg-zinc-800"
                style={{ clipPath: HEX }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-950/70 text-3xl font-black text-white">
                    {getInitials(profile.full_name)}
                  </div>
                )}
              </div>

              {/* Camera button */}
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
                className="absolute right-3 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-brand-700/40 bg-zinc-900/90 backdrop-blur-sm transition-all hover:border-brand-500 hover:bg-brand-950/60"
              >
                {avatarUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-brand-500" />
                ) : (
                  <Camera className="h-3 w-3 text-brand-500" />
                )}
              </button>
            </div>

            {/* Name & level */}
            <div className="text-center">
              <p className="text-lg font-black uppercase tracking-wide text-white">
                {profile.full_name ?? "—"}
              </p>
              <p className="text-xs font-semibold tracking-wider text-brand-500">
                Nivel {level} - {ROLE_LABEL[profile.role ?? "member"]}
              </p>
            </div>

            {/* XP bar (10 segments) */}
            <div className="w-full">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                XP
              </span>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 flex-1 rounded-sm",
                      i < xpInLevel * 2
                        ? "bg-brand-500 shadow-[0_0_4px_rgba(213,0,0,0.9)]"
                        : "bg-zinc-700/50",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Data + Medals */}
          <div className="flex flex-col border-r border-white/5">
            {/* Personal data + Training stats */}
            <div className="grid grid-cols-1 gap-0 border-b border-white/5 sm:grid-cols-2">
              {/* Personal data */}
              <div className="border-r border-white/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-brand-500" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-500">
                    Datos Personales
                  </p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { Icon: Mail, label: "Email", value: email },
                    {
                      Icon: CreditCard,
                      label: "Membresía",
                      value: MEMBERSHIP_LABEL[membership],
                    },
                    { Icon: Hash, label: "ID Único", value: cardId },
                    {
                      Icon: User,
                      label: "Rol",
                      value: ROLE_LABEL[profile.role ?? "member"],
                    },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600/60" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                          {label}:
                        </p>
                        <p className="truncate text-xs font-semibold text-zinc-200">
                          {value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Training stats */}
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-brand-500" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-500">
                    Estadísticas de Entrenamiento
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Tipos de Entrenamiento:
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {training.map(({ Icon, label }, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Icon className="h-3.5 w-3.5 text-brand-500" />
                          <span className="text-xs font-semibold text-zinc-200">
                            {label}
                          </span>
                          {i < training.length - 1 && (
                            <span className="text-zinc-600 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Próximo Objetivo:
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-brand-600" />
                      <p className="text-xs font-semibold text-zinc-200">
                        {nextObjective}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Inscrito Desde:
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-brand-600" />
                      <p className="text-xs font-semibold text-zinc-200">
                        {memberSince}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Medals */}
            <div className="p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-500">
                Medallas
              </p>
              <div className="flex items-start gap-3">
                {MEDALS.map((medal) => {
                  const earned = totalCheckIns >= medal.required;
                  return (
                    <div
                      key={medal.id}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                          earned
                            ? `border-white/30 shadow-lg ${medal.glow}`
                            : "border-zinc-700/40 bg-zinc-900/60 opacity-35 grayscale",
                        )}
                      >
                        <Image
                          src={medal.image}
                          alt={medal.label}
                          width={36}
                          height={36}
                          className="object-contain"
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wide",
                          earned ? "text-zinc-300" : "text-zinc-600",
                        )}
                      >
                        {medal.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Stats + QR */}
          <div className="flex flex-col bg-gradient-to-b from-zinc-900/60 to-zinc-950/80">
            {/* Stats */}
            <div className="border-b border-white/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart2 className="h-3.5 w-3.5 text-brand-500" />
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-500">
                  Estadísticas
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Asistencias:
                    </p>
                    <p className="text-2xl font-black tabular-nums leading-none text-white">
                      {totalCheckIns}
                    </p>
                  </div>
                  <Sparkline color="#d50000" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Favoritos:
                    </p>
                    <p className="text-2xl font-black tabular-nums leading-none text-white">
                      {totalFavorites}
                    </p>
                  </div>
                  <Sparkline color="#ff6464" />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Última semana
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Planes:
                    </p>
                    <p className="text-2xl font-black tabular-nums leading-none text-white">
                      {totalPlans}
                    </p>
                  </div>
                  <Star className="h-5 w-5 text-amber-400" />
                </div>
              </div>
            </div>

            {/* QR */}
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(213,0,0,0.9)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-500">
                  Check-in Rápido
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg border border-brand-700/30 bg-white p-2 shadow-[0_0_20px_rgba(213,0,0,0.25)]">
                  <QRCodeSVG value={profile.qr_code} size={110} level="H" />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-brand-600/60">
                  Escanear para check-in
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-brand-700/10 bg-zinc-950/80 px-6 py-2.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            © GYM FLASH 2026
          </span>
          <button
            onClick={() => setShowInfo(true)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-black text-zinc-400 transition-all hover:border-brand-500 hover:text-brand-400"
            aria-label="Información del sistema de XP"
          >
            !
          </button>
        </div>
      </div>

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
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
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/8 bg-zinc-900 shadow-[0_0_80px_rgba(213,0,0,0.18)]"
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
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
                      { label: "1 descanso salteado",  xp: 85,  pct: 85 },
                      { label: "2 salteados",           xp: 70,  pct: 70 },
                      { label: "3 salteados",           xp: 55,  pct: 55 },
                      { label: "4 o más salteados",     xp: 50,  pct: 50 },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 text-[11px] text-zinc-400">{row.label}</span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                              style={{ boxShadow: "0 0 6px rgba(213,0,0,0.6)" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.pct}%` }}
                              transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
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
                      { img: "/medallas/medalla_fuerza.png",       name: "Fuerza",       condition: "10 sesiones de fuerza" },
                      { img: "/medallas/medalla_cardio.png",        name: "Cardio",       condition: "60 min de cardio" },
                      { img: "/medallas/medalla_hierro.png",        name: "Hierro",       condition: "1000 kg levantados" },
                      { img: "/medallas/medalla_movilidad.png",     name: "Movilidad",    condition: "5 sesiones flexibilidad" },
                      { img: "/medallas/medalla_consistencia.png",  name: "Consistencia", condition: "Racha de 7 días" },
                    ].map((row, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                      >
                        <Image src={row.img} alt={row.name} width={28} height={28} className="object-contain shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200">{row.name}</p>
                          <p className="text-[10px] text-zinc-500">{row.condition}</p>
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


      {/* Edit name */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
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
