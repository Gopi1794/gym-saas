import Link from "next/link"
import { Apple, ArrowRight } from "lucide-react"
import type { NutritionPlan } from "@/app/actions/nutrition"
import { calcPlanMacros } from "@/lib/nutrition"

interface Props {
  plan: NutritionPlan | null
  streak: number
}

function Ring({ value, target, color, trackColor }: { value: number; target: number | null; color: string; trackColor: string }) {
  const r = 20, cx = 24, cy = 24
  const circ = 2 * Math.PI * r
  const pct = target ? Math.min(value / target, 1) : 0
  const dash = circ * Math.max(0.02, pct)
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="4" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  )
}

export default function NutritionSummaryCard({ plan, streak }: Props) {
  if (!plan) {
    return (
      <Link href="/nutricion" className="block">
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-zinc-700 px-4 py-3.5">
          <Apple className="h-5 w-5 shrink-0 text-zinc-600" />
          <p className="flex-1 text-sm text-zinc-500">Sin plan nutricional asignado</p>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
        </div>
      </Link>
    )
  }

  const meals = plan.nutrition_meals ?? []
  const t = calcPlanMacros(meals)

  return (
    <Link href="/nutricion" className="block active:scale-[0.99] transition-transform">
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Apple className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nutrición hoy</span>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-bold text-orange-400">🔥 {streak}</span>
            )}
            <ArrowRight className="h-4 w-4 text-zinc-400" />
          </div>
        </div>

        <div className="flex items-center justify-around">
          <div className="relative">
            <Ring value={t.calories} target={plan.target_calories} color="#FF2222" trackColor="#27272a" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black leading-none text-brand-400">{Math.round(t.calories)}</span>
              <span className="text-[8px] text-zinc-500">kcal</span>
            </div>
          </div>
          <div className="relative">
            <Ring value={t.protein} target={plan.target_protein} color="#60a5fa" trackColor="#27272a" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black leading-none text-blue-400">{Math.round(t.protein)}</span>
              <span className="text-[8px] text-zinc-500">prot</span>
            </div>
          </div>
          <div className="relative">
            <Ring value={t.carbs} target={plan.target_carbs} color="#fbbf24" trackColor="#27272a" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black leading-none text-amber-400">{Math.round(t.carbs)}</span>
              <span className="text-[8px] text-zinc-500">carbs</span>
            </div>
          </div>
          <div className="relative">
            <Ring value={t.fat} target={plan.target_fat} color="#34d399" trackColor="#27272a" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black leading-none text-emerald-400">{Math.round(t.fat)}</span>
              <span className="text-[8px] text-zinc-500">grasas</span>
            </div>
          </div>
        </div>

        {plan.target_calories && (
          <p className="mt-3 text-center text-xs text-zinc-500">
            <span className="font-bold text-zinc-900 dark:text-zinc-50">{Math.max(0, Math.round(plan.target_calories - t.calories))}</span> kcal restantes hoy
          </p>
        )}
      </div>
    </Link>
  )
}
