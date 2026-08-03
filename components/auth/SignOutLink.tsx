"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

// /api/auth/signout no existe como ruta — nunca existió. El link viejo a
// esa URL rompía en cualquier navegador (404), y en /pagos/renovar era la
// única salida que tenía un socio con la membresía vencida: no podía cerrar
// sesión. Mismo patrón que ya usan Sidebar.tsx y ProfileView.tsx.
export default function SignOutLink({ className }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer",
        className,
      )}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  )
}
