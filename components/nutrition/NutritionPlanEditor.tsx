"use client"

import { useState, useTransition } from "react"
import {
  Plus, Trash2, X, Search, Sun, Moon, Coffee, Utensils, Cake,
  Copy, Pencil, Check, Clock, Upload, RotateCcw, MoreVertical,
} from "lucide-react"
import { showToast } from "nextjs-toast-notify"
import {
  addMeal, updateMeal, deleteMeal,
  addMealItem, updateMealItem, deleteMealItem,
  updateNutritionPlan, createFood,
  addFoodFavorite, removeFoodFavorite,
} from "@/app/actions/nutrition"
import { searchUSDA } from "@/app/actions/usda"
import type { USDAResult } from "@/app/actions/usda"
import { calcMacros } from "@/lib/nutrition"
import type { NutritionPlan, Meal, MealItem, Food } from "@/app/actions/nutrition"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"

interface Props { plan: NutritionPlan; foods: Food[]; userId: string; initialFavorites: string[] }

// ── Goal labels ─────────────────────────────────────────────────
const GOAL_LABELS: Record<string, string> = {
  volumen: "Volumen", definicion: "Definición", mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición", rendimiento: "Rendimiento deportivo",
  perdida_moderada: "Pérdida moderada", otro: "Otro",
}

// ── Liquid orb colors per meal slot ────────────────────────────
const ORBS = ["#fbbf24", "#fb923c", "#60a5fa", "#f472b6", "#818cf8"]

// ── Macro icon SVG paths (viewBox 0 0 24 24, filled) ───────────
const MACRO_ICONS = {
  protein: "M3,7 L7,7 L7,17 L3,17 Z M7,11 L17,11 L17,13 L7,13 Z M17,7 L21,7 L21,17 L17,17 Z",
  carbs:   "M12,3 L20.5,8 L20.5,16 L12,21 L3.5,16 L3.5,8 Z",
  fat:     "M12,3 C8,7 4,12 4,16 C4,20 7.6,22 12,22 C16.4,22 20,20 20,16 C20,12 16,7 12,3 Z",
}

