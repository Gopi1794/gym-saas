"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveAchievement } from "@/app/actions/achievements";
import type { AchievementInput, ConditionType } from "@/lib/achievements/types";
import type { Achievement } from "@/types";

const MEDAL_OPTIONS = [
  { value: "/medallas/medalla_cardio.png", label: "Cardio" },
  { value: "/medallas/medalla_movilidad.png", label: "Movilidad" },
  { value: "/medallas/medalla_fuerza.png", label: "Fuerza" },
  { value: "/medallas/medalla_consistencia.png", label: "Consistencia" },
  { value: "/medallas/medalla_hierro.png", label: "Hierro" },
];

const CONDITION_LABELS: Record<ConditionType, string> = {
  total_sessions: "Sesiones totales",
  streak_days: "Racha de días",
  sessions_week: "Sesiones esta semana",
  total_xp: "XP total",
  sessions_category: "Sesiones por categoría",
  total_volume_kg: "Volumen total (kg levantados)",
  total_cardio_minutes: "Minutos de cardio acumulados",
};

const CONDITION_TARGET_OPTIONS = [
  { value: "strength", label: "Fuerza" },
  { value: "cardio", label: "Cardio" },
  { value: "hiit", label: "HIIT / Hierro" },
  { value: "flexibility", label: "Flexibilidad" },
  { value: "balance", label: "Balance" },
];

const NEEDS_TARGET: ConditionType[] = ["sessions_category"];

type Props = {
  mode: "create" | "edit";
  item?: Achievement;
  onSuccess: () => void;
};

export default function AchievementForm({ mode, item, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "");
  const [xpReward, setXpReward] = useState<string>(
    String(item?.xp_reward ?? 50),
  );
  const [conditionType, setConditionType] = useState<ConditionType>(
    item?.condition_type ?? "total_sessions",
  );
  const [conditionValue, setConditionValue] = useState<string>(
    String(item?.condition_value ?? 1),
  );
  const [conditionTarget, setConditionTarget] = useState<string>(
    (item as Achievement & { condition_target?: string })?.condition_target ?? "strength",
  );

  function handleXpChange(val: string) {
    setXpReward(val);
    const n = Number(val);
    if (n > 1000) {
      setClientError("xp_reward no puede superar 1000");
    } else {
      setClientError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const xpNum = Number(xpReward);
    if (xpNum > 1000) {
      setClientError("xp_reward no puede superar 1000");
      return;
    }
    setClientError(null);

    const values: AchievementInput = {
      ...(mode === "edit" && item ? { id: item.id } : {}),
      name,
      description: description || undefined,
      icon: icon || undefined,
      xp_reward: xpNum,
      condition_type: conditionType,
      condition_value: Number(conditionValue),
      condition_target: NEEDS_TARGET.includes(conditionType) ? conditionTarget : undefined,
    };

    startTransition(async () => {
      const result = await saveAchievement(values);
      if (result.ok) {
        onSuccess();
      } else {
        setServerError(result.error);
      }
    });
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-colors";
  const labelClass = "block text-xs font-medium text-zinc-400 mb-1";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-brand-700/20 bg-zinc-900/80 p-4 space-y-4"
    >
      <h3 className="font-heading text-sm tracking-widest text-brand-500">
        {mode === "create" ? "Nuevo logro" : "Editar logro"}
      </h3>

      {/* Name */}
      <div>
        <label className={labelClass}>Nombre *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Primera sesión"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descripción del logro"
          rows={2}
          className={inputClass}
        />
      </div>

      {/* Icon picker */}
      <div>
        <label className={labelClass}>Medalla (opcional)</label>
        <div className="flex flex-wrap gap-2">
          {MEDAL_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setIcon(icon === m.value ? "" : m.value)}
              className={[
                "flex flex-col items-center gap-1 rounded-xl border p-2 transition-all",
                icon === m.value
                  ? "border-brand-500 bg-brand-700/20 ring-1 ring-brand-500/50"
                  : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-500",
              ].join(" ")}
            >
              <Image
                src={m.value}
                alt={m.label}
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="text-[9px] text-zinc-400">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* XP Reward */}
      <div>
        <label className={labelClass}>Recompensa XP (1–1000) *</label>
        <input
          type="number"
          required
          min={1}
          max={1000}
          value={xpReward}
          onChange={(e) => handleXpChange(e.target.value)}
          className={inputClass}
        />
        {clientError && (
          <p className="mt-1 text-xs text-red-400">{clientError}</p>
        )}
      </div>

      {/* Condition type */}
      <div>
        <label className={labelClass}>Tipo de condición *</label>
        <select
          required
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value as ConditionType)}
          className={inputClass}
        >
          {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((ct) => (
            <option key={ct} value={ct}>
              {CONDITION_LABELS[ct]}
            </option>
          ))}
        </select>
      </div>

      {/* Condition target — only for sessions_category */}
      {NEEDS_TARGET.includes(conditionType) && (
        <div>
          <label className={labelClass}>Categoría *</label>
          <select
            required
            value={conditionTarget}
            onChange={(e) => setConditionTarget(e.target.value)}
            className={inputClass}
          >
            {CONDITION_TARGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Condition value */}
      <div>
        <label className={labelClass}>Valor de condición (≥ 1) *</label>
        <input
          type="number"
          required
          min={1}
          value={conditionValue}
          onChange={(e) => setConditionValue(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Server error */}
      {serverError && <p className="text-xs text-red-400">{serverError}</p>}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || !!clientError}
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? "Guardando…"
            : mode === "create"
              ? "Crear logro"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
