"use client"

import { CheckCircle2, Info, AlertTriangle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ElementType } from "react"

type AlertVariant = "success" | "info" | "warning" | "error"

interface AlertProps {
  variant?: AlertVariant
  children: React.ReactNode
  className?: string
}

const config: Record<AlertVariant, { Icon: ElementType; bg: string; border: string; text: string; iconColor: string }> = {
  success: { Icon: CheckCircle2, bg: "bg-green-950/50", border: "border-l-green-500", text: "text-green-400", iconColor: "text-green-500" },
  info:    { Icon: Info,         bg: "bg-cyan-950/50",  border: "border-l-cyan-500",  text: "text-cyan-400",  iconColor: "text-cyan-500"  },
  warning: { Icon: AlertTriangle, bg: "bg-amber-950/50", border: "border-l-amber-500", text: "text-amber-400", iconColor: "text-amber-500" },
  error:   { Icon: AlertCircle,  bg: "bg-red-950/50",   border: "border-l-red-500",   text: "text-red-400",   iconColor: "text-red-500"   },
}

export function Alert({ variant = "info", children, className }: AlertProps) {
  const { Icon, bg, border, text, iconColor } = config[variant]

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 text-sm", bg, border, text, className)}>
      <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
      <span>{children}</span>
    </div>
  )
}