// ── Animated liquid orb (wave + particles + LED glow) ──────────
function LiquidOrb({ idx, dim = 32 }: { idx: number; dim?: number }) {
  const c = ORBS[idx % ORBS.length]
  const uid = `orb${idx}`
  const r = dim / 2

  // Wave path — 3 full periods wide for seamless loop
  const fy = dim * 0.62          // fill baseline (38% full)
  const amp = dim * 0.13         // wave amplitude
  const W = dim * 3
  let wavePath = `M0,${fy}`
  for (let i = 0; i < 6; i++) {
    const qx = i * (W / 6) + W / 12
    const qy = fy + (i % 2 === 0 ? -amp : amp)
    const ex = (i + 1) * (W / 6)
    wavePath += ` Q${qx},${qy} ${ex},${fy}`
  }
  wavePath += ` L${W},${dim} L0,${dim} Z`

  // Particles config
  const particles = [
    { cx: r * 0.65, startCy: r * 1.45, endCy: r * 0.4,  pr: dim * 0.045, dur: "2.8s", begin: "0s"   },
    { cx: r * 1.35, startCy: r * 1.65, endCy: r * 0.35, pr: dim * 0.035, dur: "3.3s", begin: "1.1s"  },
    { cx: r * 0.90, startCy: r * 1.75, endCy: r * 0.5,  pr: dim * 0.028, dur: "2.5s", begin: "0.6s"  },
    { cx: r * 1.15, startCy: r * 1.30, endCy: r * 0.25, pr: dim * 0.022, dur: "3.8s", begin: "1.8s"  },
  ]

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`${uid}cl`}>
          <circle cx={r} cy={r} r={r - 0.5} />
        </clipPath>
        {/* Soft glow filter for the ring */}
        <filter id={`${uid}gl`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Stronger outer halo */}
        <filter id={`${uid}ha`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* Dark tinted background */}
      <circle cx={r} cy={r} r={r} fill={`${c}18`} />

      {/* Wave + particles clipped to circle */}
      <g clipPath={`url(#${uid}cl)`}>
        {/* Animated wave */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0,0"
            to={`${-dim},0`}
            dur="2.8s"
            repeatCount="indefinite"
          />
          <path d={wavePath} fill={`${c}50`} />
        </g>
        {/* Second offset wave for depth */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${-dim * 0.5},0`}
            to={`${-dim * 1.5},0`}
            dur="3.5s"
            repeatCount="indefinite"
          />
          <path d={wavePath} fill={`${c}28`} />
        </g>

        {/* Floating particles */}
        {particles.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.startCy} r={p.pr} fill={c} opacity="0">
            <animate attributeName="cy"
              from={`${p.startCy}`} to={`${p.endCy}`}
              dur={p.dur} begin={p.begin} repeatCount="indefinite" />
            <animate attributeName="opacity"
              values="0;0.9;0.7;0" keyTimes="0;0.1;0.75;1"
              dur={p.dur} begin={p.begin} repeatCount="indefinite" />
            <animate attributeName="r"
              values={`${p.pr};${p.pr * 0.6};${p.pr * 0.3}`}
              keyTimes="0;0.7;1"
              dur={p.dur} begin={p.begin} repeatCount="indefinite" />
          </circle>
        ))}
      </g>

      {/* Outer halo (blurred ring behind — LED effect) */}
      <circle cx={r} cy={r} r={r - 1}
        fill="none" stroke={c} strokeWidth="3"
        filter={`url(#${uid}ha)`} opacity="0.55" />

      {/* Sharp glowing ring on top */}
      <circle cx={r} cy={r} r={r - 1}
        fill="none" stroke={c} strokeWidth="1.5"
        filter={`url(#${uid}gl)`} opacity="0.95" />
    </svg>
  )
}

// ── Macro ring with liquid fill + icon ─────────────────────────
function MacroRing({ label, value, target, unit, color, icon, uid }: {
  label: string; value: number; target: number | null; unit: string
  color: string; icon: keyof typeof MACRO_ICONS; uid: string
}) {
  const dim = 100, ringR = 40, cx = 50, cy = 50, sw = 8
  const circ = 2 * Math.PI * ringR
  const pct = target ? Math.min(value / target, 1) : 0
  const dash = circ * Math.max(0.02, pct)
  const liq = ringR - sw / 2 - 1
  const fy = cy + liq - Math.max(0.04, pct) * 2 * liq
  const amp = liq * 0.12
  const W = liq * 2 * 3

  let wp = `M${cx - liq},${fy}`
  for (let i = 0; i < 6; i++) {
    const segW = W / 6
    const qx = (cx - liq) + i * segW + segW / 2
    const qy = fy + (i % 2 === 0 ? -amp : amp)
    const ex = (cx - liq) + (i + 1) * segW
    wp += ` Q${qx},${qy} ${ex},${fy}`
  }
  wp += ` L${cx - liq + W},${cy + liq} L${cx - liq},${cy + liq} Z`

  const particles = [
    { px: cx - liq * 0.3, sy: cy + liq * 0.5, ey: cy - liq * 0.3, pr: 1.3, dur: "2.6s", begin: "0s"   },
    { px: cx + liq * 0.3, sy: cy + liq * 0.65, ey: cy - liq * 0.4, pr: 1.0, dur: "3.2s", begin: "0.9s" },
    { px: cx - liq * 0.1, sy: cy + liq * 0.75, ey: cy - liq * 0.2, pr: 0.8, dur: "2.4s", begin: "1.5s" },
  ]

  const iconScale = (liq * 0.65) / 12
  const it = cx - 12 * iconScale

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          <defs>
            <clipPath id={`${uid}cl`}><circle cx={cx} cy={cy} r={liq} /></clipPath>
            <filter id={`${uid}gl`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={`${uid}ha`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <circle cx={cx} cy={cy} r={liq} fill={`${color}12`} />

          <g clipPath={`url(#${uid}cl)`}>
            <g>
              <animateTransform attributeName="transform" type="translate"
                from="0,0" to={`${-(liq * 2)},0`} dur="3s" repeatCount="indefinite" />
              <path d={wp} fill={`${color}55`} />
            </g>
            <g>
              <animateTransform attributeName="transform" type="translate"
                from={`${-liq},0`} to={`${-(liq * 3)},0`} dur="4.2s" repeatCount="indefinite" />
              <path d={wp} fill={`${color}28`} />
            </g>
            {particles.map((p, i) => (
              <circle key={i} cx={p.px} cy={p.sy} r={p.pr} fill={color} opacity="0">
                <animate attributeName="cy" from={`${p.sy}`} to={`${p.ey}`} dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.9;0.6;0" keyTimes="0;0.1;0.75;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="r" values={`${p.pr};${p.pr * 0.5};0`} keyTimes="0;0.7;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
              </circle>
            ))}
          </g>

          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#27272a" strokeWidth={sw} className="stroke-zinc-200 dark:stroke-zinc-800" />
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
            strokeWidth={sw + 2} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}ha)`} opacity="0.4" />
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
            strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}gl)`} />

          <g transform={`translate(${it},${it}) scale(${iconScale})`} opacity="0.8">
            <path d={MACRO_ICONS[icon]} fill={color} />
          </g>
        </svg>
      </div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-2xl font-black leading-none" style={{ color }}>{Math.round(value)}</p>
        {target
          ? <p className="mt-0.5 text-xs text-zinc-500">/ {target} {unit}</p>
          : <p className="mt-0.5 text-xs text-zinc-500">{unit}</p>}
      </div>
    </div>
  )
}

