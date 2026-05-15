"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import {
  Eye, EyeOff, Loader2, User, Calendar, Activity, Heart, ChevronLeft,
} from "lucide-react"
import LottiePlayer from "@/components/ui/lottie-player"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────
type Gender = "male" | "female" | "other"
type Goal = "lose_weight" | "gain_muscle" | "performance" | "maintain"
type Frequency = "never" | "1-2" | "3-4" | "5+"

type FormData = {
  fullName: string; email: string; password: string
  dateOfBirth: string; gender: Gender | ""; phone: string
  weightKg: string; heightCm: string; goal: Goal | ""
  medicalConditions: string; trainingFrequency: Frequency | ""
  emergencyName: string; emergencyPhone: string
}

const INITIAL: FormData = {
  fullName: "", email: "", password: "",
  dateOfBirth: "", gender: "", phone: "",
  weightKg: "", heightCm: "", goal: "",
  medicalConditions: "", trainingFrequency: "", emergencyName: "", emergencyPhone: "",
}

const STEPS = [
  { icon: User,     title: "Tu cuenta",  subtitle: "Creá tus credenciales" },
  { icon: Calendar, title: "Sobre vos",  subtitle: "Contanos un poco más" },
  { icon: Activity, title: "Tu cuerpo",  subtitle: "Para personalizar tu entrenamiento" },
  { icon: Heart,    title: "Tu salud",   subtitle: "Última parte, lo prometemos" },
]

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
  exit: (dir: number) => ({
    x: dir > 0 ? -56 : 56, opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  }),
}

const inputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 transition-colors min-h-[48px]"

const labelCls = "block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5"

function Pill<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T | ""
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all min-h-[44px]",
            value === o.value
              ? "border-brand-500 bg-brand-700/20 text-brand-400 shadow-[0_0_12px_rgba(213,0,0,0.2)]"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 text-xs text-red-400">{msg}</p>
}

