import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Sidebar from "@/components/layout/Sidebar"
import MobileNav from "@/components/layout/MobileNav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/gym-bg.jpg.png')" }}
      />
      {/* Gradient overlay — keeps content readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/80 via-zinc-950/65 to-zinc-900/55" />

      {/* All content sits above the overlay */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
            {children}
          </main>
          <MobileNav role={profile?.role ?? "member"} />
        </div>
      </div>
    </div>
  )
}
