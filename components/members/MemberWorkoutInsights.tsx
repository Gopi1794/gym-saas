"use client"

import { useState } from "react"
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Loader2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  generateWorkoutInsights,
  type WorkoutAnalysis,
  type InsightSession,
  type InsightType,
} from "@/app/actions/workout-insights"

type Props = {
  sessions: InsightSession[]
  member: { goal: string | null; training_frequency: string | null }
}

const ICON: Record<InsightType, React.ReactNode> = {
  positive: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
  suggestion: <TrendingUp className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
}

const INSIGHT_CLS: Record<InsightType, string> = {
  positive: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40",
  warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40",
  suggestion: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40",
}

const EXERCISE_CLS: Record<InsightType, string> = {
  positive: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  suggestion: "text-blue-700 dark:text-blue-400",
}

export default function MemberWorkoutInsights({ sessions, member }: Props) {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateWorkoutInsights(sessions, member)
      setAnalysis(result)
    } catch {
      setError("No se pudo generar el análisis. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/10">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Análisis con IA</p>
              <p className="text-xs text-muted-foreground">
                Evaluá adherencia, progresión y recibí recomendaciones
              </p>
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-white transition-colors shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analizando…
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                Analizar
              </>
            )}
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-white dark:bg-zinc-950 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/10">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">Análisis IA</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <p className="text-sm text-foreground/80 leading-relaxed">{analysis.overall}</p>

      {analysis.insights.length > 0 && (
        <div className="space-y-2">
          {analysis.insights.map((insight, i) => (
            <div
              key={i}
              className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5", INSIGHT_CLS[insight.type])}
            >
              {ICON[insight.type]}
              <div className="min-w-0">
                {insight.exercise && (
                  <p className={cn("text-xs font-semibold mb-0.5 capitalize", EXERCISE_CLS[insight.type])}>
                    {insight.exercise}
                  </p>
                )}
                <p className="text-xs text-foreground/80 leading-relaxed">{insight.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
