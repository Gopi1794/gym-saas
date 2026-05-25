"use server"

import { createClient } from "@/lib/supabase/server"

export async function markOnboardingSeen() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("profiles")
    .update({ onboarding_seen: true })
    .eq("id", user.id)
}
