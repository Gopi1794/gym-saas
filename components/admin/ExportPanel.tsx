"use client"

import { useState } from "react"
import { Users, CreditCard, CalendarCheck, Download, Loader2 } from "lucide-react"

type ExportType = "socios" | "pagos" | "asistencia"

const EXPORTS: { type: ExportType; label: string; description: string; Icon: React.ElementType; color: string }[] = [
  {
    type: "socios",
    label: "Socios",
    description: "Nombre, membresía, vencimiento, teléfono, objetivo y condiciones médicas.",
    Icon: Users,
    color: "text-brand-500",
  },
  {
    type: "pagos",
    label: "Pagos",
    description: "Historial completo de pagos con monto, estado y miembro.",
    Icon: CreditCard,
    color: "text-emerald-500",
  },
  {
    type: "asistencia",
    label: "Asistencia",
    description: "Registros de entrada con fecha, hora, duración y método (QR / manual).",
    Icon: CalendarCheck,
    color: "text-blue-500",
  },
]

function ExportCard({
  type, label, description, Icon, color,
}: (typeof EXPORTS)[number]) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/export?type=${type}`)
      if (!res.ok) throw new Error("Error al generar el archivo")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1]
        ?? `${type}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail; could add toast here
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Download className="h-4 w-4" />}
        {loading ? "Generando…" : "Descargar CSV"}
      </button>
    </div>
  )
}

export default function ExportPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Exportá los datos de tu gimnasio en formato CSV, compatible con Excel y Google Sheets.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {EXPORTS.map(e => <ExportCard key={e.type} {...e} />)}
      </div>
    </div>
  )
}
