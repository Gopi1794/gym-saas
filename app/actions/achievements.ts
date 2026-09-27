"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { AchievementInput } from "@/lib/achievements/types"
import { validateAchievementInput } from "@/lib/achievements/validation"

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

  // Server-side validation (the form runs the same check for instant feedback)
  const validationError = validateAchievementInput(input)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  // gym_id is ALWAYS derived from the authenticated user's profile — never from input
  const payload = {
    name: input.name.trim(),
    description: input.description ?? null,
    icon: input.icon ?? null,
    xp_reward: Number(input.xp_reward),
    condition_type: input.condition_type,
    condition_value: Number(input.condition_value),
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
