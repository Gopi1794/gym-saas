"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { AchievementInput } from "@/lib/achievements/types"

export async function saveAchievement(
  input: AchievementInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autorizado" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, error: "No autorizado" }
  }

  if (profile.role !== "admin" && profile.role !== "trainer") {
    return { ok: false, error: "No autorizado" }
  }

  if (!profile.gym_id) {
    return { ok: false, error: "Tu cuenta no está asociada a un gimnasio" }
  }

  // Server-side validation
  const xpReward = Number(input.xp_reward)
  if (!Number.isInteger(xpReward) || xpReward < 1 || xpReward > 1000) {
    return { ok: false, error: "xp_reward debe ser un número entero entre 1 y 1000" }
  }

  const conditionValue = Number(input.condition_value)
  if (!Number.isInteger(conditionValue) || conditionValue < 1) {
    return { ok: false, error: "condition_value debe ser un número entero mayor o igual a 1" }
  }

  // gym_id is ALWAYS derived from the authenticated user's profile — never from input
  const payload = {
    name: input.name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    xp_reward: xpReward,
    condition_type: input.condition_type,
    condition_value: conditionValue,
    condition_target: input.condition_target ?? null,
    gym_id: profile.gym_id,
  }

  if (input.id) {
    // UPDATE
    const { error } = await supabase
      .from("achievements" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("gym_id", profile.gym_id)

    if (error) {
      return { ok: false, error: (error as { message: string }).message }
    }
  } else {
    // INSERT
    const { error } = await supabase
      .from("achievements" as never)
      .insert(payload as never)

    if (error) {
      return { ok: false, error: (error as { message: string }).message }
    }
  }

  revalidatePath("/achievements")
  return { ok: true }
}

export async function deleteAchievement(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autorizado" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, error: "No autorizado" }
  }

  if (profile.role !== "admin" && profile.role !== "trainer") {
    return { ok: false, error: "No autorizado" }
  }

  if (!profile.gym_id) {
    return { ok: false, error: "Tu cuenta no está asociada a un gimnasio" }
  }

  const { error } = await supabase
    .from("achievements" as never)
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gym_id)

  if (error) {
    return { ok: false, error: (error as { message: string }).message }
  }

  revalidatePath("/achievements")
  return { ok: true }
}
