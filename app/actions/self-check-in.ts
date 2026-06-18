"use server"

import { createClient } from "@/lib/supabase/server"
import { startOfTodayAR } from "@/lib/date-ar"

type Result =
  | { success: true; action: "checkin" | "checkout" }
  | { success: false; message: string }

export async function selfCheckIn(gymId: string): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: "No autenticado" }

  const todayStr = startOfTodayAR()

  const { data: open } = await (supabase.from("check_ins") as any)
    .select("id")
    .eq("user_id", user.id)
    .eq("gym_id", gymId)
    .is("checked_out_at", null)
    .gte("checked_in_at", todayStr)
    .limit(1)
    .maybeSingle()

  if (open) {
    const { error } = await (supabase.from("check_ins") as any)
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", open.id)
    if (error) return { success: false, message: error.message }
    return { success: true, action: "checkout" }
  }

  const { error } = await (supabase.from("check_ins") as any)
    .insert({
      user_id: user.id,
      gym_id: gymId,
      method: "manual",
      checked_in_at: new Date().toISOString(),
    })

  if (error) return { success: false, message: error.message }
  return { success: true, action: "checkin" }
}
