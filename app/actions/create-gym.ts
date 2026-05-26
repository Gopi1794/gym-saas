"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function createGymForOwner(gymName: string, accessToken: string): Promise<{ gymId: string } | { error: string }> {
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken)
  if (authError || !user) return { error: "No autenticado" }

  const { data: gymId, error } = await admin.rpc("create_gym_for_owner" as never, {
    p_user_id: user.id,
    p_gym_name: gymName,
  } as never)

  if (error) return { error: error.message }
  return { gymId: gymId as string }
}
