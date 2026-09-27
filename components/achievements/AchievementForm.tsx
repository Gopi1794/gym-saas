"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Target } from "lucide-react";
import { saveAchievement } from "@/app/actions/achievements";
import {
  CATEGORY_OPTIONS,
  CONDITION_TYPES,
  CONDITION_TYPE_LABELS,
  CONDITION_UNITS,
  describeCondition,
} from "@/lib/achievements/describe";
import {
  MAX_STREAK_DAYS,
  MAX_XP_REWARD,
  MIN_XP_REWARD,
  validateAchievementInput,
} from "@/lib/achievements/validation";
import type { AchievementInput, ConditionType } from "@/lib/achievements/types";
import type { Achievement } from "@/types";
import { cn } from "@/lib/utils";
import AchievementMedal from "./AchievementMedal";

const MEDAL_OPTIONS = [
  { value: "/medallas/medalla_cardio.png", label: "Cardio" },
  { value: "/medallas/medalla_movilidad.png", label: "Movilidad" },
  { value: "/medallas/medalla_fuerza.png", label: "Fuerza" },
  { value: "/medallas/medalla_consistencia.png", label: "Consistencia" },
  { value: "/medallas/medalla_hierro.png", label: "Hierro" },
];

const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0].value;

type Props = {
  mode: "create" | "edit";
  item?: Achievement;
  onSuccess: () => void;
  onCancel: () => void;
};

const fieldClass =
  "block min-h-[44px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-base text-zinc-900 placeholder-zinc-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/40";
const labelClass =
  "mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400";
const helperClass = "mt-1.5 text-xs text-zinc-500 dark:text-zinc-400";

