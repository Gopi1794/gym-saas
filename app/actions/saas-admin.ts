"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type ActivateResult =
  | { ok: true; gymName: string; email: string }
  | { ok: false; error: string }

export async function activateGymManually(
  email: string,
  gymName: string
): Promise<ActivateResult> {
  const ownerEmail = process.env.SAAS_OWNER_EMAIL
  if (!ownerEmail) return { ok: false, error: "SAAS_OWNER_EMAIL no configurado" }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ownerEmail) {
    return { ok: false, error: "No autorizado" }
  }

  const trimmedEmail = email.trim().toLowerCase()
  const trimmedName = gymName.trim()
  if (!trimmedEmail || !trimmedName) {
    return { ok: false, error: "Email y nombre son requeridos" }
  }

  const admin = createAdminClient()

  // Find user by email via admin auth API
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return { ok: false, error: listErr.message }

  const authUser = users.find(u => u.email === trimmedEmail)
  if (!authUser) {
    return { ok: false, error: "Usuario no encontrado — que se registre primero en la app" }
  }

  // Idempotency check
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", authUser.id)
    .single()

  if (profile?.gym_id) {
    return { ok: false, error: "Este usuario ya tiene un gym activado" }
  }

  const { error: rpcErr } = await admin.rpc("create_gym_for_owner" as never, {
    p_user_id: authUser.id,
    p_gym_name: trimmedName,
  } as never)

  if (rpcErr) {
    return { ok: false, error: (rpcErr as { message: string }).message }
  }

  return { ok: true, gymName: trimmedName, email: trimmedEmail }
}
