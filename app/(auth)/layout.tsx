import Link from "next/link"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* light bg */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300 dark:opacity-0"
        style={{ backgroundImage: "url('/background_login_claro.png')" }}
      />
      {/* dark bg */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-300 dark:opacity-100"
        style={{ backgroundImage: "url('/background_login.png')" }}
      />
      <header className="relative z-10 container flex h-16 items-center justify-between">
        <Link href="/">
          <GymFlowLogo size={22} textSize="text-xl" />
        </Link>
        <AnimatedThemeToggler />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  )
}
