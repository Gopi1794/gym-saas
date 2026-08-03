"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

export type MemberContactInput = {
  memberId: string
  dateOfBirth: string | null
  phone: string | null
  gender: "male" | "female" | "other" | null
  goal: "lose_weight" | "gain_muscle" | "performance" | "maintain" | null
  trainingFrequency: "never" | "1-2" | "3-4" | "5+" | null
  emergencyName: string | null
  emergencyPhone: string | null
}

export async function updateMemberContact(input: MemberContactInput) {
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
      date_of_birth: input.dateOfBirth,
      phone: input.phone,
      gender: input.gender,
      goal: input.goal,
      training_frequency: input.trainingFrequency,
      emergency_name: input.emergencyName,
      emergency_phone: input.emergencyPhone,
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

  // Admin-only: extender una membresía es dar acceso gratis al gimnasio, y
  // esta función además inserta en payments — un trainer podría registrar un
  // pago en efectivo que nunca ocurrió. Es una operación de plata, no de
  // entrenamiento, mismo criterio que assignTrainer.
  if (!me || (me as any).role !== "admin") {
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

  // profiles.membership_type y profiles.membership_expires_at tampoco están en
  // los privilegios de columna de authenticated — mismo problema que trainer_id
  // en assignTrainer. Cliente admin para este update; las dos validaciones de
  // arriba (admin + mismo gym) son la única barrera.
  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from("profiles")
    .update({
      membership_type: input.membershipType,
      membership_expires_at: input.membershipExpiresAt,
    } as never)
    .eq("id", input.memberId)
    .select("id")

  if (error) return { error: error.message }

  // Guarda por si el socio dejó de existir entre el chequeo de gym y este
  // update — ya no es un chequeo de RLS: el cliente admin no tiene policies
  // que lo bloqueen, así que "0 filas" acá solo puede ser esto.
  if (!updated || updated.length === 0) {
    return { error: "No se pudo actualizar la membresía (el socio no existe)" }
  }

  // Registrar pago en efectivo (RLS admin_insert_payments lo permite)
  const { data: plan } = await supabase
    .from("membership_plans" as never)
    .select("price")
    .eq("gym_id", (me as any).gym_id)
    .eq("type", input.membershipType)
    .maybeSingle() as unknown as { data: { price: number } | null }

  const price = plan?.price ?? 0
  if (price > 0) {
    await supabase.from("payments").insert({
      gym_id: (me as any).gym_id,
      member_id: input.memberId,
      amount: price,
      status: "approved",
      method: "cash",
      mp_payment_id: null,
    })
  }

  revalidatePath(`/members/${input.memberId}`)
  return { success: true }
}

export async function assignTrainer(memberId: string, trainerId: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles").select("role, gym_id").eq("id", user.id).single()

  if (!me || (me as any).role !== "admin") return { error: "Sin permiso" }

  const { data: target } = await supabase
    .from("profiles").select("gym_id").eq("id", memberId).single()

  if (!target || (target as any).gym_id !== (me as any).gym_id) {
    return { error: "Miembro no pertenece a tu gym" }
  }

  if (trainerId) {
    const { data: trainer } = await supabase
      .from("profiles").select("role, gym_id").eq("id", trainerId).single()
    if (!trainer || (trainer as any).gym_id !== (me as any).gym_id || (trainer as any).role !== "trainer") {
      return { error: "Trainer inválido" }
    }
  }

  // profiles.trainer_id no está en los privilegios de columna de authenticated
  // (20260726_profiles_column_privileges.sql) — cliente admin para este update.
  // Las tres validaciones de arriba ya corrieron: son la única barrera, el
  // cliente admin no tiene RLS que actúe de red.
  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ trainer_id: trainerId } as never)
    .eq("id", memberId)
    .select("id")

  if (error) return { error: error.message }

  if (!updated || updated.length === 0) {
    return { error: "No se pudo asignar el trainer (el socio no existe)" }
  }

  revalidatePath(`/members/${memberId}`)
  return { success: true }
}
