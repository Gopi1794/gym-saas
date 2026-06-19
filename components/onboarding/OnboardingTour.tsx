"use client"

import { useEffect, useState } from "react"
import { Joyride, STATUS, type Step, type EventData } from "react-joyride"
import { markOnboardingSeen } from "@/app/actions/onboarding"
import GymFlowTooltip from "./GymFlowTooltip"

// ── Steps ──────────────────────────────────────────────────────────────────────
const ADMIN_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "¡Bienvenido a Voltia! 👋",
    content: "Te mostramos las funciones clave de tu panel en menos de un minuto.",
  },
  {
    target: "[data-tour='kpi-cards']",
    placement: "bottom",
    title: "Métricas del mes",
    content: "Ingresos, membresías activas, nuevos miembros y tasa de renovación de un vistazo.",
  },
  {
    target: "[data-tour='revenue-chart']",
    placement: "bottom",
    title: "Gráfico de ingresos",
    content: "Visualizá la evolución mensual de tus ingresos en los últimos 3, 6 o 12 meses.",
  },
  {
    target: "[data-tour='recent-checkins']",
    placement: "top",
    title: "Check-ins recientes",
    content: "Las últimas asistencias registradas en tu gimnasio en tiempo real.",
  },
]

const MEMBER_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "¡Bienvenido a Voltia! 💪",
    content: "Tu panel personal para seguir tus rutinas, progreso y logros.",
  },
  {
    target: "[data-tour='today-workout']",
    placement: "bottom",
    title: "Tu rutina de hoy",
    content: "Ejercicios asignados para el día de hoy según tu plan de entrenamiento.",
  },
  {
    target: "[data-tour='weekly-summary']",
    placement: "bottom",
    title: "Resumen semanal",
    content: "Cuántos días entrenaste esta semana vs. los días planificados.",
  },
  {
    target: "[data-tour='activity-cards']",
    placement: "top",
    title: "Tu actividad",
    content: "Días completados, total de sesiones y tu racha actual de entrenamiento.",
  },
]

// ── Main ───────────────────────────────────────────────────────────────────────
interface OnboardingTourProps {
  role: "admin" | "trainer" | "member"
}

export default function OnboardingTour({ role }: OnboardingTourProps) {
  const [run, setRun] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRun(true), 700)
    return () => clearTimeout(t)
  }, [])

  const steps = role === "member" ? MEMBER_STEPS : ADMIN_STEPS

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      markOnboardingSeen()
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep

      onEvent={handleEvent}
      tooltipComponent={GymFlowTooltip}

      options={{
        skipBeacon: true,
        overlayColor: "rgba(0,0,0,0.65)",
        primaryColor: "#D50000",
        spotlightRadius: 12,
        zIndex: 9998,
      }}
    />
  )
}
