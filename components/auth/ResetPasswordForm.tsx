"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"

export default function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setExchangeError("El link es inválido o ya fue usado. Pedí uno nuevo.")
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeError("El link expiró o ya fue usado. Pedí uno nuevo.")
      } else {
        setReady(true)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError("No se pudo actualizar la contraseña. Intentá de nuevo.")
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    setTimeout(() => router.push("/dashboard"), 2000)
  }

  if (exchangeError) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-6 text-center dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
        <Alert variant="error">{exchangeError}</Alert>
        <button
          onClick={() => router.push("/forgot-password")}
          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
        >
          Pedir un nuevo link →
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-6 text-center dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Contraseña actualizada</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Redirigiendo al dashboard…</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Verificando link…</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-8 dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Elegí una contraseña segura de al menos 8 caracteres.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="assertive">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              className="pr-10 bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Ocultar" : "Mostrar"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-zinc-700 dark:text-zinc-300">Confirmá la contraseña</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="Repetí la contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800 transition-colors font-semibold"
          disabled={loading || !password || !confirm}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</>
          ) : (
            "Guardar nueva contraseña"
          )}
        </Button>
      </form>
    </div>
  )
}
