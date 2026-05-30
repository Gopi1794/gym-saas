import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("profiles")
      .select("gym_id")
      .eq("id", user.id)
      .single()

    if (profile?.gym_id) {
      return NextResponse.json({ error: "Ya tiene un gym asignado" }, { status: 400 })
    }

    const gymName: string =
      user.user_metadata?.pending_gym_name ?? "Gym de prueba"

    const { error } = await admin.rpc("create_gym_for_owner" as never, {
      p_user_id: user.id,
      p_gym_name: gymName,
    } as never)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, gymName })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[dev/activate-gym]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