function SlotIcon({ idx, dim = 32 }: { idx: number; dim?: number }) {
  const c = ORBS[idx % ORBS.length]
  return (
    <span className="shrink-0 rounded-full" style={{ width: dim, height: dim, display: "inline-block" }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle cx={dim / 2} cy={dim / 2} r={dim / 2} fill={`${c}22`} />
        <circle cx={dim / 2} cy={dim / 2} r={dim / 2 - 2} fill="none" stroke={`${c}66`} strokeWidth="1.5" />
        <circle cx={dim / 2} cy={dim / 2} r={dim / 5} fill={c} opacity="0.85" />
      </svg>
    </span>
  )
}

// ── Calorie ring with liquid fill ──────────────────────────────
function CalorieRing({ planned, target }: { planned: number; target: number | null }) {
  const ringR = 46, cx = 56, cy = 56, sw = 8
  const circ = 2 * Math.PI * ringR
  const pct = target ? Math.min(planned / target, 1) : 0
  const dash = circ * Math.max(0.02, pct)

  // Inner liquid area — radius inside the stroke
  const liq = ringR - sw / 2 - 1   // ~41px inner radius
  const dim = liq * 2               // inner diameter
  const W = dim * 3                 // wave path width (3 periods)

  // Water level: top of inner area at cy-liq, bottom at cy+liq
  const waterTop = cy - liq
  const waterH = dim
  const fy = waterTop + waterH * (1 - Math.max(0.04, pct))   // fill baseline
  const amp = liq * 0.1

  // Build wave path
  let wp = `M${cx - liq},${fy}`
  for (let i = 0; i < 6; i++) {
    const segW = W / 6
    const qx = (cx - liq) + i * segW + segW / 2
    const qy = fy + (i % 2 === 0 ? -amp : amp)
    const ex = (cx - liq) + (i + 1) * segW
    wp += ` Q${qx},${qy} ${ex},${fy}`
  }
  wp += ` L${cx - liq + W},${cy + liq} L${cx - liq},${cy + liq} Z`

  const particles = [
    { px: cx - liq * 0.3, startY: cy + liq * 0.5, endY: cy - liq * 0.3, pr: 1.8, dur: "2.6s", begin: "0s"   },
    { px: cx + liq * 0.35, startY: cy + liq * 0.7, endY: cy - liq * 0.4, pr: 1.4, dur: "3.1s", begin: "0.9s" },
    { px: cx - liq * 0.1, startY: cy + liq * 0.8, endY: cy - liq * 0.2, pr: 1.1, dur: "2.4s", begin: "1.5s" },
    { px: cx + liq * 0.15, startY: cy + liq * 0.4, endY: cy - liq * 0.5, pr: 1.6, dur: "3.6s", begin: "0.4s" },
  ]

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 112, height: 112 }}>
        <svg width={112} height={112} viewBox="0 0 112 112">
          <defs>
            <clipPath id="cal-liq-clip">
              <circle cx={cx} cy={cy} r={liq} />
            </clipPath>
            <filter id="cal-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="cal-halo" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* Inner dark bg */}
          <circle cx={cx} cy={cy} r={liq} fill="#D5000012" />

          {/* Liquid + particles clipped */}
          <g clipPath="url(#cal-liq-clip)">
            {/* Wave 1 */}
            <g>
              <animateTransform attributeName="transform" type="translate"
                from="0,0" to={`${-dim},0`} dur="3s" repeatCount="indefinite" />
              <path d={wp} fill="#D5000055" />
            </g>
            {/* Wave 2 (offset, softer) */}
            <g>
              <animateTransform attributeName="transform" type="translate"
                from={`${-dim * 0.5},0`} to={`${-dim * 1.5},0`} dur="4s" repeatCount="indefinite" />
              <path d={wp} fill="#D5000030" />
            </g>

            {/* Floating particles */}
            {particles.map((p, i) => (
              <circle key={i} cx={p.px} cy={p.startY} r={p.pr} fill="#ff4444" opacity="0">
                <animate attributeName="cy" from={`${p.startY}`} to={`${p.endY}`}
                  dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.9;0.7;0"
                  keyTimes="0;0.1;0.75;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
                <animate attributeName="r" values={`${p.pr};${p.pr * 0.5};0`}
                  keyTimes="0;0.7;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
              </circle>
            ))}
          </g>

          {/* Track ring */}
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#27272a" strokeWidth={sw} className="stroke-zinc-200 dark:stroke-zinc-800" />

          {/* LED halo behind progress ring */}
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#D50000"
            strokeWidth={sw + 2} strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
            filter="url(#cal-halo)" opacity="0.45" />

          {/* Progress ring */}
          <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#D50000"
            strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
            filter="url(#cal-glow)" />
        </svg>

        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black leading-none text-zinc-50">
            {target ? Math.round(pct * 100) : 0}%
          </span>
          <span className="mt-0.5 text-[9px] text-zinc-500">planificado</span>
        </div>
      </div>

      {/* Calorie text */}
      <div>
        <p className="leading-none">
          <span className="text-5xl font-black text-brand-500">{Math.round(planned)}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          / <span className="font-semibold text-zinc-200">{target ?? "—"} kcal</span>
        </p>
        <p className="mt-1 text-xs text-zinc-600">Meta diaria</p>
      </div>
    </div>
  )
}

