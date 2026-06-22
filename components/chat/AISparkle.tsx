"use client"

import { Zap } from "lucide-react"

interface Props {
  size?: number
  strokeWidth?: number
  duration?: number
}

export function AISparkle({ size = 20 }: Props) {
  return <Zap className="text-brand-500 fill-brand-700" style={{ width: size, height: size }} />
}
