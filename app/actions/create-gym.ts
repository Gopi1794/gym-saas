"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function createGymForOwner(gymName: string): Promise<{ gymId: string } | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const admin = createAdminClient()
  const { data: gymId, error } = await admin.rpc("create_gym_for_owner" as never, {
    p_user_id: user.id,
    p_gym_name: gymName,
  } as never)

  if (error) return { error: error.message }
  return { gymId: gymId as string }
}