// ── Slim macro bar ──────────────────────────────────────────────
function MacroBar({ label, value, target, unit, accent }: {
  label: string; value: number; target: number | null; unit: string; accent: string
}) {
  const pct = target ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-xs text-zinc-400 shrink-0">
          <span className={`font-bold ${accent}`}>{Math.round(value)}</span>
          {target ? ` / ${target} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full transition-all ${accent.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-right text-[10px] text-zinc-700">{Math.round(pct)}%</p>
    </div>
  )
}

// ── Meal detail (center column) ─────────────────────────────────
function MealDetail({ meal, mealIdx, items, foods, onDelete, onItemsChange }: {
  meal: Meal; mealIdx: number; items: MealItem[]; foods: Food[]
  onDelete: () => void
  onItemsChange: (items: MealItem[]) => void
}) {
  const [, startTransition] = useTransition()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(meal.name)
  const [timeLabel, setTimeLabel] = useState(meal.time_label ?? "")
  const [detailFood, setDetailFood] = useState<Food | null>(null)
  const macros = calcMacros(items)

  function handleRemove(id: string) {
    startTransition(async () => {
      await deleteMealItem(id)
      onItemsChange(items.filter(i => i.id !== id))
    })
  }

  function handleUpdateGrams(id: string, grams: number) {
    startTransition(async () => {
      await updateMealItem(id, grams)
      onItemsChange(items.map(i => i.id === id ? { ...i, quantity_grams: grams } : i))
    })
  }

  function handleSaveName() {
    startTransition(async () => {
      await updateMeal(meal.id, name, timeLabel)
      setEditingName(false)
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Meal header */}
      <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-4">
        <SlotIcon idx={mealIdx} />

        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input value={name} onChange={e => setName(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-semibold text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            <input value={timeLabel} onChange={e => setTimeLabel(e.target.value)} placeholder="08:00"
              className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50" />
            <button onClick={handleSaveName} className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-500 transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditingName(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="group flex flex-1 items-center gap-2 text-left">
            <span className="font-semibold text-zinc-50">{name}</span>
            {timeLabel && <span className="text-xs text-zinc-500">{timeLabel}</span>}
            <Pencil className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        <span className="shrink-0 text-sm font-bold text-zinc-400">
          · <span className="text-brand-400">{Math.round(macros.calories)}</span> kcal
        </span>

        <button onClick={onDelete}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Food table */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-sm text-zinc-600">
            Sin alimentos. Buscá uno en el panel derecho.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Alimento", "Cantidad", "Kcal", "Proteínas", "Carb.", "Grasas", ""].map((h, i) => (
                  <th key={i} className={`pb-2 text-xs font-semibold ${
                    h === "Proteínas" ? "text-blue-500/70" :
                    h === "Carb."     ? "text-amber-500/70" :
                    h === "Grasas"    ? "text-emerald-500/70" :
                    "text-zinc-500"
                  } ${i === 0 ? "w-[35%]" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const ratio = item.quantity_grams / 100
                const f = item.foods
                return (
                  <tr key={item.id} className="group border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 pr-3 w-40">
                      <button onClick={() => setDetailFood(f)} className="text-sm text-zinc-200 hover:text-brand-400 transition-colors text-left truncate block w-full">{f.name}</button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdateGrams(item.id, Math.max(5, item.quantity_grams - 5))}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors text-sm font-bold">−</button>
                        <span className="w-[52px] text-center text-sm text-zinc-300 tabular-nums">{item.quantity_grams} g</span>
                        <button onClick={() => handleUpdateGrams(item.id, item.quantity_grams + 5)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors text-sm font-bold">+</button>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-sm text-zinc-400 tabular-nums">{Math.round(f.calories * ratio)}</td>
                    <td className="py-2.5 pr-4 text-sm font-medium text-blue-400 tabular-nums">{Math.round(f.protein * ratio)} g</td>
                    <td className="py-2.5 pr-4 text-sm font-medium text-amber-400 tabular-nums">{Math.round(f.carbs * ratio)} g</td>
                    <td className="py-2.5 pr-4 text-sm font-medium text-emerald-400 tabular-nums">{Math.round(f.fat * ratio)} g</td>
                    <td className="py-2.5">
                      <button onClick={() => handleRemove(item.id)}
                        className="rounded-md p-1 text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-zinc-800 py-2 text-center text-xs text-zinc-600">
        + Buscá un alimento en el panel derecho y hacé clic en <span className="text-zinc-500 font-medium">Agregar</span>
      </div>

      {/* Food detail modal */}
      {detailFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-150" onClick={() => setDetailFood(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-2xl shadow-2xl ring-1 ring-inset ring-white/5 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-50">{detailFood.name}</h2>
                <p className="text-xs text-zinc-500">Valores por 100g</p>
              </div>
              <button onClick={() => setDetailFood(null)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Calorías", value: detailFood.calories, unit: "kcal", color: "text-brand-500" },
                  { label: "Proteínas", value: detailFood.protein, unit: "g", color: "text-blue-400" },
                  { label: "Carbos", value: detailFood.carbs, unit: "g", color: "text-amber-400" },
                  { label: "Grasas", value: detailFood.fat, unit: "g", color: "text-emerald-400" },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-center">
                    <p className={`text-lg font-black leading-none ${m.color}`}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{m.unit}</p>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nutrientes adicionales</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Fibra", value: detailFood.fiber, unit: "g" },
                    { label: "Sodio", value: detailFood.sodium, unit: "mg" },
                    { label: "Azúcares", value: detailFood.sugars, unit: "g" },
                    { label: "Grasa saturada", value: detailFood.saturated_fat, unit: "g" },
                    { label: "Potasio", value: detailFood.potassium, unit: "mg" },
                    { label: "Calcio", value: detailFood.calcium, unit: "mg" },
                    { label: "Magnesio", value: detailFood.magnesium, unit: "mg" },
                    { label: "Zinc", value: detailFood.zinc, unit: "mg" },
                    { label: "Hierro", value: detailFood.iron, unit: "mg" },
                    { label: "Vitamina B12", value: detailFood.vitamin_b12, unit: "µg" },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between rounded-lg px-3 py-1.5 odd:bg-zinc-800/40">
                      <span className="text-xs text-zinc-500">{n.label}</span>
                      <span className={`text-xs font-semibold ${n.value != null && n.value !== 0 ? "text-zinc-300" : "text-zinc-600"}`}>
                        {n.value != null && n.value !== 0 ? `${n.value}${n.unit}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {detailFood.household_unit && detailFood.grams_per_unit && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-2.5 text-sm">
                  <span className="text-zinc-500">Porción: </span>
                  <span className="font-semibold text-zinc-300">{detailFood.household_unit} = {detailFood.grams_per_unit}g</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────
export default function NutritionPlanEditor({ plan, foods, userId, initialFavorites }: Props) {
  const [, startTransition] = useTransition()
  const [meals, setMeals] = useState<Meal[]>(plan.nutrition_meals ?? [])
  const [isActive, setIsActive] = useState(plan.is_active)
  const [activeMealId, setActiveMealId] = useState<string | null>(meals[0]?.id ?? null)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [clearingPlan, setClearingPlan] = useState(false)

  // Per-meal item state (kept in sync with MealDetail via onItemsChange)
  const [mealItems, setMealItems] = useState<Record<string, MealItem[]>>(
    Object.fromEntries(meals.map(m => [m.id, m.nutrition_meal_items]))
  )

  // Right panel search state
  const [localFoods, setLocalFoods] = useState<Food[]>(foods)
  const [query, setQuery] = useState("")
  const [searchGrams, setSearchGrams] = useState(100)
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [searchTab, setSearchTab] = useState<"recientes" | "favoritos" | "mis">("recientes")
  const [addingFood, setAddingFood] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(initialFavorites))

  function toggleFavorite(foodId: string) {
    const isFav = favorites.has(foodId)
    setFavorites(prev => {
      const next = new Set(prev)
      isFav ? next.delete(foodId) : next.add(foodId)
      return next
    })
    startTransition(async () => {
      if (isFav) await removeFoodFavorite(userId, foodId)
      else await addFoodFavorite(userId, foodId)
    })
  }

  // Derived tab lists (no query active)
  const recentFoods: Food[] = (() => {
    const seen = new Set<string>()
    const result: Food[] = []
    for (const items of Object.values(mealItems)) {
      for (const item of [...items].reverse()) {
        if (!seen.has(item.food_id)) { seen.add(item.food_id); result.push(item.foods) }
      }
    }
    return result
  })()
  const favoriteFoods = localFoods.filter(f => favorites.has(f.id))
  const myFoods = localFoods.filter(f => f.gym_id !== null)

  // USDA import state
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [usdaQuery, setUsdaQuery] = useState("")
  const [usdaResults, setUsdaResults] = useState<USDAResult[]>([])
  const [usdaSearching, setUsdaSearching] = useState(false)
  const [usdaError, setUsdaError] = useState("")
  const [usdaImported, setUsdaImported] = useState<Set<number>>(new Set())

  function openUSDA() { setUsdaOpen(true); setUsdaQuery(""); setUsdaResults([]); setUsdaError(""); setUsdaImported(new Set()) }

  function handleUsdaSearch() {
    if (!usdaQuery.trim()) return
    setUsdaSearching(true); setUsdaError("")
    startTransition(async () => {
      try {
        const results = await searchUSDA(usdaQuery.trim())
        setUsdaResults(results)
        if (results.length === 0) setUsdaError("Sin resultados. Probá otro término.")
      } catch {
        setUsdaError("Error al conectar con USDA. Verificá la API key.")
      } finally { setUsdaSearching(false) }
    })
  }

  function handleUsdaImport(food: USDAResult) {
    startTransition(async () => {
      try {
        const created = await createFood(plan.gym_id, {
          name: food.name, calories: food.calories, protein: food.protein,
          carbs: food.carbs, fat: food.fat, fiber: food.fiber, sodium: food.sodium,
          household_unit: null, grams_per_unit: null,
          sugars: food.sugars, saturated_fat: food.saturated_fat,
          potassium: food.potassium, calcium: food.calcium, magnesium: food.magnesium,
          zinc: food.zinc, iron: food.iron, vitamin_b12: food.vitamin_b12,
        })
        setLocalFoods(prev => [...prev, created])
        setUsdaImported(prev => new Set([...prev, food.fdcId]))
        showToast.success(`${food.name} agregado`, { duration: 2000, position: "top-right" })
      } catch { showToast.error("Error al importar", { duration: 2000, position: "top-right" }) }
    })
  }

  const tabPool = searchTab === "recientes" ? recentFoods : searchTab === "favoritos" ? favoriteFoods : myFoods
  const filtered = query
    ? localFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : tabPool.slice(0, 10)
  const activeMeal = meals.find(m => m.id === activeMealId)
  const activeMealIdx = meals.findIndex(m => m.id === activeMealId)

  const allItems = Object.values(mealItems).flat()
  const totals = calcMacros(allItems)

  function handleAddMeal() {
    startTransition(async () => {
      const name = `Comida ${meals.length + 1}`
      const id = await addMeal(plan.id, name, "", meals.length)
      const m: Meal = { id, plan_id: plan.id, name, time_label: null, order_index: meals.length, nutrition_meal_items: [] }
      setMeals(prev => [...prev, m])
      setMealItems(prev => ({ ...prev, [id]: [] }))
      setActiveMealId(id)
    })
  }

  function confirmDeleteMeal() {
    if (!deletingMealId) return
    const id = deletingMealId
    setDeletingMealId(null)
    startTransition(async () => {
      try {
        await deleteMeal(id)
        const next = meals.filter(m => m.id !== id)
        setMeals(next)
        setMealItems(prev => { const p = { ...prev }; delete p[id]; return p })
        setActiveMealId(next[0]?.id ?? null)
        showToast.success("Comida eliminada", { duration: 3000, position: "top-right", transition: "bounceIn" })
      } catch {
        showToast.error("No se pudo eliminar", { duration: 4000, position: "top-right" })
      }
    })
  }

  function confirmClearPlan() {
    setClearingPlan(false)
    startTransition(async () => {
      try {
        await Promise.all(meals.map(m => deleteMeal(m.id)))
        setMeals([]); setMealItems({}); setActiveMealId(null)
        showToast.success("Plan limpiado", { duration: 3000, position: "top-right" })
      } catch {
        showToast.error("No se pudo limpiar el plan", { duration: 4000, position: "top-right" })
      }
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const next = !isActive
      await updateNutritionPlan(plan.id, { is_active: next })
      setIsActive(next)
    })
  }

  function handleDuplicateMeal() {
    if (!activeMeal) return
    const sourceItems = mealItems[activeMeal.id] ?? []
    startTransition(async () => {
      try {
        const newId = await addMeal(plan.id, `${activeMeal.name} (copia)`, activeMeal.time_label ?? "", meals.length)
        const copiedItems: MealItem[] = []
        for (const item of sourceItems) {
          const itemId = await addMealItem(newId, item.food_id, item.quantity_grams)
          copiedItems.push({ id: itemId, meal_id: newId, food_id: item.food_id, quantity_grams: item.quantity_grams, foods: item.foods })
        }
        const newMeal: Meal = { id: newId, plan_id: plan.id, name: `${activeMeal.name} (copia)`, time_label: activeMeal.time_label, order_index: meals.length, nutrition_meal_items: copiedItems }
        setMeals(prev => [...prev, newMeal])
        setMealItems(prev => ({ ...prev, [newId]: copiedItems }))
        setActiveMealId(newId)
        showToast.success("Comida duplicada", { duration: 2000, position: "top-right" })
      } catch {
        showToast.error("No se pudo duplicar la comida", { duration: 3000, position: "top-right" })
      }
    })
  }

  function handleAddFoodToMeal() {
    if (!selectedFood || !activeMealId) return
    const food = selectedFood
    const grams = searchGrams
    setAddingFood(true)
    startTransition(async () => {
      try {
        const id = await addMealItem(activeMealId, food.id, grams)
        const item: MealItem = { id, meal_id: activeMealId, food_id: food.id, quantity_grams: grams, foods: food }
        setMealItems(prev => ({ ...prev, [activeMealId]: [...(prev[activeMealId] ?? []), item] }))
        setSelectedFood(null); setQuery(""); setSearchGrams(100)
        showToast.success(`${food.name} agregado`, { duration: 2000, position: "top-right" })
      } catch {
        showToast.error("No se pudo agregar el alimento", { duration: 4000, position: "top-right" })
      } finally {
        setAddingFood(false)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Active badge + stats bar ───────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleToggleActive}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                       : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
            {isActive ? "Activo" : "Inactivo"}
          </button>
        </div>
        <div className="text-xs text-zinc-600">
          {GOAL_LABELS[plan.goal] ?? plan.goal}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:grid-cols-[auto_1fr_auto]">
        {/* Calorie ring */}
        <CalorieRing planned={totals.calories} target={plan.target_calories} />

        {/* Macro rings */}
        <div className="flex items-center justify-around gap-2 sm:px-4">
          <MacroRing label="Proteínas" value={totals.protein} target={plan.target_protein} unit="g" color="#60a5fa" icon="protein" uid="mr-prot" />
          <MacroRing label="Carbos"    value={totals.carbs}   target={plan.target_carbs}   unit="g" color="#fbbf24" icon="carbs"   uid="mr-carb" />
          <MacroRing label="Grasas"    value={totals.fat}     target={plan.target_fat}      unit="g" color="#34d399" icon="fat"     uid="mr-fat_" />
        </div>

        {/* Plan summary */}
        <div className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 min-w-[180px]">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resumen del plan</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-600 font-bold">·</span>
              <span>Planificado: <span className="font-bold text-zinc-200">{plan.target_calories ? `${plan.target_calories} kcal` : "Sin target"}</span></span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-600 font-bold">·</span>
              <span>Comidas: <span className="font-bold text-zinc-200">{meals.length}</span></span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-600 font-bold">·</span>
              <span>Objetivo: <span className="font-bold text-zinc-200">{GOAL_LABELS[plan.goal] ?? plan.goal}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Three-column layout ───────────────────────────── */}
      <div className="flex gap-3" style={{ minHeight: 500 }}>

        {/* Left — meal list */}
        <div className="flex w-52 shrink-0 flex-col">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Comidas</p>
          <div className="flex flex-col gap-1">
            {meals.map((meal, i) => {
              const kcal = Math.round(calcMacros(mealItems[meal.id] ?? []).calories)
              const active = meal.id === activeMealId
              return (
                <button
                  key={meal.id}
                  onClick={() => setActiveMealId(meal.id)}
                  className={`group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-zinc-800/80 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-brand-500" />
                  )}
                  <SlotIcon idx={i} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">{meal.name}</p>
                    <p className={`text-xs ${active ? "text-brand-400" : "text-zinc-600"}`}>{kcal} kcal</p>
                  </div>
                </button>
              )
            })}
          </div>
          <button
            onClick={handleAddMeal}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-800 py-2.5 text-xs font-medium text-zinc-600 hover:border-brand-500/40 hover:text-brand-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar comida
          </button>
        </div>

        {/* Center — selected meal */}
        <div className="flex flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-4 overflow-hidden">
          {activeMeal ? (
            <MealDetail
              key={activeMeal.id}
              meal={activeMeal}
              mealIdx={activeMealIdx}
              items={mealItems[activeMeal.id] ?? activeMeal.nutrition_meal_items}
              foods={localFoods}
              onDelete={() => setDeletingMealId(activeMeal.id)}
              onItemsChange={items => setMealItems(prev => ({ ...prev, [activeMeal.id]: items }))}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Utensils className="h-10 w-10 text-zinc-800" />
              <p className="text-sm text-zinc-600">Agregá una comida para comenzar</p>
              <button onClick={handleAddMeal} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors">
                + Agregar comida
              </button>
            </div>
          )}
        </div>

        {/* Right — search + actions + totals */}
        <div className="flex w-64 shrink-0 flex-col gap-3">

          {/* Search */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Buscar alimentos</p>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedFood(null) }}
                placeholder="Buscar alimento…"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            {/* Tabs */}
            <div className="mb-3 flex gap-1 rounded-lg bg-zinc-800 p-0.5">
              {(["recientes", "favoritos", "mis"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSearchTab(tab)}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold capitalize transition-colors ${
                    searchTab === tab ? "bg-zinc-700 text-zinc-50 shadow" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "recientes" ? "Recientes" : tab === "favoritos" ? "Favoritos" : "Mis alimentos"}
                </button>
              ))}
            </div>

            {/* Results */}
            {!selectedFood && (
              <>
                {filtered.length > 0 ? (
                  <ul className="mb-2 max-h-44 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800">
                    {filtered.map(f => (
                      <li key={f.id} className="group flex items-center">
                        <button
                          onClick={() => { setSelectedFood(f); setQuery(f.name) }}
                          className="flex flex-1 items-center justify-between px-3 py-2 text-sm hover:bg-zinc-700/60 transition-colors text-left min-w-0"
                        >
                          <span className="truncate text-zinc-200">{f.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-zinc-500">{f.calories} kcal</span>
                        </button>
                        <button
                          onClick={() => toggleFavorite(f.id)}
                          className="shrink-0 px-2 py-2 text-zinc-600 hover:text-amber-400 transition-colors"
                          title={favorites.has(f.id) ? "Quitar favorito" : "Agregar a favoritos"}
                        >
                          {favorites.has(f.id) ? "★" : "☆"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !query && (
                    <p className="py-4 text-center text-[11px] text-zinc-600">
                      {searchTab === "recientes" && "Agregá alimentos al plan para verlos acá"}
                      {searchTab === "favoritos" && "Marcá alimentos con ★ para guardarlos acá"}
                      {searchTab === "mis" && "Importá desde USDA para ver tus alimentos acá"}
                    </p>
                  )
                )}
              </>
            )}

            {selectedFood && (
              <div className="space-y-2">
                <div className="truncate rounded-lg bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-400">
                  {selectedFood.name}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} value={searchGrams}
                    onChange={e => setSearchGrams(parseInt(e.target.value) || 100)}
                    className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-center text-sm text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  <span className="text-xs text-zinc-500">g</span>
                  <button
                    onClick={handleAddFoodToMeal}
                    disabled={!activeMealId || addingFood}
                    className="flex-1 rounded-lg bg-brand-600 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
                  >
                    {addingFood ? "…" : "Agregar"}
                  </button>
                </div>
                {!activeMealId && (
                  <p className="text-xs text-zinc-600">Seleccioná una comida primero</p>
                )}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Acciones rápidas</p>
            <div className="space-y-1">
              <button onClick={handleAddMeal}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Plus className="h-4 w-4 shrink-0 text-zinc-500" /> Agregar comida
              </button>
              <button onClick={handleDuplicateMeal} disabled={!activeMeal}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors">
                <Copy className="h-4 w-4 shrink-0 text-zinc-500" /> Duplicar día
              </button>
              <button onClick={openUSDA}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Upload className="h-4 w-4 shrink-0 text-zinc-500" /> Importar alimentos
              </button>
              <button
                onClick={() => { if (meals.length > 0) setClearingPlan(true) }}
                disabled={meals.length === 0}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
                <Trash2 className="h-4 w-4 shrink-0" /> Limpiar plan
              </button>
            </div>
          </div>

          {/* Totales del día */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Totales del día</p>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-zinc-500">Calorías</span>
                <span className="text-sm">
                  <span className="font-bold text-brand-400">{Math.round(totals.calories)}</span>
                  {plan.target_calories && <span className="text-xs text-zinc-600"> / {plan.target_calories} kcal</span>}
                </span>
              </div>
              <MacroBar label="Proteínas"     value={totals.protein} target={plan.target_protein} unit="g" accent="text-blue-400" />
              <MacroBar label="Carbohidratos" value={totals.carbs}   target={plan.target_carbs}   unit="g" accent="text-amber-400" />
              <MacroBar label="Grasas"        value={totals.fat}     target={plan.target_fat}      unit="g" accent="text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Delete meal modal */}
      <Dialog open={!!deletingMealId} onOpenChange={open => { if (!open) setDeletingMealId(null) }}>
        <DialogContent className="sm:max-w-sm border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">¿Eliminar comida?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Se eliminan también todos los alimentos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeletingMealId(null)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors">Cancelar</button>
            <button onClick={confirmDeleteMeal} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors">Eliminar</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear plan modal */}
      <Dialog open={clearingPlan} onOpenChange={setClearingPlan}>
        <DialogContent className="sm:max-w-sm border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">¿Limpiar el plan?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Se eliminan todas las comidas y alimentos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setClearingPlan(false)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors">Cancelar</button>
            <button onClick={confirmClearPlan} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors">Limpiar</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* USDA Import Modal */}
      {usdaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setUsdaOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col max-h-[85vh] rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-50">Importar desde USDA</h2>
                <p className="text-xs text-zinc-500">Buscá en español — traducimos automáticamente</p>
              </div>
              <button onClick={() => setUsdaOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-50 transition-colors"><X className="h-4 w-4" /></button>
            </div>

            <div className="border-b border-zinc-800 px-6 py-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={usdaQuery}
                    onChange={e => setUsdaQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUsdaSearch()}
                    placeholder="pechuga de pollo, avena, salmón…"
                    autoFocus
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-4 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <button
                  onClick={handleUsdaSearch}
                  disabled={usdaSearching || !usdaQuery.trim()}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {usdaSearching ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {usdaError && <p className="text-center text-sm text-zinc-500 py-6">{usdaError}</p>}
              {!usdaError && usdaResults.length === 0 && !usdaSearching && (
                <p className="text-center text-sm text-zinc-500 py-10">Ingresá un alimento y presioná Buscar</p>
              )}
              <div className="space-y-2">
                {usdaResults.map(food => {
                  const done = usdaImported.has(food.fdcId)
                  return (
                    <div key={food.fdcId} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{food.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {food.calories} kcal · P {food.protein}g · C {food.carbs}g · G {food.fat}g
                        </p>
                      </div>
                      <button
                        onClick={() => !done && handleUsdaImport(food)}
                        disabled={done}
                        className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                          done ? "bg-zinc-700 text-zinc-500 cursor-default" : "bg-brand-600 text-white hover:bg-brand-500"
                        }`}
                      >
                        {done ? "Importado ✓" : "Importar"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
