import Link from "next/link"
import { GymFlowLogo } from "@/components/ui/GymFlowLogo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="container flex h-16 items-center">
        <Link href="/">
          <GymFlowLogo size={22} textSize="text-xl" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  )
}
