"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type MemberPhysicalInput = {
  memberId: string
  weightKg: number | null
  heightCm: number | null
}

export async function updateMemberPhysical(input: MemberPhysicalInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", input.memberId)
    .single()

  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
    } as never)
    .eq("id", input.memberId)

  if (error) return { error: error.message }

  revalidatePath(`/members/${input.memberId}`)
  return { success: true }
}

export type MemberMembershipInput = {
  memberId: string
  membershipType: "basic" | "premium" | "vip"
  membershipExpiresAt: string | null
}

export async function updateMemberMembership(input: MemberMembershipInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || !["admin", "trainer"].includes((me as any).role)) {
    return { error: "Sin permiso" }
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", input.memberId)
    .single()

  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      membership_type: input.membershipType,
      membership_expires_at: input.membershipExpiresAt,
    } as never)
    .eq("id", input.memberId)

  if (error) return { error: error.message }

  revalidatePath(`/members/${input.memberId}`)
  return { success: true }
}
