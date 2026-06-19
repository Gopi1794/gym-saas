import type { Metadata } from "next"
import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = { title: "Nueva contraseña | Voltia" }

export default function ResetPasswordPage() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-brand-700/20 blur-[140px]" />
      </div>
      <Suspense fallback={
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </>
  )
}
