"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"
import { Turnstile } from "@marsidev/react-turnstile"
import type { TurnstileInstance } from "@marsidev/react-turnstile"

export default function ForgotPasswordForm() {
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!captchaToken) {
      setError("Completá la verificación de seguridad.")
      return
    }
    setLoading(true)
    setError(null)

    const redirectTo = `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken })

    if (error) {
      setError("No pudimos enviar el email. Verificá la dirección e intentá de nuevo.")
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-6 text-center dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-700/10 border border-brand-700/30">
          <MailCheck className="h-6 w-6 text-brand-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Revisá tu email</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Mandamos un link de recuperación a{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>.
            Expira en 1 hora.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-8 dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Recuperar acceso</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ingresá tu email y te mandamos un link para crear una nueva contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="assertive">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="vos@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>

        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          options={{ theme: "dark", language: "es" }}
        />

        <Button
          type="submit"
          className="w-full bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800 transition-colors font-semibold"
          disabled={loading || !email || !captchaToken}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</>
          ) : (
            "Enviar link de recuperación"
          )}
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al login
      </Link>
    </div>
  )
}
