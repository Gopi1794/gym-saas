import React from "react"
import Link from "next/link"
import {
  Apple,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Flame,
  LineChart,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from "lucide-react"
import { ForceDark } from "@/components/landing/ForceDark"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"
import { Badge } from "@/components/ui/badge"
import { GymTechCard } from "@/components/ui/gym-tech-card"
import {
  PricingWrapper,
  PricingHeading,
  PricingPrice,
  PricingFeatures,
} from "@/components/ui/animated-pricing-cards"
import { cn } from "@/lib/utils"

type Icon = React.ElementType

export default function LandingPage() {
  return (
    <ForceDark>
      <main className="dark min-h-screen overflow-hidden bg-[#050505] text-zinc-50 selection:bg-brand-700/40 selection:text-white">
        <a href="#main" className="skip-link">Ir al contenido principal</a>
        <LandingHeader />

        <section id="main" className="relative isolate min-h-screen overflow-hidden pt-24 sm:pt-28">
          <HeroBackground />
          <div className="container relative z-10 grid min-h-[calc(100vh-7rem)] items-center gap-12 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
            <div className="max-w-3xl">
              <Badge className="mb-6 rounded-full border border-brand-500/25 bg-brand-700/10 px-3 py-1.5 text-xs font-semibold text-brand-200 hover:bg-brand-700/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                El sistema operativo para gimnasios que quieren crecer sin caos
              </Badge>

              <h1 className="font-display text-[clamp(3.6rem,10vw,8.5rem)] leading-[0.86] tracking-[-0.04em] text-white">
                Tu gym no necesita más planillas.
                <span className="mt-2 block bg-gradient-to-r from-brand-400 via-red-100 to-zinc-400 bg-clip-text text-transparent">
                  Necesita control.
                </span>
              </h1>

              <p className="mt-7 max-w-2xl text-balance text-lg leading-8 text-zinc-300 md:text-xl">
                Voltia une recepción, socios, entrenadores, nutrición, pagos y reportes en una sola experiencia. Menos tareas manuales. Más foco en vender, retener y entrenar mejor.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <LandingButton href="/register" variant="primary">
                  Empezar ahora <ArrowRight className="h-4 w-4" />
                </LandingButton>
                <LandingButton href="#story" variant="secondary">
                  Ver cómo funciona
                </LandingButton>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {HERO_METRICS.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm">
                    <p className="font-display text-3xl leading-none text-white">{metric.value}</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <HeroProductMockup />
          </div>
        </section>

        <section id="story" className="relative border-y border-white/8 bg-zinc-950/70 py-24">
          <div className="container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionEyebrow>La historia real</SectionEyebrow>
              <h2 className="mt-4 font-display text-5xl leading-none tracking-tight text-white md:text-6xl">
                El problema no es entrenar. Es todo lo que pasa alrededor.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-400">
                Socios que vencen sin aviso, rutinas perdidas en WhatsApp, check-ins anotados a mano, pagos mezclados y decisiones tomadas tarde. Voltia convierte ese ruido en un flujo claro.
              </p>
            </div>

            <div className="grid gap-4">
              {STORY_STEPS.map((step, index) => (
                <StoryCard key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section id="sistema" className="py-28">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>Un solo sistema</SectionEyebrow>
              <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                Todo conectado. Cada rol con su pantalla.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-400">
                El dueño ve el negocio. El trainer trabaja con contexto. El socio entiende qué hacer hoy. Eso es una plataforma, no una planilla linda.
              </p>
            </div>

            <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {SYSTEM_MODULES.map((module) => (
                <GymTechCard key={module.title} bgType={module.bgType} className="group min-h-[260px] p-6 transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-1 hover:border-brand-500/35 hover:bg-zinc-900/70">
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-700/10 text-brand-300 shadow-[0_0_28px_rgba(213,0,0,0.12)]">
                      <module.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-white">{module.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{module.description}</p>
                    <p className="mt-auto pt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400/80">
                      {module.result}
                    </p>
                  </div>
                </GymTechCard>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/8 bg-[radial-gradient(circle_at_50%_0%,rgba(213,0,0,0.18),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.76),rgba(5,5,5,0.96))] py-28">
          <div className="container">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <SectionEyebrow>Antes / Después</SectionEyebrow>
                <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                  De operar apagando incendios a dirigir con datos.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <BeforeAfterCard title="Antes" tone="muted" items={BEFORE_ITEMS} />
                <BeforeAfterCard title="Con Voltia" tone="brand" items={AFTER_ITEMS} />
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="py-28">
          <div className="container">
            <div className="mb-14 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <SectionEyebrow>Experiencia por rol</SectionEyebrow>
                <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                  Nadie ve de más. Nadie trabaja a ciegas.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-zinc-400">
                Cada pantalla está pensada para reducir fricción: administración para decidir, entrenamiento para ejecutar, socio para avanzar.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {ROLE_CARDS.map((role) => (
                <RoleCard key={role.title} role={role} />
              ))}
            </div>
          </div>
        </section>

        <section id="testimonios" className="border-y border-white/8 bg-zinc-950/75 py-28">
          <div className="container">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <SectionEyebrow>Se siente distinto</SectionEyebrow>
              <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                La diferencia se nota en la operación diaria.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((testimonial) => (
                <TestimonialCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-28">
          <div className="container">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <SectionEyebrow>Planes</SectionEyebrow>
              <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                Empezá simple. Escalá cuando el gym lo pida.
              </h2>
              <p className="mt-5 text-lg text-zinc-400">Sin contratos eternos. Sin implementación pesada. Probalo y medí el impacto.</p>
            </div>

            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:justify-center">
              {PLANS.map((plan) => (
                <PricingWrapper
                  key={plan.name}
                  type={plan.type}
                  href="/register"
                  buttonLabel={plan.buttonLabel}
                  className={cn(
                    "border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.22)]",
                    plan.popular ? "scale-[1.02] bg-brand-700" : "bg-zinc-900",
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <PricingHeading>{plan.name}</PricingHeading>
                    {plan.popular && <Badge className="border-0 bg-white/20 text-xs text-white">Más elegido</Badge>}
                  </div>
                  <PricingPrice>
                    ${plan.price}
                    <span className="text-2xl font-normal text-white/50">/mes</span>
                  </PricingPrice>
                  <p className="text-sm leading-6 text-white/70">{plan.description}</p>
                  <PricingFeatures items={plan.features} />
                </PricingWrapper>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-10">
          <div className="container relative overflow-hidden rounded-[2rem] border border-brand-500/20 bg-gradient-to-br from-brand-700 via-brand-950 to-zinc-950 p-8 shadow-[0_30px_100px_rgba(213,0,0,0.2)] md:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/60">Listo para ordenar el gym</p>
                <h2 className="mt-4 font-display text-5xl leading-none tracking-tight md:text-7xl">
                  Convertí tu operación en una máquina de crecimiento.
                </h2>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                <LandingButton href="/register" variant="light">Crear cuenta <ArrowRight className="h-4 w-4" /></LandingButton>
                <LandingButton href="/login" variant="glass">Ya tengo cuenta</LandingButton>
              </div>
            </div>
          </div>
        </section>

        <LandingFooter />
      </main>
    </ForceDark>
  )
}

function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-black/55 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="#main" aria-label="Voltia inicio" className="shrink-0 transition-transform duration-150 ease-out active:scale-[0.97]">
          <GymFlowLogo size={24} textSize="text-2xl" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-zinc-400 transition-colors duration-150 ease-out hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/8 hover:text-white active:scale-[0.97] sm:inline-flex">
            Ingresar
          </Link>
          <LandingButton href="/register" variant="primary" size="sm">Empezar</LandingButton>
        </div>
      </div>
    </header>
  )
}

function LandingButton({ href, variant, size = "md", children }: { href: string; variant: "primary" | "secondary" | "light" | "glass"; size?: "sm" | "md"; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]",
        size === "sm" ? "h-10 px-4 text-sm" : "h-12 px-6 text-base",
        variant === "primary" && "border border-brand-500/45 bg-brand-700 text-white shadow-[0_0_34px_rgba(213,0,0,0.28)] hover:bg-brand-600",
        variant === "secondary" && "border border-white/10 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08]",
        variant === "light" && "border border-white bg-white text-zinc-950 hover:bg-zinc-100",
        variant === "glass" && "border border-white/20 bg-white/10 text-white hover:bg-white/15",
      )}
    >
      {children}
    </Link>
  )
}

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(213,0,0,0.30),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(239,68,68,0.18),transparent_24%),linear-gradient(180deg,#050505_0%,#0b0202_48%,#050505_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]" />
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.045]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(circle_at_50%_20%,black,transparent_72%)]" />
    </div>
  )
}

function HeroProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] lg:mr-0">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-700/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/82 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Hoy en Voltia</p>
            <p className="mt-1 text-sm font-bold text-white">Operación en vivo</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_0_24px_rgba(213,0,0,0.45)]">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MockMetric icon={QrCode} label="Check-ins" value="128" detail="+18% vs lunes" tone="brand" />
          <MockMetric icon={WalletCards} label="Vencen hoy" value="9" detail="Avisos listos" tone="amber" />
          <MockMetric icon={Dumbbell} label="Rutinas activas" value="42" detail="7 actualizadas" tone="cyan" />
          <MockMetric icon={Apple} label="Planes nutrición" value="31" detail="4 ajustes" tone="emerald" />
        </div>

        <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Socio detectado</p>
              <p className="text-xs text-zinc-500">Entrada QR · plan premium activo</p>
            </div>
            <Badge className="border-0 bg-emerald-500/15 text-emerald-300">Activo</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-950 font-black text-white">GN</div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                <span>Progreso semanal</span>
                <span>3/4</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-brand-600 to-red-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-brand-500/20 bg-brand-700/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-300">Asistente</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">“Actualicé calorías por cambio de peso y dejé nota para el trainer.”</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Caja</p>
            <p className="mt-2 font-display text-4xl leading-none text-white">$1.8M</p>
            <p className="mt-1 text-xs text-zinc-500">Ingresos del mes a la fecha</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockMetric({ icon: IconComponent, label, value, detail, tone }: { icon: Icon; label: string; value: string; detail: string; tone: "brand" | "amber" | "cyan" | "emerald" }) {
  const toneClass = {
    brand: "text-brand-300 bg-brand-700/15",
    amber: "text-amber-300 bg-amber-500/15",
    cyan: "text-cyan-300 bg-cyan-500/15",
    emerald: "text-emerald-300 bg-emerald-500/15",
  }[tone]

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <div className={cn("mb-4 flex h-9 w-9 items-center justify-center rounded-xl", toneClass)}>
        <IconComponent className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-4xl leading-none text-white">{value}</p>
        <p className="pb-1 text-xs text-zinc-500">{detail}</p>
      </div>
    </div>
  )
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-400">{children}</p>
}

function StoryCard({ step, index }: { step: (typeof STORY_STEPS)[number]; index: number }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.035] p-5 transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-1 hover:border-brand-500/30 hover:bg-white/[0.055] md:p-6">
      <div className="absolute right-5 top-5 font-display text-6xl leading-none text-white/[0.035]">0{index + 1}</div>
      <div className="relative z-10 flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700/15 text-brand-300">
          <step.icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{step.time}</p>
          <h3 className="mt-2 text-xl font-black text-white">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{step.description}</p>
        </div>
      </div>
    </div>
  )
}

