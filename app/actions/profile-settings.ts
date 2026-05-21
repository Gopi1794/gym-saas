"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateNotificationHour(hour: number): Promise<{ error?: string }> {
  if (hour < 0 || hour > 23) return { error: "Hora inválida" }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { error } = await supabase
    .from("profiles")
    .update({ notification_hour: hour })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/profile")
  return {}
}
