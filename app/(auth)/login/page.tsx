import type { Metadata } from "next"
import LoginForm from "@/components/auth/LoginForm"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default function LoginPage() {
  return (
    <>
      {/* Ambient glow — crea atmósfera roja detrás del form */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-brand-700/20 blur-[140px]" />
      </div>

      {/* Form */}
      <LoginForm />

    </>
  )
}
