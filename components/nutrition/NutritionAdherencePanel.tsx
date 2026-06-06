"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import type { AdherenceEntry } from "@/app/actions/nutrition-tracking"

const GOAL_LABELS: Record<string, string> = {
  volumen: "Volumen", definicion: "Definición", mantenimiento: "Mantenimiento",
  recomposicion: "Recomposición", rendimiento: "Rendimiento", perdida_moderada: "Pérdida moderada", otro: "Otro",
}

function statusFor(days: number, lastLog: string | null) {
  if (days === 0 || !lastLog) return { label: "Sin registros", color: "bg-zinc-800 text-zinc-500" }
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const isRecent = lastLog === today || lastLog === yesterday
  if (days >= 5 && isRecent) return { label: "Al día", color: "bg-emerald-500/15 text-emerald-400" }
  if (days >= 3) return { label: "Regular", color: "bg-amber-500/15 text-amber-400" }
  return { label: "Atrasado", color: "bg-red-500/15 text-red-400" }
}

function relativeDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Hoy"
  if (dateStr === yesterday) return "Ayer"
  const diff = Math.round((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000)
  return `Hace ${diff} días`
}

export default function NutritionAdherencePanel({ entries }: { entries: AdherenceEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <p className="text-sm text-zinc-500">No hay planes activos para mostrar adherencia</p>
      </div>
    )
  }

  const atDay = entries.filter(e => statusFor(e.days_logged, e.last_log).label === "Al día").length
  const total = entries.length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Al día", count: entries.filter(e => e.days_logged >= 5).length, color: "text-emerald-400" },
          { label: "Regular", count: entries.filter(e => e.days_logged >= 3 && e.days_logged < 5).length, color: "text-amber-400" },
          { label: "Atrasado", count: entries.filter(e => e.days_logged < 3).length, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Adherence progress */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-400">Adherencia global esta semana</p>
          <p className="text-xs text-zinc-500">{atDay}/{total} socios al día</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: total > 0 ? `${Math.round((atDay / total) * 100)}%` : "0%" }}
          />
        </div>
      </div>

      {/* Member list */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Socio</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Días registrados</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Último registro</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Estado</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-900">
            {entries.map(entry => {
              const status = statusFor(entry.days_logged, entry.last_log)
              return (
                <tr key={entry.plan_id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={entry.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-zinc-700 text-xs text-zinc-300">
                          {getInitials(entry.member_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{entry.member_name}</p>
                        <p className="text-xs text-zinc-500">{GOAL_LABELS[entry.goal] ?? entry.goal}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2.5 w-2.5 rounded-full ${i < entry.days_logged ? "bg-emerald-500" : "bg-zinc-700"}`}
                        />
                      ))}
                      <span className="ml-1 text-xs text-zinc-500">{entry.days_logged}/7</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-400">{relativeDate(entry.last_log)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/nutricion/${entry.plan_id}`}
                      className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Ver plan →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
