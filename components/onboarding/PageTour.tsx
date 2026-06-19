"use client"

import { useEffect, useState } from "react"
import { Joyride, STATUS, type Step, type EventData } from "react-joyride"
import { HelpCircle } from "lucide-react"
import GymFlowTooltip from "./GymFlowTooltip"

interface PageTourProps {
  tourKey: string
  steps: Step[]
}

export default function PageTour({ tourKey, steps }: PageTourProps) {
  const storageKey = `voltia_tour_${tourKey}`
  const [run, setRun] = useState(false)
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    const alreadySeen = localStorage.getItem(storageKey) === "seen"
    setSeen(alreadySeen)
    if (!alreadySeen) {
      const t = setTimeout(() => setRun(true), 800)
      return () => clearTimeout(t)
    }
  }, [storageKey])

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(storageKey, "seen")
      setSeen(true)
      setRun(false)
    }
  }

  function replay() {
    setRun(true)
  }

  return (
    <>
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

      {seen && (
        <button
          onClick={replay}
          title="Ver tour de esta pantalla"
          className="flex shrink-0 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs font-medium text-[#a1a1aa] shadow-sm backdrop-blur-sm transition-all hover:border-zinc-600 hover:text-white"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Ayuda
        </button>
      )}
    </>
  )
}
