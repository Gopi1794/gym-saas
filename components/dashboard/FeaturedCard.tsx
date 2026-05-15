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
    <div className="relative overflow-hidden rounded-2xl border border-brand-700/20 bg-gradient-to-br from-brand-950/70 to-zinc-900/80 p-6 backdrop-blur-md">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-700/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-600/8 blur-3xl" />

      <div className="relative">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        <p className="mt-2 text-5xl font-black tracking-tight text-white">
          {display}
          <span className="ml-0.5 text-2xl font-bold text-zinc-500">+</span>
        </p>
        {sublabel && (
          <p className="mt-1.5 text-sm text-zinc-500">{sublabel}</p>
        )}
      </div>

      <Link
        href={href}
        className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-700/20 text-brand-500 transition-colors hover:bg-brand-700/40"
      >
        <ArrowUpRight className="h-5 w-5" />
      </Link>
    </div>
  )
}
