"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type MembershipPlanInput = {
  type: "basic" | "premium" | "vip"
  label: string
  price: number
  duration_days: number
  features: string[]
  is_active: boolean
}

export async function getMembershipPlans() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "No autenticado" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.gym_id) return { data: null, error: "Sin gimnasio" }

  const { data, error } = await supabase
    .from("membership_plans" as never)
    .select("*")
    .eq("gym_id", profile.gym_id)
    .order("type") as unknown as { data: any[] | null; error: any }

  return { data, error: error?.message ?? null, gymId: profile.gym_id }
}

export async function saveMembershipPlan(plan: MembershipPlanInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { error: "Sin permisos" }
  if (!profile?.gym_id) return { error: "Sin gimnasio" }

  const { error } = await supabase
    .from("membership_plans" as never)
    .upsert(
      {
        gym_id: profile.gym_id,
        type: plan.type,
        label: plan.label,
        price: plan.price,
        duration_days: plan.duration_days,
        features: plan.features,
        is_active: plan.is_active,
      } as never,
      { onConflict: "gym_id,type" }
    ) as unknown as { error: any }

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}
