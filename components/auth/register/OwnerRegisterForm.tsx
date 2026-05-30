"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, User, Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import LottiePlayer from "@/components/ui/lottie-player"
import { cn } from "@/lib/utils"
import RegisterShell from "./RegisterShell"
import { inputCls, labelCls, FieldError } from "./shared"

type FormData = {
  fullName: string
  email: string
  password: string
  gymName: string
}

const INITIAL: FormData = { fullName: "", email: "", password: "", gymName: "" }

const STEPS = [
  { icon: User,      title: "Tu cuenta",   subtitle: "Creá tus credenciales" },
  { icon: Building2, title: "Tu gimnasio", subtitle: "Nombre de tu establecimiento" },
]

export default function OwnerRegisterForm() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyExists, setAlreadyExists] = useState(false)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (step === 0) {
      if (!data.fullName.trim()) errs.fullName = "El nombre es obligatorio"
      if (!data.email.includes("@")) errs.email = "Email inválido"
      if (data.password.length < 8) errs.password = "Mínimo 8 caracteres"
    }
    if (step === 1) {
      if (!data.gymName.trim()) errs.gymName = "El nombre del gimnasio es obligatorio"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function goNext() {
    if (!validate()) return
    setDir(1)
    setStep((s) => s + 1)
  }

  function goBack() {
    setDir(-1)
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    setServerError(null)

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          pending_gym_name: data.gymName,
        },
      },
    })

    if (error) {
      const isAlreadyRegistered =
        error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("already exists") ||
        error.status === 422
      if (isAlreadyRegistered) {
        setAlreadyExists(true)
      } else {
        setServerError(error.message)
      }
      setLoading(false)
      return
    }

    if (authData.session) {
      setLoading(false)
      router.push("/onboarding/pago")
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (alreadyExists) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-700/30 bg-brand-700/20">
          <Building2 className="h-8 w-8 text-brand-500" />
        </div>
        <h2 className="font-display text-3xl text-zinc-50">Ya tenés una cuenta</h2>
        <p className="mt-3 text-zinc-400">
          Este email ya fue registrado. Iniciá sesión para completar la activación de tu gimnasio.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-brand-700 px-10 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(213,0,0,0.3)]"
        >
          Iniciar sesión
        </Link>
        <p className="mt-4 text-sm text-zinc-600">
          Al iniciar sesión te vamos a redirigir al pago automáticamente.
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <LottiePlayer src="/animations/success.lottie" style={{ width: 160, height: 160 }} />
        </div>
        <h2 className="font-display text-3xl text-zinc-50">¡Cuenta creada!</h2>
        <p className="mt-2 text-zinc-400">
          Confirmá tu email y luego iniciá sesión para activar tu gimnasio.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-brand-700 px-10 py-3 text-sm font-bold text-white">
          Ir a iniciar sesión
        </Link>
      </div>
    )
  }

  const isLast = step === STEPS.length - 1

  return (
    <RegisterShell
      steps={STEPS}
      step={step}
      dir={dir}
      loading={loading}
      serverError={serverError}
      isLast={isLast}
      submitLabel={isLast ? "Continuar al pago" : "Continuar"}
      loadingLabel="Creando gimnasio…"
      onContinue={isLast ? handleSubmit : goNext}
      onBack={goBack}
    >
      {step === 0 && (
        <>
          <div>
            <label htmlFor="fullName" className={labelCls}>Nombre completo</label>
            <input id="fullName" type="text" autoComplete="name" placeholder="Alex Johnson"
              value={data.fullName} onChange={(e) => set("fullName", e.target.value)}
              className={cn(inputCls, errors.fullName && "border-red-500/60")} />
            <FieldError msg={errors.fullName} />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="vos@ejemplo.com"
              value={data.email} onChange={(e) => set("email", e.target.value)}
              className={cn(inputCls, errors.email && "border-red-500/60")} />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <label htmlFor="password" className={labelCls}>Contraseña</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"}
                autoComplete="new-password" placeholder="Mínimo 8 caracteres"
                value={data.password} onChange={(e) => set("password", e.target.value)}
                className={cn(inputCls, "pr-11", errors.password && "border-red-500/60")} />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError msg={errors.password} />
          </div>
        </>
      )}

      {step === 1 && (
        <div>
          <label htmlFor="gymName" className={labelCls}>Nombre del gimnasio</label>
          <input
            id="gymName"
            type="text"
            placeholder="Ej: Iron Gym, FitZone..."
            value={data.gymName}
            onChange={(e) => set("gymName", e.target.value)}
            className={cn(inputCls, errors.gymName && "border-red-500/60")}
          />
          <FieldError msg={errors.gymName} />
          <p className="mt-3 text-sm text-zinc-500">
            Este es el nombre que verán tus miembros al unirse.
          </p>
        </div>
      )}
    </RegisterShell>
  )
}