function BeforeAfterCard({ title, tone, items }: { title: string; tone: "muted" | "brand"; items: string[] }) {
  return (
    <div className={cn(
      "rounded-3xl border p-6",
      tone === "brand" ? "border-brand-500/35 bg-brand-700/12" : "border-white/8 bg-white/[0.035]",
    )}>
      <h3 className="font-display text-3xl text-white">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "brand" ? "text-brand-300" : "text-zinc-600")} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleCard({ role }: { role: (typeof ROLE_CARDS)[number] }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/8 bg-zinc-900/50">
      <div className="border-b border-white/8 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700/15 text-brand-300">
            <role.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{role.kicker}</p>
            <h3 className="text-xl font-black text-white">{role.title}</h3>
          </div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm leading-6 text-zinc-400">{role.description}</p>
        <div className="mt-5 space-y-2">
          {role.items.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-zinc-300">
              <BadgeCheck className="h-4 w-4 text-brand-400" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function TestimonialCard({ testimonial }: { testimonial: (typeof TESTIMONIALS)[number] }) {
  return (
    <article className="flex min-h-[18rem] flex-col rounded-3xl border border-white/8 bg-white/[0.035] p-6">
      <div className="mb-5 flex gap-1 text-brand-400">
        {Array.from({ length: 5 }, (_, index) => <Flame key={index} className="h-4 w-4 fill-current" />)}
      </div>
      <p className="flex-1 text-sm leading-7 text-zinc-300">“{testimonial.quote}”</p>
      <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-700/20 text-sm font-black text-brand-300">{testimonial.initials}</div>
        <div>
          <p className="text-sm font-bold text-white">{testimonial.name}</p>
          <p className="text-xs text-zinc-500">{testimonial.gym}</p>
        </div>
      </div>
    </article>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/8 py-10">
      <div className="container flex flex-col items-center justify-between gap-5 md:flex-row">
        <GymFlowLogo size={18} textSize="text-lg" />
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-500">
          <Link href="#sistema" className="hover:text-white">Sistema</Link>
          <Link href="#roles" className="hover:text-white">Roles</Link>
          <Link href="#pricing" className="hover:text-white">Planes</Link>
          <span>© 2026 Voltia. Todos los derechos reservados.</span>
        </div>
      </div>
    </footer>
  )
}

const NAV_ITEMS = [
  { href: "#story", label: "Historia" },
  { href: "#sistema", label: "Sistema" },
  { href: "#roles", label: "Roles" },
  { href: "#pricing", label: "Planes" },
]

const HERO_METRICS = [
  { value: "QR", label: "Recepción sin filas" },
  { value: "IA", label: "Asistente para operación" },
  { value: "360°", label: "Socio, pagos y progreso" },
]

const STORY_STEPS: { time: string; title: string; description: string; icon: Icon }[] = [
  {
    time: "08:00 · abre el gym",
    title: "El socio entra y el sistema entiende el contexto.",
    description: "Check-in con QR, membresía validada, historial actualizado y alertas listas si algo requiere atención.",
    icon: QrCode,
  },
  {
    time: "11:30 · administración",
    title: "El dueño deja de perseguir vencimientos.",
    description: "Voltia muestra quién vence, quién falta hace días y qué ingresos vienen creciendo o cayendo.",
    icon: WalletCards,
  },
  {
    time: "17:00 · hora pico",
    title: "El trainer trabaja con datos, no con memoria.",
    description: "Rutinas, marcas, notas, adherencia y objetivos viven en un mismo lugar para ajustar sin perder tiempo.",
    icon: Dumbbell,
  },
  {
    time: "21:00 · cierre",
    title: "Terminás el día sabiendo qué pasó.",
    description: "Reportes claros para decidir: asistencia, pagos, retención, progreso y oportunidades de seguimiento.",
    icon: BarChart3,
  },
]

const SYSTEM_MODULES: { icon: Icon; title: string; description: string; result: string; bgType: "radar" | "hex" | "circuit" }[] = [
  {
    icon: QrCode,
    title: "Recepción QR",
    description: "Check-ins rápidos, validación de membresía y registro automático de asistencia sin depender de papel o planillas.",
    result: "Menos fila. Más control.",
    bgType: "radar",
  },
  {
    icon: Users,
    title: "CRM de socios",
    description: "Datos, vencimientos, historial, actividad y estado del socio en una vista operativa pensada para accionar.",
    result: "Seguimiento real.",
    bgType: "hex",
  },
  {
    icon: Dumbbell,
    title: "Entrenamiento",
    description: "Planes, rutinas, sesiones, notas y progresión para que el trainer acompañe con estructura y no a ojo.",
    result: "Mejor experiencia.",
    bgType: "circuit",
  },
  {
    icon: Apple,
    title: "Nutrición",
    description: "Objetivos, comidas, agua, macros y ajustes de calorías conectados al progreso del miembro.",
    result: "Más adherencia.",
    bgType: "hex",
  },
  {
    icon: LineChart,
    title: "Reportes",
    description: "Asistencia, ingresos, crecimiento, retención y comportamiento del gimnasio con visuales fáciles de leer.",
    result: "Decisiones rápidas.",
    bgType: "circuit",
  },
  {
    icon: ShieldCheck,
    title: "Roles seguros",
    description: "Administrador, trainer y miembro con permisos distintos. Cada persona ve y toca lo que corresponde.",
    result: "Orden sin fricción.",
    bgType: "radar",
  },
]

const BEFORE_ITEMS = [
  "Check-ins anotados a mano o en una planilla que nadie mira a tiempo.",
  "Pagos, vencimientos y reclamos repartidos entre WhatsApp, memoria y Excel.",
  "Rutinas y nutrición sin conexión con progreso real del socio.",
  "Reportes tarde, incompletos o directamente inexistentes.",
]

const AFTER_ITEMS = [
  "Recepción, socios, planes, pagos y progreso conectados en un mismo flujo.",
  "Alertas claras para actuar antes de que el socio se enfríe o abandone.",
  "Trainers con contexto para ajustar entrenamiento y acompañamiento.",
  "Métricas del negocio visibles sin tener que perseguir datos.",
]

const ROLE_CARDS: { kicker: string; title: string; description: string; icon: Icon; items: string[] }[] = [
  {
    kicker: "Dueño / Admin",
    title: "Control del negocio",
    description: "Una vista para saber qué está pasando con ventas, asistencia, vencimientos, socios activos y oportunidades de retención.",
    icon: BarChart3,
    items: ["Ingresos y membresías", "Vencimientos y actividad", "Reportes de operación"],
  },
  {
    kicker: "Trainer",
    title: "Acompañamiento real",
    description: "Menos búsqueda de información y más intervención útil: planes, sesiones, notas, marcas y contexto del miembro.",
    icon: ClipboardList,
    items: ["Rutinas por miembro", "Notas y progresión", "Chat con contexto"],
  },
  {
    kicker: "Miembro",
    title: "Claridad para avanzar",
    description: "El socio sabe qué tiene que hacer hoy, cómo viene progresando y qué objetivos está persiguiendo.",
    icon: CalendarCheck,
    items: ["Rutina del día", "Nutrición y agua", "Logros y progreso"],
  },
]

const TESTIMONIALS = [
  {
    initials: "MR",
    name: "Marcos Rodríguez",
    gym: "Iron House Gym",
    quote: "Lo que más cambió fue la cabeza: dejamos de correr atrás de datos sueltos. Ahora sabemos qué socio necesita atención y qué parte del negocio está floja.",
  },
  {
    initials: "VS",
    name: "Valentina Suárez",
    gym: "FitZone",
    quote: "El check-in con QR bajó la fricción de entrada y el equipo empezó a usar la información de verdad, no solo a cargarla por obligación.",
  },
  {
    initials: "JL",
    name: "Julián López",
    gym: "Cross Training Palermo",
    quote: "Los entrenadores tienen todo el contexto del socio. Eso se nota en la retención porque el seguimiento se siente mucho más personal.",
  },
]

const PLANS = [
  {
    name: "Starter",
    price: 29,
    popular: false,
    type: "crosses" as const,
    buttonLabel: "Empezar Starter",
    description: "Para gimnasios que quieren ordenar recepción y socios sin complejidad.",
    features: ["Hasta 100 socios", "Check-in QR", "CRM básico", "Biblioteca de ejercicios", "Soporte por email"],
  },
  {
    name: "Pro",
    price: 79,
    popular: true,
    type: "waves" as const,
    buttonLabel: "Elegir Pro",
    description: "Para equipos que ya necesitan entrenadores, reportes y seguimiento más fino.",
    features: ["Hasta 500 socios", "Check-in QR", "Reportes avanzados", "Múltiples trainers", "Nutrición y progreso", "Soporte prioritario"],
  },
  {
    name: "Scale",
    price: 199,
    popular: false,
    type: "bolts" as const,
    buttonLabel: "Hablar de Scale",
    description: "Para operaciones más grandes que necesitan permisos, datos y soporte dedicado.",
    features: ["Socios ilimitados", "Roles avanzados", "Reportes personalizados", "Integraciones", "Acompañamiento dedicado"],
  },
]
