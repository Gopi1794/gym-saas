"use client"

import { cn } from "@/lib/utils"

export function WorkingIndicator({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("voltia-working", className)}
    >
      <span className="voltia-working__icon" aria-hidden="true">
        <span className="voltia-working__ring" />
        <span className="voltia-working__spark voltia-working__spark--a" />
        <span className="voltia-working__spark voltia-working__spark--b" />
        <span className="voltia-working__spark voltia-working__spark--c" />
        <svg
          viewBox="0 0 24 24"
          className="voltia-working__bolt"
          fill="none"
        >
          <path
            d="M13.8 2.6 5.4 13.2h6.1l-1.3 8.2 8.4-11h-6.1l1.3-7.8Z"
            fill="currentColor"
          />
        </svg>
      </span>

      <span className="voltia-working__label">Trabajando...</span>
    </div>
  )
}
