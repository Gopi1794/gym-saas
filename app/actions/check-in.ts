"use server"

import { createClient } from "@/lib/supabase/server"
import { startOfTodayAR } from "@/lib/date-ar"

type CheckInResult =
  | { success: true; memberName: string }
  | { success: false; reason: "already_today" | "membership_expired" | "not_found" | "error"; memberName?: string; message?: string }

export async function registerMemberCheckIn(
  qrCode: string,
  gymId: string,
): Promise<CheckInResult> {
  const supabase = createClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, membership_expires_at, role")
    .eq("qr_code", qrCode)
    .single()

  if (profileError || !profile) {
    return { success: false, reason: "not_found" }
  }

  const isStaff = profile.role === "admin" || profile.role === "trainer"
  const isActive =
    isStaff ||
    (profile.membership_expires_at && new Date(profile.membership_expires_at) > new Date())

  if (!isActive) {
    return { success: false, reason: "membership_expired", memberName: profile.full_name ?? undefined }
  }

  const todayStr = startOfTodayAR()

  // Buscar cualquier check-in abierto para este socio en este gym
  const { data: openCheckin } = await (supabase.from("check_ins") as any)
    .select("id, checked_in_at")
    .eq("user_id", profile.id)
    .eq("gym_id", gymId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openCheckin) {
    const isToday = openCheckin.checked_in_at >= todayStr
    if (isToday) {
      return { success: false, reason: "already_today", memberName: profile.full_name ?? undefined }
    }
    // Check-in abierto de día anterior — cerrarlo
    await (supabase.from("check_ins") as any)
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", openCheckin.id)
  }

  const { error: insertError } = await (supabase.from("check_ins") as any)
    .insert({
      user_id: profile.id,
      gym_id: gymId,
      method: "qr",
      checked_in_at: new Date().toISOString(),
    })

  if (insertError) {
    return { success: false, reason: "error", message: insertError.message }
  }

  return { success: true, memberName: profile.full_name ?? "Socio" }
}