export default function RegisterForm() {
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
      if (!data.dateOfBirth) errs.dateOfBirth = "La fecha es obligatoria"
      if (!data.gender) errs.gender = "Seleccioná tu género"
    }
    if (step === 2) {
      if (!data.weightKg || isNaN(Number(data.weightKg))) errs.weightKg = "Peso inválido"
      if (!data.heightCm || isNaN(Number(data.heightCm))) errs.heightCm = "Altura inválida"
      if (!data.goal) errs.goal = "Seleccioná un objetivo"
    }
    if (step === 3) {
      if (!data.trainingFrequency) errs.trainingFrequency = "Seleccioná una frecuencia"
      if (!data.emergencyName.trim()) errs.emergencyName = "El nombre es obligatorio"
      if (!data.emergencyPhone.trim()) errs.emergencyPhone = "El teléfono es obligatorio"
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
      options: { data: { full_name: data.fullName, gender: data.gender } },
    })

    if (error) {
      setServerError(error.message)
      setLoading(false)
      return
    }

    if (authData.session) {
      await supabase.from("profiles").update({
        date_of_birth:      data.dateOfBirth || null,
        phone:              data.phone || null,
        weight_kg:          data.weightKg ? Number(data.weightKg) : null,
        height_cm:          data.heightCm ? Number(data.heightCm) : null,
        goal:               data.goal || null,
        medical_conditions: data.medicalConditions || null,
        training_frequency: data.trainingFrequency || null,
        emergency_name:     data.emergencyName || null,
        emergency_phone:    data.emergencyPhone || null,
      } as never).eq("id", authData.session.user.id)
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => { router.push("/dashboard"); router.refresh() }, 1800)
  }

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <LottiePlayer src="/animations/success.lottie" style={{ width: 160, height: 160 }} />
        </div>
        <h2 className="font-display text-3xl text-zinc-50">¡Cuenta creada!</h2>
        <p className="mt-2 text-zinc-400">Revisá tu email para confirmar y luego iniciá sesión.</p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-brand-700 px-10 py-3 text-sm font-bold text-white">
          Ir a iniciar sesión
        </Link>
      </div>
    )
  }

  const StepIcon = STEPS[step].icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="w-full max-w-md">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-xs tracking-widest text-zinc-500">
            PASO {step + 1} DE {STEPS.length}
          </p>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i <= step
                    ? "w-6 bg-brand-500 shadow-[0_0_6px_rgba(213,0,0,0.7)]"
                    : "w-4 bg-zinc-700",
                )}
              />
            ))}
          </div>
        </div>
        <div className="h-px w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-brand-600"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-700/40 bg-brand-950/60">
          <StepIcon className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-zinc-50">{STEPS[step].title}</h1>
          <p className="text-sm text-zinc-500">{STEPS[step].subtitle}</p>
        </div>
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-4"
          >
            {/* Step 1 — Cuenta */}
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

            {/* Step 2 — Sobre vos */}
            {step === 1 && (
              <>
                <div>
                  <label htmlFor="dob" className={labelCls}>Fecha de nacimiento</label>
                  <input id="dob" type="date" value={data.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                    className={cn(inputCls, errors.dateOfBirth && "border-red-500/60")} />
                  <FieldError msg={errors.dateOfBirth} />
                </div>
                <div>
                  <label className={labelCls}>Género</label>
                  <Pill
                    options={[
                      { value: "male" as Gender, label: "Hombre" },
                      { value: "female" as Gender, label: "Mujer" },
                      { value: "other" as Gender, label: "Otro" },
                    ]}
                    value={data.gender} onChange={(v) => set("gender", v)} />
                  <FieldError msg={errors.gender} />
                </div>
                <div>
                  <label htmlFor="phone" className={labelCls}>
                    Teléfono <span className="normal-case font-normal text-zinc-600">(opcional)</span>
                  </label>
                  <input id="phone" type="tel" autoComplete="tel" placeholder="+54 11 1234-5678"
                    value={data.phone} onChange={(e) => set("phone", e.target.value)}
                    className={inputCls} />
                </div>
              </>
            )}

            {/* Step 3 — Tu cuerpo */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="weight" className={labelCls}>Peso (kg)</label>
                    <input id="weight" type="number" inputMode="decimal" min={20} max={300} step={0.5}
                      placeholder="70" value={data.weightKg}
                      onChange={(e) => set("weightKg", e.target.value)}
                      className={cn(inputCls, errors.weightKg && "border-red-500/60")} />
                    <FieldError msg={errors.weightKg} />
                  </div>
                  <div>
                    <label htmlFor="height" className={labelCls}>Altura (cm)</label>
                    <input id="height" type="number" inputMode="numeric" min={100} max={250}
                      placeholder="170" value={data.heightCm}
                      onChange={(e) => set("heightCm", e.target.value)}
                      className={cn(inputCls, errors.heightCm && "border-red-500/60")} />
                    <FieldError msg={errors.heightCm} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Objetivo principal</label>
                  <Pill
                    options={[
                      { value: "lose_weight" as Goal, label: "Perder peso" },
                      { value: "gain_muscle" as Goal, label: "Ganar músculo" },
                      { value: "performance" as Goal, label: "Rendimiento" },
                      { value: "maintain" as Goal, label: "Mantenerme" },
                    ]}
                    value={data.goal} onChange={(v) => set("goal", v)} />
                  <FieldError msg={errors.goal} />
                </div>
              </>
            )}

            {/* Step 4 — Tu salud */}
            {step === 3 && (
              <>
                <div>
                  <label className={labelCls}>¿Con qué frecuencia entrenás ahora?</label>
                  <Pill
                    options={[
                      { value: "never" as Frequency, label: "Nunca" },
                      { value: "1-2" as Frequency, label: "1-2 / sem" },
                      { value: "3-4" as Frequency, label: "3-4 / sem" },
                      { value: "5+" as Frequency, label: "5+ / sem" },
                    ]}
                    value={data.trainingFrequency} onChange={(v) => set("trainingFrequency", v)} />
                  <FieldError msg={errors.trainingFrequency} />
                </div>
                <div>
                  <label htmlFor="medical" className={labelCls}>
                    Lesiones o condiciones médicas{" "}
                    <span className="normal-case font-normal text-zinc-600">(opcional)</span>
                  </label>
                  <textarea id="medical" rows={2} placeholder="Ej: rodilla operada, asma leve..."
                    value={data.medicalConditions}
                    onChange={(e) => set("medicalConditions", e.target.value)}
                    className={cn(inputCls, "resize-none")} />
                </div>
                <div>
                  <label className={labelCls}>Contacto de emergencia</label>
                  <div className="space-y-2">
                    <input type="text" placeholder="Nombre completo" autoComplete="off"
                      value={data.emergencyName} onChange={(e) => set("emergencyName", e.target.value)}
                      className={cn(inputCls, errors.emergencyName && "border-red-500/60")} />
                    <FieldError msg={errors.emergencyName} />
                    <input type="tel" placeholder="Teléfono" autoComplete="off"
                      value={data.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)}
                      className={cn(inputCls, errors.emergencyPhone && "border-red-500/60")} />
                    <FieldError msg={errors.emergencyPhone} />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {serverError}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={isLast ? handleSubmit : goNext}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(213,0,0,0.3)] transition-all active:scale-[0.97] disabled:opacity-60"
          style={{ transition: "transform 150ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando cuenta…</>
            : isLast ? "Crear mi cuenta" : "Continuar"}
        </button>

        {step > 0 && (
          <button type="button" onClick={goBack}
            className="flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </button>
        )}
      </div>

      {step === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-brand-500 hover:text-brand-400">
            Iniciá sesión
          </Link>
        </p>
      )}
    </div>
  )
}
