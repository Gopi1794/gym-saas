import Link from "next/link"
import Image from "next/image"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="container flex h-16 items-center">
        <Link href="/">
          <Image src="/logo-vector.png" alt="Flash Mega Gym" width={140} height={42} className="h-10 w-auto object-contain" priority />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  )
}
