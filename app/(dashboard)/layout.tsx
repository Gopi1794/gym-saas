import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Sidebar from "@/components/layout/Sidebar"
import MobileDrawer from "@/components/layout/MobileDrawer"
import MobileNav from "@/components/layout/MobileNav"
import MemberChat from "@/components/chat/MemberChat"
import TrainerChat from "@/components/chat/TrainerChat"

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

  const role = (profile as { role?: string } | null)?.role ?? "member"

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-black">
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileDrawer profile={profile} />
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pt-[4.5rem] pb-20 md:p-8 md:pt-8 md:pb-8">
            {children}
          </main>
          <MobileNav role={role} />
        </div>
      </div>
      {role === "member" && <MemberChat />}
      {(role === "admin" || role === "trainer") && <TrainerChat />}
    </div>
  )
}
