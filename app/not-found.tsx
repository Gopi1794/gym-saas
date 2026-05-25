import Link from "next/link"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-950 p-6 text-center">
      <GymFlowLogo size={22} textSize="text-lg" />

      <div className="space-y-1.5">
        <p className="font-heading text-8xl font-bold text-zinc-800 select-none">404</p>
        <h1 className="text-lg font-semibold text-zinc-100">Página no encontrada</h1>
        <p className="text-sm text-zinc-500 max-w-xs">
          La página que buscás no existe o fue movida.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        Volver al dashboard
      </Link>
    </div>
  )
}
