import React from "react"
import Link from "next/link"
import { ForceDark } from "@/components/landing/ForceDark"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"
import { Badge } from "@/components/ui/badge"
import { NeonButton } from "@/components/ui/neon-button"
import { GymTechCard } from "@/components/ui/gym-tech-card"
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation"
import {
  PricingWrapper,
  PricingHeading,
  PricingPrice,
  PricingFeatures,
} from "@/components/ui/animated-pricing-cards"
import {
  Dumbbell,
  QrCode,
  BarChart3,
  Users,
  Zap,
  Shield,
  ChevronRight,
  Star,
} from "lucide-react"

export default function LandingPage() {
  return (
    <ForceDark>
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
      {/* ── Skip link ── */}
      <a href="#main" className="skip-link">Ir al contenido principal</a>

      {/* ── Header ── */}
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center">
            <GymFlowLogo size={24} textSize="text-2xl" />
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm text-zinc-400 transition-colors hover:text-zinc-50">
              Funciones
            </Link>
            <Link href="#como-funciona" className="text-sm text-zinc-400 transition-colors hover:text-zinc-50">
              Cómo funciona
            </Link>
            <Link href="#testimonios" className="text-sm text-zinc-400 transition-colors hover:text-zinc-50">
              Testimonios
            </Link>
            <Link href="#pricing" className="text-sm text-zinc-400 transition-colors hover:text-zinc-50">
              Precios
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <NeonButton variant="ghost" size="sm">Ingresar</NeonButton>
            </Link>
            <Link href="/register">
              <NeonButton variant="solid" size="sm">Empezar gratis</NeonButton>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="main" className="relative pt-16">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(8, 8, 8)"
          gradientBackgroundEnd="rgb(20, 4, 4)"
          firstColor="213, 0, 0"
          secondColor="160, 0, 30"
          thirdColor="80, 0, 20"
          fourthColor="120, 10, 10"
          fifthColor="180, 20, 20"
          pointerColor="213, 0, 0"
          blendingValue="hard-light"
          containerClassName="min-h-screen flex items-center justify-center"
          className="absolute z-10 inset-0 flex items-center justify-center"
        >
        <div className="container relative z-10 text-center">
          <Badge
            variant="outline"
            className="mb-6 border-brand-700/30 bg-brand-700/10 text-brand-400"
          >
            <Zap className="mr-1 h-3 w-3" /> Check-in QR · CRM de socios · Biblioteca de ejercicios
          </Badge>

          <h1 className="mb-6 font-display text-5xl tracking-tight md:text-7xl lg:text-8xl">
            El sistema de tu gym
            <br />
            <span className="bg-gradient-to-r from-brand-500 to-purple-400 bg-clip-text text-transparent">
              hecho para crecer
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
            Gestioná socios, registrá asistencia con códigos QR y armá tu biblioteca de ejercicios — todo en una plataforma moderna pensada para gimnasios serios.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <NeonButton variant="solid" size="lg" className="h-12 text-base">
                Empezar gratis <ChevronRight className="ml-1 h-4 w-4 inline" />
              </NeonButton>
            </Link>
            <Link href="/login">
              <NeonButton variant="ghost" size="lg" className="h-12 text-base">
                Ingresar
              </NeonButton>
            </Link>
          </div>

          <div className="mt-20 grid grid-cols-3 gap-8 border-t border-white/5 pt-12">
            {[
              { value: "10k+", label: "Socios activos" },
              { value: "500+", label: "Gimnasios" },
              { value: "1M+", label: "Check-ins" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-3xl text-brand-500">
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        </BackgroundGradientAnimation>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-32">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl">
              Todo lo que tu gym necesita
            </h2>
            <p className="text-zinc-400">
              Construido para negocios fitness modernos que quieren escalar.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <GymTechCard
                key={feature.title}
                bgType={feature.bgType}
                className="p-6 w-full"
              >
                <div className="relative z-10">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700/10">
                    <feature.icon className="h-5 w-5 text-brand-500" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-zinc-400">{feature.description}</p>
                </div>
              </GymTechCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="py-32 border-t border-white/5">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl">Listo en minutos</h2>
            <p className="text-zinc-400">Sin configuración compleja. Sin técnicos. Sin drama.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative flex flex-col gap-4 rounded-2xl border border-white/5 bg-zinc-900/50 p-8"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700/15 font-display text-xl font-bold text-brand-500">
                  {i + 1}
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonios ── */}
      <section id="testimonios" className="bg-zinc-900/20 py-32">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl">
              Gimnasios que ya crecen con GymFlow
            </h2>
            <p className="text-zinc-400">Más de 500 gimnasios confían en nosotros.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-zinc-900/60 p-6"
              >
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-brand-500 text-brand-500" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-zinc-300">"{t.quote}"</p>
                <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700/20 text-sm font-bold text-brand-400">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{t.name}</div>
                    <div className="text-xs text-zinc-500">{t.gym}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-zinc-900/30 py-32">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl">
              Precios simples y transparentes
            </h2>
            <p className="text-zinc-400">Sin sorpresas. Cancelá cuando quieras.</p>
          </div>

          <div className="flex flex-col items-center gap-8 md:flex-row md:items-stretch md:justify-center">
            <PricingWrapper type="crosses" href="/register" className="bg-zinc-800">
              <PricingHeading>{PLANS[0].name}</PricingHeading>
              <PricingPrice>
                ${PLANS[0].price}
                <span className="text-2xl font-sans font-normal text-white/50">/mes</span>
              </PricingPrice>
              <PricingFeatures items={PLANS[0].features} />
            </PricingWrapper>

            <PricingWrapper type="waves" href="/register" className="bg-brand-700 scale-105">
              <div className="flex items-center justify-between w-full">
                <PricingHeading>{PLANS[1].name}</PricingHeading>
                <Badge className="bg-white/20 text-white border-0 text-xs">Más popular</Badge>
              </div>
              <PricingPrice>
                ${PLANS[1].price}
                <span className="text-2xl font-sans font-normal text-white/50">/mes</span>
              </PricingPrice>
              <PricingFeatures items={PLANS[1].features} />
            </PricingWrapper>

            <PricingWrapper type="bolts" href="/register" className="bg-brand-950">
              <PricingHeading>{PLANS[2].name}</PricingHeading>
              <PricingPrice>
                ${PLANS[2].price}
                <span className="text-2xl font-sans font-normal text-white/50">/mes</span>
              </PricingPrice>
              <PricingFeatures items={PLANS[2].features} />
            </PricingWrapper>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center">
            <GymFlowLogo size={18} textSize="text-lg" />
          </div>
          <p className="text-sm text-zinc-500">
            © 2026 GymFlow. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
    </ForceDark>
  )
}

const FEATURES: {
  icon: React.ElementType
  title: string
  description: string
  bgType: "radar" | "hex" | "circuit"
}[] = [
  {
    icon: QrCode,
    title: "Check-in con QR",
    description:
      "Los socios se registran al instante escaneando su código QR personal. Sin apps, sin fricción.",
    bgType: "radar",
  },
  {
    icon: Users,
    title: "Gestión de socios",
    description:
      "CRM completo para socios del gimnasio. Seguí membresías, historial de asistencia y fechas de vencimiento.",
    bgType: "hex",
  },
  {
    icon: BarChart3,
    title: "Panel de análisis",
    description:
      "Información en tiempo real sobre patrones de asistencia, tendencias de membresía y métricas de ingresos.",
    bgType: "circuit",
  },
  {
    icon: Dumbbell,
    title: "Biblioteca de ejercicios",
    description:
      "Base de datos de ejercicios con categorías, niveles de dificultad, grupos musculares y favoritos.",
    bgType: "radar",
  },
  {
    icon: Shield,
    title: "Acceso por roles",
    description:
      "Permisos granulares para admins, entrenadores y socios con autenticación segura de Supabase.",
    bgType: "hex",
  },
  {
    icon: Zap,
    title: "Actualizaciones en tiempo real",
    description:
      "Feed de check-ins en vivo y notificaciones instantáneas gracias a Supabase Realtime.",
    bgType: "circuit",
  },
]

const STEPS = [
  {
    title: "Creá tu cuenta",
    description:
      "Registrate en 2 minutos. Sin tarjeta de crédito ni compromiso inicial. Elegí el plan que mejor se adapte al tamaño de tu gimnasio.",
  },
  {
    title: "Configurá tu gimnasio",
    description:
      "Cargá tus socios, creá los planes de membresía y generá los códigos QR personalizados. Todo desde un panel simple e intuitivo.",
  },
  {
    title: "Empezá a crecer",
    description:
      "Monitoreá asistencia en tiempo real, analizá métricas clave y tomá decisiones basadas en datos desde el primer día de uso.",
  },
]

const TESTIMONIALS = [
  {
    initials: "MR",
    name: "Marcos Rodríguez",
    gym: "Iron House Gym, Buenos Aires",
    quote:
      "Antes llevaba todo en planillas de Excel. Ahora mis socios se anotan solos y yo veo todo en tiempo real. Me ahorré como 10 horas semanales de administración.",
  },
  {
    initials: "VS",
    name: "Valentina Suárez",
    gym: "FitZone, Córdoba",
    quote:
      "El check-in con QR fue un game changer. Cero colas en la entrada, cero papelerío. Los socios lo adoptaron el primer día sin ningún problema.",
  },
  {
    initials: "JL",
    name: "Julián López",
    gym: "CrossFit Palermo, Buenos Aires",
    quote:
      "Lo que más me sorprendió fue lo rápido que arrancamos. Estuvimos operativos en menos de una hora. Y el soporte responde de verdad, no un bot.",
  },
]

const PLANS = [
  {
    name: "Starter",
    price: 29,
    popular: false,
    features: [
      "Hasta 100 socios",
      "Check-in QR",
      "Análisis básico",
      "Biblioteca de ejercicios",
      "Soporte por email",
    ],
  },
  {
    name: "Pro",
    price: 79,
    popular: true,
    features: [
      "Hasta 500 socios",
      "Check-in QR",
      "Análisis avanzado",
      "Biblioteca de ejercicios",
      "Múltiples entrenadores",
      "Soporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    price: 199,
    popular: false,
    features: [
      "Socios ilimitados",
      "Check-in QR",
      "Análisis personalizado",
      "Opción white-label",
      "Acceso a API",
      "Soporte dedicado",
    ],
  },
]
