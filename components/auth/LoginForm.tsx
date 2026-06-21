"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Turnstile } from "@marsidev/react-turnstile"
import type { TurnstileInstance } from "@marsidev/react-turnstile"

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const emailRef = useRef<HTMLInputElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!captchaToken) {
      setError("Completá la verificación de seguridad.")
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })

    if (error) {
      setError(error.message)
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      setLoading(false)
      emailRef.current?.focus()
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-8 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[0_0_80px_rgba(213,0,0,0.10)] dark:backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Bienvenido</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Iniciá sesión en tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="assertive">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">
            Email
          </Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            placeholder="vos@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
              Contraseña
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-zinc-500 hover:text-brand-600 transition-colors dark:hover:text-brand-400"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10 bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 hover:text-zinc-700 transition-colors dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          options={{ theme: "auto", language: "es" }}
        />

        <Button
          type="submit"
          className="w-full bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800 transition-colors font-semibold"
          disabled={loading || !captchaToken}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ingresando…
            </>
          ) : (
            "Ingresar"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        ¿No tenés cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-brand-600 hover:text-brand-700 transition-colors dark:text-brand-400 dark:hover:text-brand-300"
        >
          Creá una
        </Link>
      </p>
    </div>
  )
}
