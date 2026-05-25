"use client"
import { useId } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { GooeyFilter } from "@/components/ui/gooey-filter"
import { cn } from "@/lib/utils"

export interface TabItem { key: string; label: string }

export default function TabSwitcher({ tabs, activeTab }: { tabs: TabItem[]; activeTab: string }) {
  const pathname = usePathname()
  const uid = useId().replace(/:/g, "")
  const filterId = `gooey-tab-${uid}`
  const layoutId = `gooey-tab-bg-${uid}`

  return (
    <div className="relative">
      <GooeyFilter id={filterId} strength={8} />
      <div className="relative flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">

        {/* Ghost layer — lleva el indicador rojo con filtro gooey */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex gap-1 p-1"
          style={{ filter: `url(#${filterId})` }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className="invisible relative flex-1 rounded-lg px-4 py-2 text-sm font-medium"
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId={layoutId}
                  className="!visible absolute inset-0 rounded-lg bg-[rgba(213,0,0,0.85)]"
                  transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Links interactivos */}
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            className={cn(
              "relative z-10 flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors",
              activeTab === tab.key ? "text-[#ffffff]" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
