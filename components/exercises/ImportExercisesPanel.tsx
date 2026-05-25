"use client"
import { useState } from "react"
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importExercisesFromCSV, exportExercisesAsCSV, type ImportResult } from "@/app/actions/import-exercises"

export default function ImportExercisesPanel() {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleImport() {
    setImporting(true)
    setResult(null)
    try {
      const res = await importExercisesFromCSV()
      setResult(res)
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportExercisesAsCSV()
      if (!csv) return
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "exercises.csv"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Formato del CSV</p>
        <code className="block text-xs text-zinc-400 bg-zinc-950 rounded-lg px-3 py-2 whitespace-pre overflow-x-auto">
          external_id,name,description,category,difficulty,muscle_groups
        </code>
        <ul className="text-xs text-zinc-500 space-y-0.5">
          <li><span className="text-zinc-400">category</span>: strength · cardio · hiit · flexibility · balance</li>
          <li><span className="text-zinc-400">difficulty</span>: beginner · intermediate · advanced</li>
          <li><span className="text-zinc-400">muscle_groups</span>: separados por <code className="text-zinc-300">|</code> (ej. <code className="text-zinc-300">Cuádriceps|Glúteos</code>)</li>
          <li><span className="text-zinc-400">description</span>: entre comillas si tiene comas</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleImport} disabled={importing} className="bg-brand-700 hover:bg-brand-800 text-white">
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {importing ? "Importando…" : "Importar CSV"}
        </Button>
        <Button onClick={handleExport} disabled={exporting} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? "Exportando…" : "Exportar CSV"}
        </Button>
      </div>

      <p className="text-xs text-zinc-600">
        El archivo debe estar en <code className="text-zinc-500">data/exercises-from-routine.csv</code> en el servidor.
      </p>

      {result && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center gap-3">
            {result.errors.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-zinc-100">{result.upserted} de {result.total} filas importadas</p>
              {result.errors.length > 0 && (
                <p className="text-sm text-zinc-500">{result.errors.length} error{result.errors.length !== 1 ? "es" : ""}</p>
              )}
            </div>
          </div>
          {result.errors.length > 0 && (
            <ul className="space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-red-400 rounded bg-red-950/30 px-3 py-1.5">{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
