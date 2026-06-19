"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function getAdminGymId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single()

  if (!data?.gym_id || data.role !== "admin") return null
  return data.gym_id
}

export async function saveMpToken(token: string): Promise<{ error?: string }> {
  if (!token.trim()) return { error: "El token no puede estar vacío" }

  const supabase = createClient()
  const gymId = await getAdminGymId()
  if (!gymId) return { error: "No sos dueño de ningún gimnasio" }

  const { error } = await supabase.rpc("set_gym_mp_token", {
    p_gym_id: gymId,
    p_token: token.trim(),
  })

  if (error) return { error: error.message }

  revalidatePath("/admin/settings")
  return {}
}

export async function getMpTokenStatus(): Promise<{ hasToken: boolean; error?: string }> {
  const supabase = createClient()
  const gymId = await getAdminGymId()
  if (!gymId) return { hasToken: false, error: "No sos dueño de ningún gimnasio" }

  const { data, error } = await supabase.rpc("get_gym_mp_token", { p_gym_id: gymId })
  if (error) return { hasToken: false, error: error.message }

  return { hasToken: !!data }
}

export async function saveMpWebhookSecret(secret: string): Promise<{ error?: string }> {
  if (!secret.trim()) return { error: "El secreto no puede estar vacío" }

  const supabase = createClient()
  const gymId = await getAdminGymId()
  if (!gymId) return { error: "No sos dueño de ningún gimnasio" }

  const { error } = await supabase.rpc("set_gym_mp_webhook_secret", {
    p_gym_id: gymId,
    p_secret: secret.trim(),
  })

  if (error) return { error: error.message }

  revalidatePath("/admin/settings")
  return {}
}

export async function getMpWebhookSecretStatus(): Promise<{ configured: boolean; error?: string }> {
  const supabase = createClient()
  const gymId = await getAdminGymId()
  if (!gymId) return { configured: false, error: "No sos dueño de ningún gimnasio" }

  const { data, error } = await supabase.rpc("get_gym_mp_webhook_secret_configured", { p_gym_id: gymId })
  if (error) return { configured: false, error: error.message }

  return { configured: !!data }
}
