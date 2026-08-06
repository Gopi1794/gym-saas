"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function setTrainerCanCollectPayments(trainerId: string, value: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles").select("role, gym_id").eq("id", user.id).single()

  if (!me || (me as any).role !== "admin") return { error: "Sin permiso" }

  const { data: target } = await supabase
    .from("profiles").select("role, gym_id").eq("id", trainerId).single()

  if (!target || (target as any).gym_id !== (me as any).gym_id || (target as any).role !== "trainer") {
    return { error: "Trainer inválido" }
  }

  // profiles.can_collect_payments no está en los privilegios de columna de
  // authenticated (20260807_profiles_can_collect_payments.sql) — cliente
  // admin para este update. Las validaciones de arriba ya corrieron: son
  // la única barrera, el cliente admin no tiene RLS que actúe de red.
  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ can_collect_payments: value } as never)
    .eq("id", trainerId)
    .select("id")

  if (error) return { error: error.message }

  if (!updated || updated.length === 0) {
    return { error: "No se pudo actualizar el permiso (el trainer no existe)" }
  }

  revalidatePath("/staff")
  return { success: true }
}
