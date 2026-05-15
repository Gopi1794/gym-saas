import type { Metadata } from "next"
import Image from "next/image"
import LoginForm from "@/components/auth/LoginForm"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <>
      {/* Form centrado */}
      <LoginForm />

      {/* Mujer — borde izquierdo */}
      <div className="pointer-events-none select-none fixed bottom-0 left-0 hidden lg:block">
        <Image
          src="/womangym.png"
          alt=""
          width={340}
          height={500}
          className="object-contain drop-shadow-2xl -translate-x-8"
          priority
        />
      </div>

      {/* Hombre — borde derecho */}
      <div className="pointer-events-none select-none fixed bottom-0 right-0 hidden lg:block">
        <Image
          src="/mengym.png"
          alt=""
          width={320}
          height={500}
          className="object-contain drop-shadow-2xl translate-x-8"
          priority
        />
      </div>
    </>
  )
}
