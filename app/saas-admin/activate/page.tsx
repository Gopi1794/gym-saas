"use client"

import { useState, useTransition } from "react"
import { activateGymManually } from "@/app/actions/saas-admin"
import { CheckCircle, AlertCircle, Zap } from "lucide-react"

export default function ActivateGymPage() {
  const [email, setEmail] = useState("")
  const [gymName, setGymName] = useState("")
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    startTransition(async () => {
      const res = await activateGymManually(email, gymName)
      if (res.ok) {
        setResult({ ok: true, message: `Gym "${res.gymName}" activado para ${res.email}` })
        setEmail("")
        setGymName("")
      } else {
        setResult({ ok: false, message: res.error })
      }
    })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Activación manual</h1>
            <p className="text-xs text-muted-foreground">Solo para uso del dueño del SaaS</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email del usuario
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trainer@email.com"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <p className="text-xs text-muted-foreground">El usuario ya debe haberse registrado en la app</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="gymName">
              Nombre del gym / negocio
            </label>
            <input
              id="gymName"
              type="text"
              required
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="Ej: Laura Personal Training"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? "Activando…" : "Activar gym"}
          </button>
        </form>

        {result && (
          <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
            result.ok
              ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400"
          }`}>
            {result.ok
              ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            }
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
