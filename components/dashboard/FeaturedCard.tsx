import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

interface FeaturedCardProps {
  value: number | string
  label: string
  sublabel?: string
  href?: string
}

export default function FeaturedCard({ value, label, sublabel, href = "/check-in" }: FeaturedCardProps) {
  const display = typeof value === "number" ? value.toLocaleString("es-AR") : value

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-brand-600/40 bg-white dark:bg-brand-900 p-6 backdrop-blur-md">

      <div className="relative">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{label}</p>
        <p className="mt-2 text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
          {display}
          <span className="ml-0.5 text-2xl font-bold text-zinc-400 dark:text-zinc-500">+</span>
        </p>
        {sublabel && (
          <p className="mt-1.5 text-sm text-zinc-500">{sublabel}</p>
        )}
      </div>

      <Link
        href={href}
        className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/15 text-brand-500 transition-colors hover:bg-brand-600/30 dark:bg-brand-700/20 dark:hover:bg-brand-700/40"
      >
        <ArrowUpRight className="h-5 w-5" />
      </Link>
    </div>
  )
}