export default function AchievementForm({
  mode,
  item,
  onSuccess,
  onCancel,
}: Props) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  // An unknown stored category is left empty on purpose: silently swapping it
  // for "Fuerza" would change what the achievement awards.
  const [conditionTarget, setConditionTarget] = useState<string>(() => {
    if (!item?.condition_target) return DEFAULT_CATEGORY;
    return CATEGORY_OPTIONS.some((o) => o.value === item.condition_target)
      ? item.condition_target
      : "";
  });

  // A stored icon the picker does not offer (an emoji, an older path) stays
  // selectable so editing the row does not silently drop it.
  const [customIcon] = useState(() =>
    item?.icon && !MEDAL_OPTIONS.some((m) => m.value === item.icon)
      ? item.icon
      : null,
  );

  const needsTarget = conditionType === "sessions_category";
  const isStreak = conditionType === "streak_days";

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    // Moves keyboard/screen-reader context to the form without opening the
    // on-screen keyboard the way focusing a field would.
    form.focus({ preventScroll: true });
  }, []);

  function buildValues(): AchievementInput {
    return {
      ...(mode === "edit" && item ? { id: item.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
      xp_reward: Number(xpReward),
      condition_type: conditionType,
      condition_value: Number(conditionValue),
      condition_target: needsTarget ? conditionTarget : undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const values = buildValues();

    const validationError = validateAchievementInput(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const result = await saveAchievement(values);
      if (result.ok) {
        onSuccess();
      } else {
        setError(result.error);
      }
    } catch {
      setError("No pudimos guardar el logro. Probá de nuevo en unos segundos.");
    } finally {
      setSaving(false);
    }
  }

  const liveValue = Number(conditionValue);
  const showSentence =
    conditionValue.trim() !== "" &&
    Number.isInteger(liveValue) &&
    liveValue >= 1 &&
    (!needsTarget || conditionTarget !== "");

  // Flag out-of-range numbers while typing, not only after a failed submit.
  const streakTooLong = isStreak && liveValue > MAX_STREAK_DAYS;
  const xpNumber = Number(xpReward);
  const xpOutOfRange =
    xpReward.trim() === "" ||
    !Number.isInteger(xpNumber) ||
    xpNumber < MIN_XP_REWARD ||
    xpNumber > MAX_XP_REWARD;

  const id = (field: string) => `${uid}-${field}`;

  return (
    <form
      ref={formRef}
      tabIndex={-1}
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={id("title")}
      className="scroll-mt-2 space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm focus-visible:rounded-2xl focus-visible:outline-none sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
    >
      <h3
        id={id("title")}
        className="font-heading text-2xl font-normal tracking-wide text-zinc-900 dark:text-zinc-50"
      >
        {mode === "create" ? "Nuevo logro" : "Editar logro"}
      </h3>

      <div>
        <label htmlFor={id("name")} className={labelClass}>
          Nombre *
        </label>
        <input
          id={id("name")}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Primera sesión"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={id("description")} className={labelClass}>
          Descripción (opcional)
        </label>
        <textarea
          id={id("description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descripción del logro"
          rows={2}
          className={fieldClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Medalla (opcional)</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {[
            ...(customIcon ? [{ value: customIcon, label: "Actual" }] : []),
            ...MEDAL_OPTIONS,
          ].map((m) => {
            const selected = icon === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setIcon(selected ? "" : m.value)}
                className={cn(
                  "flex min-h-[44px] flex-col items-center gap-1 rounded-xl border p-2 transition-colors focus-visible:rounded-xl",
                  selected
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500/40 dark:bg-brand-700/20"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-zinc-500",
                )}
              >
                <AchievementMedal icon={m.value} size="md" tile={false} />
                <span
                  className={cn(
                    "text-[11px] font-medium leading-tight",
                    selected
                      ? "text-brand-700 dark:text-brand-300"
                      : "text-zinc-600 dark:text-zinc-400",
                  )}
                >
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Cómo se gana
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={needsTarget ? "sm:col-span-2" : undefined}>
            <label htmlFor={id("type")} className={labelClass}>
              Tipo de condición *
            </label>
            <select
              id={id("type")}
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as ConditionType)}
              className={fieldClass}
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {CONDITION_TYPE_LABELS[ct]}
                </option>
              ))}
            </select>
          </div>

          {needsTarget && (
            <div>
              <label htmlFor={id("target")} className={labelClass}>
                Categoría *
              </label>
              <select
                id={id("target")}
                value={conditionTarget}
                onChange={(e) => setConditionTarget(e.target.value)}
                className={fieldClass}
              >
                {conditionTarget === "" && (
                  <option value="" disabled>
                    Elegí una categoría
                  </option>
                )}
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={id("value")} className={labelClass}>
              Cantidad *
            </label>
            <div className="relative">
              <input
                id={id("value")}
                type="number"
                inputMode="numeric"
                min={1}
                max={isStreak ? MAX_STREAK_DAYS : undefined}
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                aria-describedby={isStreak ? id("value-help") : undefined}
                aria-invalid={streakTooLong || undefined}
                className={cn(fieldClass, "pr-20")}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                {CONDITION_UNITS[conditionType]}
              </span>
            </div>
            {isStreak && (
              <p id={id("value-help")} className={helperClass}>
                Máximo {MAX_STREAK_DAYS} días: es hasta donde se cuenta la racha.
              </p>
            )}
          </div>
        </div>

        {showSentence && (
          <p className="flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            <Target
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-500"
              aria-hidden="true"
            />
            <span>
              Se gana al:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {describeCondition({
                  condition_type: conditionType,
                  condition_value: liveValue,
                  condition_target: needsTarget ? conditionTarget : null,
                })}
              </span>
            </span>
          </p>
        )}
      </fieldset>

      <div className="sm:max-w-xs">
        <label htmlFor={id("xp")} className={labelClass}>
          Recompensa en XP *
        </label>
        <div className="relative">
          <input
            id={id("xp")}
            type="number"
            inputMode="numeric"
            min={MIN_XP_REWARD}
            max={MAX_XP_REWARD}
            value={xpReward}
            onChange={(e) => setXpReward(e.target.value)}
            aria-describedby={id("xp-help")}
            aria-invalid={xpOutOfRange || undefined}
            className={cn(fieldClass, "pr-12")}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            XP
          </span>
        </div>
        <p id={id("xp-help")} className={helperClass}>
          Entre {MIN_XP_REWARD} y {MAX_XP_REWARD} XP.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-xl border border-zinc-300 px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:rounded-xl dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Guardando…"
            : mode === "create"
              ? "Crear logro"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
