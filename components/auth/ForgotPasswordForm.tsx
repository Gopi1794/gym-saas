"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react"
import { Turnstile } from "@marsidev/react-turnstile"
import type { TurnstileInstance } from "@marsidev/react-turnstile"
import { useResendCooldown, buildResendCooldownKey, armResendCooldown } from "@/hooks/use-resend-cooldown"

type FlowState = { otpStep: boolean; confirmedEmail: string }

const FLOW_STORAGE_KEY = "forgot-password-flow"
const DEFAULT_FLOW: FlowState = { otpStep: false, confirmedEmail: "" }

const RESEND_MESSAGE = "Si el email está registrado, te reenviamos el código."
const RESEND_RETRY_MESSAGE = "No pudimos verificar la solicitud. Intentá de nuevo."
const RESEND_TIMEOUT_MS = 15_000

function readPersistedFlow(): FlowState {
  try {
    const raw = window.sessionStorage.getItem(FLOW_STORAGE_KEY)
    if (!raw) return DEFAULT_FLOW
    const parsed = JSON.parse(raw)
    if (typeof parsed?.otpStep === "boolean" && typeof parsed?.confirmedEmail === "string") {
      return parsed
    }
    return DEFAULT_FLOW
  } catch {
    return DEFAULT_FLOW
  }
}

function persistFlow(flow: FlowState): void {
  try {
    window.sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow))
  } catch {
    // sessionStorage puede fallar en modo privado; el paso sigue funcionando en memoria
  }
}

function clearPersistedFlow(): void {
  try {
    window.sessionStorage.removeItem(FLOW_STORAGE_KEY)
  } catch {
    // no-op
  }
}

export default function ForgotPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  const [flow, setFlow] = useState<FlowState>(DEFAULT_FLOW)
  const { otpStep, confirmedEmail } = flow
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [resendState, setResendState] = useState<"idle" | "pending">("idle")
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const resendTurnstileRef = useRef<TurnstileInstance>(null)
  const resendPendingRef = useRef(false)
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cooldownKey = buildResendCooldownKey(confirmedEmail)
  const { remainingSeconds, isReady, start } = useResendCooldown(cooldownKey)

  useEffect(() => {
    const persisted = readPersistedFlow()
    if (persisted.otpStep || persisted.confirmedEmail) {
      setFlow(persisted)
    }
  }, [])

  useEffect(() => {
    return () => clearResendWatchdog()
  }, [])

  function clearResendWatchdog() {
    if (resendTimeoutRef.current) {
      clearTimeout(resendTimeoutRef.current)
      resendTimeoutRef.current = null
    }
  }

  function failResend() {
    resendPendingRef.current = false
    clearResendWatchdog()
    setResendState("idle")
    setResendMessage(RESEND_RETRY_MESSAGE)
  }

  async function sendResetEmail(token: string) {
    try {
      await supabase.auth.resetPasswordForEmail(confirmedEmail, { captchaToken: token })
    } finally {
      clearResendWatchdog()
      resendTurnstileRef.current?.reset()
      start()
      setResendMessage(RESEND_MESSAGE)
      setResendState("idle")
      resendPendingRef.current = false
    }
  }

  function handleResendClick() {
    if (!isReady || resendPendingRef.current) return
    if (!resendTurnstileRef.current) {
      setResendMessage(RESEND_RETRY_MESSAGE)
      return
    }
    resendPendingRef.current = true
    setResendState("pending")
    setResendMessage(null)
    resendTurnstileRef.current.execute()
    resendTimeoutRef.current = setTimeout(failResend, RESEND_TIMEOUT_MS)
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    if (!captchaToken) {
      setError("Completá la verificación de seguridad.")
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken })

    if (error) {
      setError("No pudimos enviar el email. Verificá la dirección e intentá de nuevo.")
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      setLoading(false)
      return
    }

    setLoading(false)

    const key = buildResendCooldownKey(email)
    armResendCooldown(key)
    const nextFlow: FlowState = { otpStep: true, confirmedEmail: email }
    setFlow(nextFlow)
    persistFlow(nextFlow)
  }

  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) {
      setError("Ingresá el código de 6 dígitos")
      return
    }
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

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: confirmedEmail,
      token: otp,
      type: "recovery",
    })

    if (verifyError) {
      setError("Código incorrecto o expirado. Pedí uno nuevo.")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError("No se pudo actualizar la contraseña. Intentá de nuevo.")
      setLoading(false)
      return
    }

    setLoading(false)
    clearPersistedFlow()
    setDone(true)
    setTimeout(() => router.push("/dashboard"), 1800)
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

  if (otpStep) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-8 dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Verificá el código</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Mandamos un código de 6 dígitos a{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{confirmedEmail}</span>.
            Expira en 10 minutos.
          </p>
        </div>

        <form onSubmit={handleVerifyAndReset} className="space-y-4">
          {error && (
            <div role="alert" aria-live="assertive">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="otp" className="text-zinc-700 dark:text-zinc-300">Código de 6 dígitos</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em] bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-zinc-700 dark:text-zinc-300">Confirmá la contraseña</Label>
            <Input
              id="confirm"
              type="password"
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
            disabled={loading || otp.length !== 6 || !password || !confirm}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</>
            ) : (
              "Verificar y guardar"
            )}
          </Button>
        </form>

        <Turnstile
          ref={resendTurnstileRef}
          id="forgot-password-resend-turnstile"
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          options={{ size: "invisible", execution: "execute" }}
          onSuccess={(token) => {
            if (!resendPendingRef.current) return
            clearResendWatchdog()
            sendResetEmail(token)
          }}
          onError={failResend}
        />

        <div className="space-y-2 text-center text-sm">
          {resendMessage && (
            <Alert variant={resendMessage === RESEND_RETRY_MESSAGE ? "warning" : "info"}>
              {resendMessage}
            </Alert>
          )}

          {resendState === "pending" ? (
            <span className="text-zinc-500 dark:text-zinc-400">Enviando…</span>
          ) : isReady ? (
            <button
              type="button"
              onClick={handleResendClick}
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            >
              Reenviar código
            </button>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">Reenviar en {remainingSeconds}s</span>
          )}
        </div>

        <button
          onClick={() => {
            const nextFlow: FlowState = { otpStep: false, confirmedEmail: "" }
            setFlow(nextFlow)
            persistFlow(nextFlow)
          }}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pedir otro código
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-[0_0_80px_rgba(213,0,0,0.08)] space-y-8 dark:border-white/10 dark:bg-zinc-900/70 dark:backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Recuperar acceso</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ingresá tu email y te mandamos un código de 6 dígitos para crear una nueva contraseña.
        </p>
      </div>

      <form onSubmit={handleRequestCode} className="space-y-4">
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
            "Enviar código"
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
