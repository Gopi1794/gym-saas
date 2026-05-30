"use client"

import { useId } from "react"

// Lightning bolt outline as a single closed path — Viewbox 24×24
const STAR_PATH = "M 14 2 L 6 13 L 12 13 L 10 22 L 18 11 L 12 11 Z"
const PATH_LEN = 58
const SNAKE_LEN = Math.round(PATH_LEN * 0.28)
const GAP_LEN = PATH_LEN - SNAKE_LEN

interface Props {
  size?: number
  strokeWidth?: number
  duration?: number
}

export function AISparkle({ size = 32, strokeWidth = 1.6, duration = 2.6 }: Props) {
  const uid = useId().replace(/:/g, "")
  const filterId = `ai-glow-${uid}`
  const gradId = `ai-grad-${uid}`

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="#ff6b6b" />
          <stop offset="60%"  stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Static faint outline */}
      <path
        d={STAR_PATH}
        stroke="#dc2626"
        strokeWidth={strokeWidth * 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.18}
      />

      {/* Animated flowing snake — keyframe defined once in globals.css */}
      <path
        d={STAR_PATH}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${SNAKE_LEN} ${GAP_LEN}`}
        filter={`url(#${filterId})`}
        style={{ animation: `ai-sparkle-flow ${duration}s linear infinite` }}
      />
    </svg>
  )
}
