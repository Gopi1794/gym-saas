"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const FALLBACK_ICON = "🏆"

const SIZES = {
  sm: { box: "h-10 w-10 rounded-xl", emoji: "text-xl" },
  md: { box: "h-12 w-12 rounded-xl", emoji: "text-2xl" },
  lg: { box: "h-16 w-16 rounded-2xl", emoji: "text-3xl" },
} as const

type Props = {
  /** Stored `achievements.icon`: an image path/URL, an emoji, or empty. */
  icon: string | null | undefined
  size?: keyof typeof SIZES
  /** Draw the rounded tile behind the medal. Off when the parent already frames it. */
  tile?: boolean
  className?: string
}

function isImageSource(icon: string): boolean {
  return icon.startsWith("/") || /^https?:\/\//i.test(icon)
}

/**
 * Decorative medal for an achievement: renders the image when `icon` is a
 * path/URL, the text itself when it is an emoji, and a trophy when missing or
 * when the image fails to load. It is always decorative (the name sits next to
 * it), so it is hidden from assistive tech.
 */
export default function AchievementMedal({
  icon,
  size = "md",
  tile = true,
  className,
}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const value = icon?.trim() || FALLBACK_ICON
  const showImage = isImageSource(value) && failedSrc !== value
  const dims = SIZES[size]

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        dims.box,
        tile &&
          "bg-zinc-100 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800/70 dark:ring-white/10",
        className,
      )}
    >
      {showImage ? (
        // The icon can be any URL an admin stored, and next/image would need
        // every host whitelisted in remotePatterns, so a plain <img> it is.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(value)}
          className="h-[82%] w-[82%] object-contain"
        />
      ) : (
        <span className={cn("leading-none", dims.emoji)}>
          {isImageSource(value) ? FALLBACK_ICON : value}
        </span>
      )}
    </span>
  )
}
