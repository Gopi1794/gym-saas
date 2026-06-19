import type { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"

export const metadata: Metadata = { title: "Recuperar contraseña | Voltia" }

export default function ForgotPasswordPage() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-brand-700/20 blur-[140px]" />
      </div>
      <ForgotPasswordForm />
    </>
  )
}
