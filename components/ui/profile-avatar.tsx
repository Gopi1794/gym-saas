"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ProfileAvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}

export function ProfileAvatar({ src, name, size = 44, className }: ProfileAvatarProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?"

  const showImage = !!src && !error

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden",
        "border border-white/10 duration-200",
        "ring-2 ring-brand-700/30",
        showImage && !loaded && "animate-skeleton-loading",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage && (
        <img
          src={src}
          alt={name ?? "Avatar"}
          className={cn(
            "relative z-0 w-full h-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      {showImage && loaded && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 animate-skeleton-loading opacity-25 mix-blend-screen"
        />
      )}
      {(!showImage || error) && (
        <span className="flex items-center justify-center w-full h-full bg-brand-900/60 text-brand-300 font-bold text-sm select-none">
          {initials}
        </span>
      )}
    </span>
  )
}
